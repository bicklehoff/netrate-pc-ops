/**
 * MLO Quote API — List & Create
 *
 * GET  /api/portal/mlo/quotes — list quotes (optional filters: status, contactId, search)
 * POST /api/portal/mlo/quotes — create a new quote (validate → eligibility → price → fees → save draft)
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { priceScenario } from '@/lib/rates/price-scenario';
import { checkEligibility } from '@/lib/quotes/eligibility';
import { buildFeeBreakdown } from '@/lib/quotes/fee-builder';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const contactId = searchParams.get('contactId');
    const loanId = searchParams.get('loanId');
    const search = searchParams.get('search');
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 200);

    const where = { mloId: session.user.id };
    if (status) where.status = status;
    if (contactId) where.contactId = contactId;
    if (loanId) where.loanId = loanId;
    if (search) {
      where.borrowerName = { contains: search, mode: 'insensitive' };
    }

    const quotes = await prisma.borrowerQuote.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        borrowerName: true,
        borrowerEmail: true,
        purpose: true,
        loanAmount: true,
        loanType: true,
        state: true,
        fico: true,
        ltv: true,
        term: true,
        status: true,
        monthlyPayment: true,
        version: true,
        sentAt: true,
        viewedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ quotes });
  } catch (err) {
    console.error('Quotes GET error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
      ? Math.round((loanAmount / propertyValue) * 10000) / 100
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

    // Build fee breakdown
    const lenderFeeUw = pricing.results[0]?.lenderFee || 999;
    const fees = await buildFeeBreakdown({
      state: pricingInput.state,
      county: pricingInput.county,
      purpose: body.purpose,
      lenderFeeUw,
      loanAmount,
      propertyValue,
    });

    // Pick top 3 rate scenarios for the quote (lowest rate with best price per lender)
    const topScenarios = pickTopScenarios(pricing.results, 3);

    // Calculate monthly payment for primary scenario
    const primaryRate = topScenarios[0];
    const monthlyPI = primaryRate
      ? calculateMonthlyPI(loanAmount, primaryRate.rate, body.term || 30)
      : null;
    const monthlyTax = fees?.monthlyTax || 0;
    const monthlyInsurance = fees?.monthlyInsurance || 0;
    const monthlyPayment = monthlyPI ? monthlyPI + monthlyTax + monthlyInsurance : null;

    // Compute safe property value (avoid Infinity from ltv=0)
    const safePropertyValue = propertyValue || (ltv > 0 ? Math.round(loanAmount / (ltv / 100)) : loanAmount);

    // Coerce empty strings to null for Decimal fields
    const toDecimalOrNull = (v) => {
      if (v === '' || v === null || v === undefined) return null;
      const n = Number(v);
      return isNaN(n) ? null : n;
    };

    // Create quote record
    const quote = await prisma.borrowerQuote.create({
      data: {
        mloId: session.user.id,
        contactId: body.contactId || null,
        leadId: body.leadId || null,
        loanId: body.loanId || null,
        borrowerName: body.borrowerName || null,
        borrowerEmail: body.borrowerEmail || null,
        borrowerPhone: body.borrowerPhone || null,
        purpose: body.purpose,
        propertyValue: safePropertyValue,
        loanAmount,
        ltv,
        fico: body.fico,
        state: pricingInput.state,
        county: pricingInput.county,
        propertyType: body.propertyType || null,
        occupancy: body.occupancy || 'primary',
        loanType: pricingInput.loanType,
        term: pricingInput.term,
        closingDate: body.closingDate ? new Date(body.closingDate) : null,
        currentRate: toDecimalOrNull(body.currentRate),
        currentBalance: toDecimalOrNull(body.currentBalance),
        currentPayment: toDecimalOrNull(body.currentPayment),
        currentLender: body.currentLender || null,
        scenarios: topScenarios,
        feeBreakdown: fees,
        monthlyPayment,
        status: 'draft',
        version: 1,
      },
    });

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

  // Group by lender, pick best price per lender
  const byLender = new Map();
  for (const r of results) {
    const key = r.lender;
    if (!byLender.has(key) || r.finalPrice > byLender.get(key).finalPrice) {
      byLender.set(key, r);
    }
  }

  // Sort by rate ascending, take top N
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
      monthlyPI: calculateMonthlyPI(r.baseLoanAmount || r.effectiveLoanAmount, r.rate, 30),
      rebateDollars: r.rebateDollars || 0,
      discountDollars: r.discountDollars || 0,
      compDollars: r.compDollars || 0,
      lenderFee: r.lenderFee || 0,
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
