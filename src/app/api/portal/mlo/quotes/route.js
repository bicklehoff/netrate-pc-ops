/**
 * MLO Quote API — List & Create
 *
 * GET  /api/portal/mlo/quotes — list quotes (optional filters: status, contactId, search)
 * POST /api/portal/mlo/quotes — create a new quote (validate → eligibility → price → fees → save draft)
 */

import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { priceScenario } from '@/lib/rates/price-scenario';
import { checkEligibility } from '@/lib/quotes/eligibility';
import { buildFeeBreakdown } from '@/lib/quotes/fee-builder';
import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';

export async function GET(request) {
  try {
    const { session, orgId, mloId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const contactId = searchParams.get('contactId');
    const loanId = searchParams.get('loanId');
    const search = searchParams.get('search');
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 200);
    const searchPattern = search ? `%${search}%` : null;

    const quotes = await sql`
      SELECT id, borrower_name, borrower_email, purpose, loan_amount, loan_type,
        state, fico, ltv, term, status, monthly_payment, version,
        sent_at, viewed_at, created_at, updated_at
      FROM borrower_quotes
      WHERE mlo_id = ${mloId}
        AND organization_id = ${orgId}
        AND (${status}::text IS NULL OR status = ${status})
        AND (${contactId}::uuid IS NULL OR contact_id = ${contactId})
        AND (${loanId}::uuid IS NULL OR loan_id = ${loanId})
        AND (${searchPattern}::text IS NULL OR borrower_name ILIKE ${searchPattern})
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    return NextResponse.json({ quotes });
  } catch (err) {
    console.error('Quotes GET error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { session, orgId, mloId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const body = await request.json();

    // Validate required fields
    if (!body.loanAmount || body.loanAmount < 50000 || body.loanAmount > 10000000) {
      return NextResponse.json({ error: 'loanAmount required (50K-10M)' }, { status: 400 });
    }
    if (!body.fico || body.fico < 300 || body.fico > 850) {
      return NextResponse.json({ error: 'fico required (300-850)' }, { status: 400 });
    }
    if (!body.purpose) {
      return NextResponse.json({ error: 'purpose required (purchase/refinance/cashout)' }, { status: 400 });
    }

    const loanAmount = Number(body.loanAmount);
    const propertyValue = body.propertyValue ? Number(body.propertyValue) : null;
    const ltv = propertyValue
      ? Math.floor((loanAmount / propertyValue) * 10000) / 100
      : Number(body.ltv || 75);

    // Build scenario for pricing engine
    const pricingInput = {
      loanAmount,
      loanPurpose: body.purpose,
      loanType: body.loanType || 'conventional',
      state: body.state || 'CO',
      county: body.county || null,
      creditScore: body.fico,
      propertyValue,
      term: body.term || 30,
      lockDays: body.lockDays || 30,
      productType: body.productType || 'fixed',
      borrowerPaid: body.borrowerPaid || false,
      escrowsWaived: body.escrowsWaived || false,
      firstTimeBuyer: body.firstTimeBuyer || false,
    };

    // Run eligibility check
    const eligibility = await checkEligibility({
      loanAmount,
      loanType: pricingInput.loanType,
      loanPurpose: pricingInput.loanPurpose,
      creditScore: body.fico,
      ltv,
      state: pricingInput.state,
      county: pricingInput.county,
      term: pricingInput.term,
      productType: pricingInput.productType,
    });

    // Run pricing engine
    const pricing = await priceScenario(pricingInput);

    // Merge pricing config warnings into eligibility warnings
    if (pricing.configWarnings?.length) {
      for (const w of pricing.configWarnings) {
        eligibility.warnings.push({ severity: 'warning', code: 'CONFIG_MISSING', message: w });
      }
    }

    // Build fee breakdown
    const lenderFeeUw = pricing.results[0]?.lenderFee;
    if (lenderFeeUw == null && pricing.results.length > 0) {
      eligibility.warnings.push({ severity: 'warning', code: 'CONFIG_MISSING', message: 'Lender fee missing from rate results — check rate_lenders.uwFee' });
    }
    const primaryAnnualRate = pricing.results[0]?.rate ?? 0;
    const fees = await buildFeeBreakdown({
      state: pricingInput.state,
      county: pricingInput.county,
      purpose: body.purpose,
      lenderFeeUw,
      loanAmount,
      fundingDate: body.fundingDate || body.closingDate || null,
      annualRate: primaryAnnualRate,
      isEscrowing: !(body.escrowsWaived || false),
      loanType: pricingInput.loanType,
      ltv,
      term: pricingInput.term,
    });

    // Surface fee template warning
    if (fees?.configWarning) {
      eligibility.warnings.push({ severity: 'warning', code: 'CONFIG_MISSING', message: fees.configWarning });
    }

    // Pick top 3 rate scenarios for the quote (lowest rate with best price per lender)
    const topScenarios = pickTopScenarios(pricing.results, 3);

    // Calculate monthly payment for primary scenario
    const primaryRate = topScenarios[0];
    const fhaEffective = primaryRate?.effectiveLoanAmount || loanAmount;
    const monthlyPI = primaryRate
      ? calculateMonthlyPI(fhaEffective, primaryRate.rate, body.term || 30)
      : null;
    const monthlyTax = fees?.monthlyTax || 0;
    const monthlyInsurance = fees?.monthlyInsurance || 0;
    const monthlyMip = fees?.monthlyMip || 0;
    const monthlyPayment = monthlyPI ? monthlyPI + monthlyTax + monthlyInsurance + monthlyMip : null;

    // Compute safe property value (avoid Infinity from ltv=0)
    const safePropertyValue = propertyValue || (ltv > 0 ? Math.round(loanAmount / (ltv / 100)) : loanAmount);

    // Coerce empty strings to null for Decimal fields
    const toDecimalOrNull = (v) => {
      if (v === '' || v === null || v === undefined) return null;
      const n = Number(v);
      return isNaN(n) ? null : n;
    };

    // Lead auto-create / link ──────────────────────────────────────────────
    let resolvedLeadId = body.leadId || null;

    if (resolvedLeadId) {
      const existingLead = await sql`
        SELECT id FROM leads WHERE id = ${resolvedLeadId} AND mlo_id = ${mloId} AND organization_id = ${orgId} LIMIT 1
      `;
      if (!existingLead[0]) resolvedLeadId = null;
    }

    if (!resolvedLeadId && body.borrowerEmail) {
      const existingByEmail = await sql`
        SELECT id FROM leads WHERE email = ${body.borrowerEmail} AND mlo_id = ${mloId} AND organization_id = ${orgId} LIMIT 1
      `;
      if (existingByEmail[0]) {
        resolvedLeadId = existingByEmail[0].id;
      } else {
        const newLead = await sql`
          INSERT INTO leads (
            organization_id, email, phone, name, first_name, last_name, source, status,
            loan_purpose, loan_amount, property_value, property_state, property_county,
            credit_score, mlo_id, created_at, updated_at
          ) VALUES (
            ${orgId}, ${body.borrowerEmail}, ${body.borrowerPhone || null},
            ${body.borrowerName || body.borrowerEmail},
            ${body.borrowerName ? body.borrowerName.split(' ')[0] : null},
            ${body.borrowerName ? body.borrowerName.split(' ').slice(1).join(' ') || null : null},
            'quote_generator', 'quoted',
            ${body.purpose}, ${loanAmount}, ${safePropertyValue},
            ${pricingInput.state}, ${pricingInput.county || null},
            ${body.fico}, ${mloId},
            NOW(), NOW()
          )
          RETURNING id
        `;
        resolvedLeadId = newLead[0].id;
      }
    }

    // Update lead status → quoted (if we have one)
    if (resolvedLeadId) {
      await sql`
        UPDATE leads SET status = 'quoted',
          scenario_data = ${JSON.stringify({
            purpose: body.purpose,
            loanAmount,
            propertyValue: safePropertyValue,
            state: pricingInput.state,
            county: pricingInput.county,
            fico: body.fico,
            loanType: pricingInput.loanType,
            lastQuotedAt: new Date().toISOString(),
          })}::jsonb,
          updated_at = NOW()
        WHERE id = ${resolvedLeadId} AND organization_id = ${orgId}
      `;
    }

    // Create quote record
    const quoteRows = await sql`
      INSERT INTO borrower_quotes (
        id, organization_id, mlo_id, contact_id, lead_id, loan_id,
        borrower_name, borrower_email, borrower_phone,
        purpose, property_value, loan_amount, ltv, fico,
        state, county, property_type, occupancy, loan_type, term,
        closing_date, current_rate, current_balance, current_payment, current_lender,
        scenarios, fee_breakdown, monthly_payment,
        status, version, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), ${orgId}, ${mloId},
        ${body.contactId || null}, ${resolvedLeadId}, ${body.loanId || null},
        ${body.borrowerName || null}, ${body.borrowerEmail || null}, ${body.borrowerPhone || null},
        ${body.purpose}, ${safePropertyValue}, ${loanAmount}, ${ltv}, ${body.fico},
        ${pricingInput.state}, ${pricingInput.county}, ${body.propertyType || null},
        ${body.occupancy || 'primary'}, ${pricingInput.loanType}, ${pricingInput.term},
        ${body.closingDate ? new Date(body.closingDate) : null},
        ${toDecimalOrNull(body.currentRate)}, ${toDecimalOrNull(body.currentBalance)},
        ${toDecimalOrNull(body.currentPayment)}, ${body.currentLender || null},
        ${JSON.stringify(topScenarios)}::jsonb, ${JSON.stringify(fees)}::jsonb, ${monthlyPayment},
        'draft', 1, NOW(), NOW()
      )
      RETURNING *
    `;
    const quote = quoteRows[0];

    return NextResponse.json({
      quote,
      pricing: {
        effectiveDate: pricing.effectiveDate,
        loanClassification: pricing.loanClassification,
        countyLimits: pricing.countyLimits,
        resultCount: pricing.resultCount,
        results: pricing.results,
      },
      eligibility,
      fees,
    });
  } catch (err) {
    console.error('Quotes POST error:', err);
    return NextResponse.json({ error: 'Internal error', detail: err.message }, { status: 500 });
  }
}

/**
 * Pick top N rate scenarios — best price per unique lender, then by lowest rate.
 */
function pickTopScenarios(results, n) {
  if (!results || results.length === 0) return [];

  const byLender = new Map();
  for (const r of results) {
    const key = r.lender;
    if (!byLender.has(key) || r.finalPrice > byLender.get(key).finalPrice) {
      byLender.set(key, r);
    }
  }

  return Array.from(byLender.values())
    .sort((a, b) => a.rate - b.rate)
    .slice(0, n)
    .map(r => ({
      rate: r.rate,
      price: r.finalPrice,
      lender: r.lender,
      lenderCode: r.lenderCode || r.lender,
      program: r.program,
      investor: r.investor,
      tier: r.tier,
      lockDays: 30,
      monthlyPI: calculateMonthlyPI(r.effectiveLoanAmount || r.baseLoanAmount, r.rate, 30),
      rebateDollars: r.rebateDollars || 0,
      discountDollars: r.discountDollars || 0,
      compDollars: r.compDollars || 0,
      lenderFee: r.lenderFee || 0,
      ufmip: r.ufmip || 0,
      effectiveLoanAmount: r.effectiveLoanAmount || r.baseLoanAmount || 0,
      breakdown: r.breakdown || [],
    }));
}

function calculateMonthlyPI(principal, annualRate, termYears) {
  const monthlyRate = annualRate / 100 / 12;
  const numPayments = termYears * 12;
  if (monthlyRate === 0) return Math.round(principal / numPayments);
  const payment = principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1);
  return Math.round(payment * 100) / 100;
}
