/**
 * MLO Quote API — List & Create
 *
 * GET  /api/portal/mlo/quotes — list quotes (optional filters: status, contactId, search)
 * POST /api/portal/mlo/quotes — create a new quote (validate → eligibility → price → fees → save draft)
 *
 * Reads/writes the unified scenarios tables. MLO quotes are stored with
 *   owner_type='mlo', source='mlo_quote', visibility='internal'
 * Response shapes match the legacy (pre-unification) quote shape via scenarioToQuoteShape().
 */

import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { priceScenario } from '@/lib/rates/price-scenario';
import { pickParRate } from '@/lib/rates/pick-par-rate';
import { checkEligibility } from '@/lib/quotes/eligibility';
import { buildFeeBreakdown } from '@/lib/quotes/fee-builder';
import { calculateMonthlyPI } from '@/lib/mortgage-math';
import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';
import { createScenario, listScenarios } from '@/lib/scenarios/db';
import { scenarioToQuoteShape, deriveIdentity } from '@/lib/scenarios/transform';

export async function GET(request) {
  try {
    const { session, orgId, mloId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const contactId = searchParams.get('contactId');
    const loanId = searchParams.get('loanId');
    const leadId = searchParams.get('leadId');
    const search = searchParams.get('search');
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 200);

    const { scenarios } = await listScenarios({
      orgId,
      mloId,
      ownerType: 'mlo',
      status,
      contactId,
      loanId,
      leadId,
      search,
      limit,
    });

    // The list shape keeps rates[] inline (from the DAL subquery). For
    // backward compatibility, expose old-shape fields alongside. Identity
    // comes from deriveIdentity (contact → lead → legacy).
    const quotes = scenarios.map((s) => {
      const { borrower_name, borrower_email } = deriveIdentity(s);
      return {
      id: s.id,
      borrower_name,
      borrower_email,
      purpose: s.loan_purpose,
      loan_amount: s.loan_amount,
      loan_type: s.loan_type,
      state: s.state,
      fico: s.fico,
      ltv: s.ltv,
      term: s.term,
      status: s.status,
      monthly_payment: s.monthly_payment,
      version: s.version,
      sent_at: s.sent_at,
      viewed_at: s.viewed_at,
      created_at: s.created_at,
      updated_at: s.updated_at,
      };
    });

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

    // Pick top 3 par rates across lenders FIRST so fee breakdown can
    // anchor on the primary rate actually being quoted (not pricer
    // results[0] which was a deep-discount row with a mismatched rate).
    const topScenarios = pickTopScenarios(pricing.results, 3);

    // Build fee breakdown against the primary scenario's rate + lender fee,
    // so prepaid-interest math matches the rate the borrower sees. Fallback
    // to pricing.parRow and then results[0] for thin-ladder edge cases.
    const primaryScenario = topScenarios[0];
    const lenderFeeUw =
      primaryScenario?.lenderFee ??
      pricing.parRow?.lenderFee ??
      pricing.results[0]?.lenderFee;
    if (lenderFeeUw == null && pricing.results.length > 0) {
      eligibility.warnings.push({ severity: 'warning', code: 'CONFIG_MISSING', message: 'Lender fee missing from rate results — check rate_lenders.uwFee' });
    }
    const primaryAnnualRate =
      primaryScenario?.rate ??
      pricing.parRow?.rate ??
      pricing.results[0]?.rate ??
      0;
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

    // Calculate monthly payment for primary scenario
    const primaryRate = topScenarios[0];
    const fhaEffective = primaryRate?.effectiveLoanAmount || loanAmount;
    const monthlyPI = primaryRate
      ? calculateMonthlyPI(primaryRate.rate, fhaEffective, body.term || 30)
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

    // Create scenario record (unified table)
    const scenario = await createScenario(
      {
        organization_id: orgId,
        owner_type: 'mlo',
        source: 'mlo_quote',
        visibility: 'internal',
        status: 'draft',
        mlo_id: mloId,
        contact_id: body.contactId || null,
        lead_id: resolvedLeadId,
        loan_id: body.loanId || null,
        // Identity flows from contact_id or lead_id. DAL no longer
        // writes denormalized borrower_* fields (Layer-1c).
        loan_purpose: body.purpose,
        property_value: safePropertyValue,
        loan_amount: loanAmount,
        ltv,
        fico: body.fico,
        state: pricingInput.state,
        county: pricingInput.county,
        property_type: body.propertyType || null,
        occupancy: body.occupancy || 'primary',
        loan_type: pricingInput.loanType,
        term: pricingInput.term,
        product_type: pricingInput.productType,
        lock_days: pricingInput.lockDays,
        first_time_buyer: pricingInput.firstTimeBuyer,
        borrower_paid: pricingInput.borrowerPaid,
        escrows_waived: pricingInput.escrowsWaived,
        closing_date: body.closingDate ? new Date(body.closingDate) : null,
        current_rate: toDecimalOrNull(body.currentRate),
        current_balance: toDecimalOrNull(body.currentBalance),
        current_payment: toDecimalOrNull(body.currentPayment),
        current_lender: body.currentLender || null,
        monthly_payment: monthlyPayment,
        monthly_tax: monthlyTax || null,
        monthly_insurance: monthlyInsurance || null,
        monthly_mip: monthlyMip || null,
        version: 1,
        effective_date: pricing.effectiveDate ? new Date(pricing.effectiveDate) : null,
        loan_classification: pricing.loanClassification || null,
        pricing_result_count: pricing.resultCount || null,
      },
      topScenarios,
      fees,
    );

    return NextResponse.json({
      quote: scenarioToQuoteShape(scenario),
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
 * Pick top N rate scenarios — par rate per unique lender, then by lowest par.
 *
 * For each lender, apply the canonical par rule (lowest rate with
 * finalPrice >= 100) to that lender's rows. Then sort lenders by their par
 * rate and take the top N. Produces an apples-to-apples "cheapest par across
 * lenders" view — the rates the borrower would actually take.
 *
 * Previous behavior kept max-finalPrice per lender (highest rebate) then
 * sorted by rate, producing a mix of rates the borrower couldn't take
 * coherently.
 */
function pickTopScenarios(results, n) {
  if (!results || results.length === 0) return [];

  // Group rows by lender
  const byLender = new Map();
  for (const r of results) {
    const key = r.lender;
    if (!byLender.has(key)) byLender.set(key, []);
    byLender.get(key).push(r);
  }

  // For each lender, pick its par rate and find the matching row
  const perLenderPar = [];
  for (const [, rows] of byLender) {
    const par = pickParRate(
      rows.map((r) => ({ rate: r.rate, finalPrice: r.finalPrice }))
    );
    if (!par) continue;
    const parRow = rows.find(
      (r) => r.rate === par.rate && r.finalPrice === par.finalPrice
    );
    if (parRow) perLenderPar.push(parRow);
  }

  return perLenderPar
    .sort((a, b) => a.rate - b.rate)
    .slice(0, n)
    .map(r => ({
      rate: r.rate,
      price: r.finalPrice,
      finalPrice: r.finalPrice,
      lender: r.lender,
      lenderCode: r.lenderCode || r.lender,
      program: r.program,
      investor: r.investor,
      tier: r.tier,
      lockDays: 30,
      monthlyPI: calculateMonthlyPI(r.rate, r.effectiveLoanAmount || r.baseLoanAmount, 30),
      rebateDollars: r.rebateDollars || 0,
      discountDollars: r.discountDollars || 0,
      compDollars: r.compDollars || 0,
      lenderFee: r.lenderFee || 0,
      ufmip: r.ufmip || 0,
      effectiveLoanAmount: r.effectiveLoanAmount || r.baseLoanAmount || 0,
      breakdown: r.breakdown || [],
    }));
}
