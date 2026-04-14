// API: MLO Lead Detail
// GET /api/portal/mlo/leads/:id — single lead
// PATCH /api/portal/mlo/leads/:id — update status or notes

import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';

const VALID_STATUSES = ['new', 'contacted', 'qualified', 'quoted', 'converted', 'closed'];

export async function GET(request, { params }) {
  try {
    const { session, orgId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    const [leadRows, leadQuotes, borrowerQuotes] = await Promise.all([
      sql`SELECT * FROM leads WHERE id = ${id} AND organization_id = ${orgId} LIMIT 1`,
      sql`SELECT * FROM lead_quotes WHERE lead_id = ${id} ORDER BY created_at DESC LIMIT 10`,
      sql`
        SELECT id, purpose, loan_amount, loan_type, state, fico, ltv, status,
          monthly_payment, version, sent_at, viewed_at, created_at
        FROM borrower_quotes
        WHERE lead_id = ${id} AND organization_id = ${orgId}
        ORDER BY created_at DESC LIMIT 10
      `,
    ]);

    const lead = leadRows[0];
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json({
      lead: {
        ...lead,
        quotes: leadQuotes,
        borrowerQuotes,
      },
    });
  } catch (error) {
    console.error('Lead detail error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { session, orgId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    const body = await request.json();

    const leadRows = await sql`SELECT * FROM leads WHERE id = ${id} AND organization_id = ${orgId} LIMIT 1`;
    const lead = leadRows[0];
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Whitelist updatable fields — maps camelCase body keys to snake_case DB columns
    const fieldMap = {
      status: 'status',
      loanPurpose: 'loan_purpose',
      loanAmount: 'loan_amount',
      propertyValue: 'property_value',
      propertyState: 'property_state',
      propertyCounty: 'property_county',
      propertyType: 'property_type',
      occupancy: 'occupancy',
      creditScore: 'credit_score',
      creditScoreRange: 'credit_score_range',
      employmentType: 'employment_type',
      firstTimebuyer: 'first_time_buyer',
      annualIncome: 'annual_income',
      monthlyDebts: 'monthly_debts',
      purchasePrice: 'purchase_price',
      downPayment: 'down_payment',
      preApprovalAmount: 'pre_approval_amount',
      preApprovalExpires: 'pre_approval_expires',
      currentRate: 'current_rate',
      currentBalance: 'current_balance',
      currentLender: 'current_lender',
      notes: 'notes',
    };

    const setClauses = [];
    const values = [];

    for (const [bodyKey, dbCol] of Object.entries(fieldMap)) {
      if (body[bodyKey] !== undefined) {
        if (bodyKey === 'status' && !VALID_STATUSES.includes(body[bodyKey])) {
          return NextResponse.json(
            { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
            { status: 400 }
          );
        }
        values.push(body[bodyKey]);
        setClauses.push(`${dbCol} = $${values.length}`);
      }
    }

    // Handle notes append (special case)
    if (body.appendNote) {
      const timestamp = new Date().toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      });
      const noteEntry = `\n--- ${timestamp} (${session.user.name}) ---\n${body.appendNote}`;
      const newNotes = (lead.notes || '') + noteEntry;
      // Remove any previous 'notes' set clause
      const notesIdx = setClauses.findIndex(c => c.startsWith('notes'));
      if (notesIdx >= 0) {
        setClauses.splice(notesIdx, 1);
        values.splice(notesIdx, 1);
      }
      values.push(newNotes);
      setClauses.push(`notes = $${values.length}`);
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    // Add updated_at
    setClauses.push('updated_at = NOW()');
    values.push(id);

    values.push(orgId);
    const query = `UPDATE leads SET ${setClauses.join(', ')} WHERE id = $${values.length - 1} AND organization_id = $${values.length} RETURNING *`;
    const updated = await sql(query, values);

    // Fetch quotes separately
    const quotes = await sql`SELECT * FROM lead_quotes WHERE lead_id = ${id} ORDER BY created_at DESC LIMIT 10`;

    return NextResponse.json({ lead: { ...updated[0], quotes } });
  } catch (error) {
    console.error('Lead update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
