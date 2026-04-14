/**
 * MLO Quote API — Single Quote CRUD
 *
 * GET   /api/portal/mlo/quotes/:id — get full quote with all data
 * PATCH /api/portal/mlo/quotes/:id — update quote fields (scenario, fees, selected rates)
 */

import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';

export async function GET(request, { params }) {
  try {
    const { session, orgId, mloId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const { id } = await params;

    const rows = await sql`SELECT * FROM borrower_quotes WHERE id = ${id} AND organization_id = ${orgId} LIMIT 1`;
    const quote = rows[0];

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }
    if (quote.mlo_id !== mloId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json({ quote });
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
    const existing = await sql`SELECT mlo_id, status FROM borrower_quotes WHERE id = ${id} AND organization_id = ${orgId} LIMIT 1`;
    if (!existing[0]) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }
    if (existing[0].mlo_id !== mloId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Build update data from allowed fields using parameterized queries
    const setClauses = [];
    const values = [];

    // Scalar fields
    const scalarMap = {
      borrowerName: 'borrower_name', borrowerEmail: 'borrower_email', borrowerPhone: 'borrower_phone',
      purpose: 'purpose', propertyType: 'property_type', occupancy: 'occupancy', loanType: 'loan_type',
      state: 'state', county: 'county', currentLender: 'current_lender',
    };
    for (const [bodyKey, dbCol] of Object.entries(scalarMap)) {
      if (body[bodyKey] !== undefined) {
        values.push(body[bodyKey]);
        setClauses.push(`${dbCol} = $${values.length}`);
      }
    }

    // Decimal fields
    const decimalMap = {
      propertyValue: 'property_value', loanAmount: 'loan_amount', ltv: 'ltv', currentRate: 'current_rate',
      currentBalance: 'current_balance', currentPayment: 'current_payment', annualTaxes: 'annual_taxes',
      annualInsurance: 'annual_insurance', pmiRate: 'pmi_rate', monthlyPmi: 'monthly_pmi',
      cashToClose: 'cash_to_close', monthlyPayment: 'monthly_payment', monthlySavings: 'monthly_savings',
    };
    for (const [bodyKey, dbCol] of Object.entries(decimalMap)) {
      if (body[bodyKey] !== undefined) {
        values.push(Number(body[bodyKey]));
        setClauses.push(`${dbCol} = $${values.length}`);
      }
    }

    // Int fields
    const intMap = { fico: 'fico', term: 'term', paybackMonths: 'payback_months' };
    for (const [bodyKey, dbCol] of Object.entries(intMap)) {
      if (body[bodyKey] !== undefined) {
        values.push(Number(body[bodyKey]));
        setClauses.push(`${dbCol} = $${values.length}`);
      }
    }

    // Date fields
    if (body.closingDate !== undefined) {
      values.push(body.closingDate ? new Date(body.closingDate) : null);
      setClauses.push(`closing_date = $${values.length}`);
    }
    if (body.firstPaymentDate !== undefined) {
      values.push(body.firstPaymentDate ? new Date(body.firstPaymentDate) : null);
      setClauses.push(`first_payment_date = $${values.length}`);
    }

    // JSON fields
    if (body.scenarios !== undefined) {
      values.push(JSON.stringify(body.scenarios));
      setClauses.push(`scenarios = $${values.length}::jsonb`);
    }
    if (body.feeBreakdown !== undefined) {
      values.push(JSON.stringify(body.feeBreakdown));
      setClauses.push(`fee_breakdown = $${values.length}::jsonb`);
    }

    // Contact/loan links
    if (body.contactId !== undefined) { values.push(body.contactId || null); setClauses.push(`contact_id = $${values.length}`); }
    if (body.leadId !== undefined) { values.push(body.leadId || null); setClauses.push(`lead_id = $${values.length}`); }
    if (body.loanId !== undefined) { values.push(body.loanId || null); setClauses.push(`loan_id = $${values.length}`); }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    setClauses.push('updated_at = NOW()');
    values.push(id);

    values.push(orgId);
    const query = `UPDATE borrower_quotes SET ${setClauses.join(', ')} WHERE id = $${values.length - 1} AND organization_id = $${values.length} RETURNING *`;
    const quoteRows = await sql(query, values);

    return NextResponse.json({ quote: quoteRows[0] });
  } catch (err) {
    console.error('Quote PATCH error:', err);
    return NextResponse.json({ error: 'Internal error', detail: err.message }, { status: 500 });
  }
}
