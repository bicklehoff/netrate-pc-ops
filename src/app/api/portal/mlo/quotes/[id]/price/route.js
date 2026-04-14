/**
 * Re-price an existing quote after scenario edits.
 *
 * POST /api/portal/mlo/quotes/:id/price
 *
 * Reads the quote's current scenario, re-runs pricing + eligibility + fees,
 * and returns fresh results (does not save to DB — caller can PATCH if desired).
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import sql from '@/lib/db';
import { priceScenario } from '@/lib/rates/price-scenario';
import { checkEligibility } from '@/lib/quotes/eligibility';
import { buildFeeBreakdown } from '@/lib/quotes/fee-builder';

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const rows = await sql`SELECT * FROM borrower_quotes WHERE id = ${id} LIMIT 1`;
    const quote = rows[0];
    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }
    if (quote.mlo_id !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Optional overrides from request body
    const body = await request.json().catch(() => ({}));
    const lockDays = body.lockDays || 30;

    // Build scenario from current quote fields
    const pricingInput = {
      loanAmount: Number(quote.loan_amount),
      loanPurpose: quote.purpose,
      loanType: quote.loan_type || 'conventional',
      state: quote.state,
      county: quote.county,
      creditScore: quote.fico,
      propertyValue: Number(quote.property_value),
      term: quote.term || 30,
      lockDays,
    };

    const eligibility = await checkEligibility({
      loanAmount: pricingInput.loanAmount,
      loanType: pricingInput.loanType,
      loanPurpose: pricingInput.loanPurpose,
      creditScore: pricingInput.creditScore,
      ltv: Number(quote.ltv),
      state: pricingInput.state,
      county: pricingInput.county,
      term: pricingInput.term,
    });

    const pricing = await priceScenario(pricingInput);

    const lenderFeeUw = pricing.results[0]?.lenderFee ?? null;
    const fees = await buildFeeBreakdown({
      state: pricingInput.state,
      county: pricingInput.county,
      purpose: quote.purpose,
      lenderFeeUw,
      loanAmount: pricingInput.loanAmount,
      propertyValue: pricingInput.propertyValue,
      annualRate: pricing.results[0]?.rate ?? null,
      loanType: pricingInput.loanType,
      ltv: pricingInput.ltv || Number(quote.ltv),
      term: pricingInput.term,
    });

    return NextResponse.json({
      quoteId: id,
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
    console.error('Quote re-price error:', err);
    return NextResponse.json({ error: 'Internal error', detail: err.message }, { status: 500 });
  }
}
