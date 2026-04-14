// API: Loan Dates (Processing Checklist)
// GET /api/portal/mlo/loans/:id/dates — Get LoanDates record
// PATCH /api/portal/mlo/loans/:id/dates — Update individual date fields
//
// Used by ProcessingSection for click-to-edit date fields.

import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';

// camelCase → snake_case date column mapping
const DATE_FIELD_MAP = {
  applicationDate: 'application_date', lockedDate: 'locked_date', lockExpiration: 'lock_expiration',
  lockTerm: 'lock_term', creditPulledDate: 'credit_pulled_date', creditExpiration: 'credit_expiration',
  appraisalOrdered: 'appraisal_ordered', appraisalScheduled: 'appraisal_scheduled',
  appraisalReceived: 'appraisal_received', appraisalDue: 'appraisal_due',
  appraisalDeadline: 'appraisal_deadline', appraisalExpiry: 'appraisal_expiry',
  titleOrdered: 'title_ordered', titleReceived: 'title_received', titleExpiry: 'title_expiry',
  hoiOrdered: 'hoi_ordered', hoiReceived: 'hoi_received', hoiBound: 'hoi_bound',
  floodCertOrdered: 'flood_cert_ordered', floodCertReceived: 'flood_cert_received',
  estimatedClosing: 'estimated_closing', closingDate: 'closing_date',
  estimatedFunding: 'estimated_funding', fundingDate: 'funding_date',
  firstPaymentDate: 'first_payment_date', submittedToUwDate: 'submitted_to_uw_date',
  condApprovedDate: 'cond_approved_date', ctcDate: 'ctc_date', docsOutDate: 'docs_out_date',
};

const BOOLEAN_FIELDS = { appraisalWaiver: 'appraisal_waiver' };
const INT_FIELDS = { lockTerm: 'lock_term' };

export async function GET(request, { params }) {
  try {
    const { session, orgId, mloId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const { id } = await params;

    const loanRows = await sql`SELECT id, mlo_id FROM loans WHERE id = ${id} AND organization_id = ${orgId} LIMIT 1`;
    if (loanRows.length === 0) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }
    const loan = loanRows[0];
    const isAdmin = session.user.role === 'admin';
    if (!isAdmin && loan.mlo_id !== mloId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const datesRows = await sql`SELECT * FROM loan_dates WHERE loan_id = ${id} LIMIT 1`;

    return NextResponse.json({ dates: datesRows[0] || {} });
  } catch (error) {
    console.error('Loan dates GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { session, orgId, mloId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    const body = await request.json();

    const loanRows = await sql`SELECT id, mlo_id FROM loans WHERE id = ${id} AND organization_id = ${orgId} LIMIT 1`;
    if (loanRows.length === 0) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }
    const loan = loanRows[0];
    const isAdmin = session.user.role === 'admin';
    if (!isAdmin && loan.mlo_id !== mloId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Build update data
    const updateData = {};
    const changedFields = [];

    for (const [camel, snake] of Object.entries(DATE_FIELD_MAP)) {
      if (body[camel] !== undefined && !INT_FIELDS[camel]) {
        updateData[snake] = body[camel] ? new Date(body[camel]) : null;
        changedFields.push(camel);
      }
    }

    for (const [camel, snake] of Object.entries(BOOLEAN_FIELDS)) {
      if (body[camel] !== undefined) {
        updateData[snake] = Boolean(body[camel]);
        changedFields.push(camel);
      }
    }

    for (const [camel, snake] of Object.entries(INT_FIELDS)) {
      if (body[camel] !== undefined) {
        updateData[snake] = body[camel] ? parseInt(body[camel], 10) : null;
        changedFields.push(camel);
      }
    }

    if (changedFields.length === 0) {
      return NextResponse.json({ error: 'No valid date fields provided' }, { status: 400 });
    }

    // Upsert — create loan_dates record if it doesn't exist yet
    const cols = Object.keys(updateData);
    const vals = Object.values(updateData);
    const updateFragments = cols.map((c, i) => `"${c}" = $${i + 2}`);
    const insertCols = ['loan_id', ...cols];
    const insertPlaceholders = insertCols.map((_, i) => `$${i + 1}`);
    const q = `INSERT INTO loan_dates (id, ${insertCols.map(c => `"${c}"`).join(', ')}, created_at, updated_at)
               VALUES (gen_random_uuid(), ${insertPlaceholders.join(', ')}, NOW(), NOW())
               ON CONFLICT (loan_id) DO UPDATE SET ${updateFragments.join(', ')}, updated_at = NOW()
               RETURNING *`;
    const datesRows = await sql(q, [id, ...vals]);

    // Audit event
    await sql`
      INSERT INTO loan_events (id, loan_id, event_type, actor_type, actor_id, new_value, details, created_at)
      VALUES (gen_random_uuid(), ${id}, 'field_updated', 'mlo', ${mloId},
              ${JSON.stringify(updateData)},
              ${JSON.stringify({ fields: changedFields, source: 'processing_checklist' })},
              NOW())
    `;

    return NextResponse.json({ dates: datesRows[0] });
  } catch (error) {
    console.error('Loan dates PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
