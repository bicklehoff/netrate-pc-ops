/**
 * Re-price an existing quote after scenario edits.
 *
 * POST /api/portal/mlo/quotes/:id/price
 *
 * Reads the quote's current scenario, re-runs pricing + eligibility + fees,
 * and returns fresh results (does not save to DB — caller can PATCH if desired).
 *
 * Reads from unified scenarios table.
 */

import { NextResponse } from 'next/server';
import { priceScenario } from '@/lib/rates/price-scenario';
import { checkEligibility } from '@/lib/quotes/eligibility';
import { buildFeeBreakdown } from '@/lib/quotes/fee-builder';
import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';
import { getScenarioById } from '@/lib/scenarios/db';

export async function POST(request, { params }) {
  try {
    const { session, orgId, mloId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const { id } = await params;

    const scenario = await getScenarioById(id, orgId);
    if (!scenario) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }
    if (scenario.mlo_id !== mloId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Optional overrides from request body
    const body = await request.json().catch(() => ({}));
    const lockDays = body.lockDays || 30;

    // Build scenario input from current scenario fields
    const pricingInput = {
      loanAmount: Number(scenario.loan_amount),
      loanPurpose: scenario.loan_purpose,
      loanType: scenario.loan_type || 'conventional',
      state: scenario.state,
      county: scenario.county,
      creditScore: scenario.fico,
      propertyValue: Number(scenario.property_value),
      term: scenario.term || 30,
      lockDays,
    };

    const eligibility = await checkEligibility({
      loanAmount: pricingInput.loanAmount,
      loanType: pricingInput.loanType,
      loanPurpose: pricingInput.loanPurpose,
      creditScore: pricingInput.creditScore,
      ltv: Number(scenario.ltv),
      state: pricingInput.state,
      county: pricingInput.county,
      term: pricingInput.term,
    });

    const pricing = await priceScenario(pricingInput);

    const lenderFeeUw = pricing.results[0]?.lenderFee ?? null;
    const fees = await buildFeeBreakdown({
      state: pricingInput.state,
      county: pricingInput.county,
      purpose: scenario.loan_purpose,
      lenderFeeUw,
      loanAmount: pricingInput.loanAmount,
      propertyValue: pricingInput.propertyValue,
      annualRate: pricing.results[0]?.rate ?? null,
      loanType: pricingInput.loanType,
      ltv: Number(scenario.ltv),
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
