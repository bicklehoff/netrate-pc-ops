/**
 * MLO Quote API — Single Quote CRUD
 *
 * GET   /api/portal/mlo/quotes/:id — get full quote with all data
 * PATCH /api/portal/mlo/quotes/:id — update quote fields (scenario, fees, selected rates)
 *
 * Reads/writes unified scenarios tables. Responses use scenarioToQuoteShape()
 * for backward compatibility with the legacy (pre-unification) quote shape.
 */

import { NextResponse } from 'next/server';
import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';
import {
  getScenarioById,
  updateScenario,
  replaceScenarioRates,
  replaceScenarioFeeItems,
} from '@/lib/scenarios/db';
import { getQuoteByScenarioId, scenarioToQuoteShape } from '@/lib/quotes';

export async function GET(request, { params }) {
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

    const quote = await getQuoteByScenarioId(id, orgId);
    return NextResponse.json({ quote: scenarioToQuoteShape(scenario, quote) });
  } catch (err) {
    console.error('Quote GET error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { session, orgId, mloId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    const body = await request.json();

    // Verify ownership
    const existing = await getScenarioById(id, orgId);
    if (!existing) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }
    if (existing.mlo_id !== mloId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Map legacy camelCase body fields to scenarios snake_case columns.
    // Identity fields (contactName/Email/Phone) are NOT in this map — post
    // migration 036 the scenario table no longer carries denormalized
    // identity strings. Identity edits happen on the Contact row (PATCH
    // /api/portal/mlo/contacts/[id]) or the Lead row (pre-conversion).
    const fields = {};

    // Scalar strings
    const scalarMap = {
      purpose: 'loan_purpose', propertyType: 'property_type', occupancy: 'occupancy', loanType: 'loan_type',
      state: 'state', county: 'county', currentLender: 'current_lender',
    };
    for (const [bodyKey, dbCol] of Object.entries(scalarMap)) {
      if (body[bodyKey] !== undefined) fields[dbCol] = body[bodyKey];
    }

    // Decimals
    const decimalMap = {
      propertyValue: 'property_value', loanAmount: 'loan_amount', ltv: 'ltv', currentRate: 'current_rate',
      currentBalance: 'current_balance', currentPayment: 'current_payment', annualTaxes: 'annual_taxes',
      annualInsurance: 'annual_insurance', pmiRate: 'pmi_rate', monthlyPmi: 'monthly_pmi',
      cashToClose: 'cash_to_close', monthlyPayment: 'monthly_payment', monthlySavings: 'monthly_savings',
    };
    for (const [bodyKey, dbCol] of Object.entries(decimalMap)) {
      if (body[bodyKey] !== undefined) fields[dbCol] = Number(body[bodyKey]);
    }

    // Ints
    const intMap = { fico: 'fico', term: 'term', paybackMonths: 'payback_months' };
    for (const [bodyKey, dbCol] of Object.entries(intMap)) {
      if (body[bodyKey] !== undefined) fields[dbCol] = Number(body[bodyKey]);
    }

    // Dates
    if (body.closingDate !== undefined) {
      fields.closing_date = body.closingDate ? new Date(body.closingDate) : null;
    }
    if (body.firstPaymentDate !== undefined) {
      fields.first_payment_date = body.firstPaymentDate ? new Date(body.firstPaymentDate) : null;
    }

    // Links
    if (body.contactId !== undefined) fields.contact_id = body.contactId || null;
    if (body.leadId !== undefined) fields.lead_id = body.leadId || null;
    if (body.loanId !== undefined) fields.loan_id = body.loanId || null;

    // Update scalar fields
    if (Object.keys(fields).length > 0) {
      await updateScenario(id, orgId, fields);
    }

    // Replace rates array (body.scenarios is the legacy name for rate options array)
    if (body.scenarios !== undefined && Array.isArray(body.scenarios)) {
      await replaceScenarioRates(id, body.scenarios);
    }

    // Replace fee breakdown
    if (body.feeBreakdown !== undefined && body.feeBreakdown) {
      await replaceScenarioFeeItems(id, body.feeBreakdown);
    }

    if (Object.keys(fields).length === 0 && body.scenarios === undefined && body.feeBreakdown === undefined) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    // Reload and return
    const updated = await getScenarioById(id, orgId);
    const updatedQuote = await getQuoteByScenarioId(id, orgId);
    return NextResponse.json({ quote: scenarioToQuoteShape(updated, updatedQuote) });
  } catch (err) {
    console.error('Quote PATCH error:', err);
    return NextResponse.json({ error: 'Internal error', detail: err.message }, { status: 500 });
  }
}
