// API: MLO Pipeline
// GET  /api/portal/mlo/pipeline — List all loans with inline-editable fields
// PATCH /api/portal/mlo/pipeline — Bulk update loans (status, mlo_id)
//
// Returns all loans for the authenticated MLO (or all loans if admin).
// Includes borrower name, status, ball-in-court, pending doc count, and
// editable fields (loan_number, lender_name, mlo_id).

import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { getBallInCourt } from '@/lib/loan-states';
import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';

export async function GET() {
  try {
    const { session, orgId } = await requireMloSession();

    if (!session) return unauthorizedResponse();

    // Main loan query with borrower + mlo + dates JOINed
    const loans = await sql`
      SELECT l.*,
        b.first_name AS borrower_first_name, b.last_name AS borrower_last_name,
        b.email AS borrower_email, b.phone AS borrower_phone, b.ssn_last_four,
        m.id AS mlo_ref_id, m.first_name AS mlo_first_name, m.last_name AS mlo_last_name,
        ld.application_date, ld.locked_date, ld.lock_expiration, ld.lock_term,
        ld.credit_pulled_date, ld.credit_expiration,
        ld.appraisal_ordered, ld.appraisal_scheduled, ld.appraisal_received,
        ld.appraisal_due, ld.appraisal_waiver,
        ld.title_ordered, ld.title_received,
        ld.hoi_ordered, ld.hoi_received, ld.hoi_bound,
        ld.flood_cert_ordered, ld.flood_cert_received,
        ld.estimated_closing, ld.closing_date AS dates_closing_date,
        ld.funding_date AS dates_funding_date, ld.first_payment_date,
        ld.submitted_to_uw_date, ld.cond_approved_date, ld.ctc_date, ld.docs_out_date,
        (SELECT COUNT(*)::int FROM documents WHERE loan_id = l.id AND status = 'requested') AS pending_docs,
        (SELECT COUNT(*)::int FROM documents WHERE loan_id = l.id) AS total_docs
      FROM loans l
      LEFT JOIN borrowers b ON l.borrower_id = b.id
      LEFT JOIN staff m ON l.mlo_id = m.id
      LEFT JOIN loan_dates ld ON ld.loan_id = l.id
      WHERE l.organization_id = ${orgId}
      ORDER BY l.updated_at DESC
    `;

    // Fetch co-borrowers for all loans in one query
    const loanIds = loans.map(l => l.id);
    const coBorrowers = loanIds.length ? await sql`
      SELECT lb.loan_id, lb.borrower_type, b.first_name, b.last_name, b.email, b.phone
      FROM loan_borrowers lb
      JOIN borrowers b ON lb.borrower_id = b.id
      WHERE lb.loan_id = ANY(${loanIds}) AND lb.borrower_type != 'primary'
      ORDER BY lb.ordinal ASC
    ` : [];

    // Group co-borrowers by loan_id
    const coMap = new Map();
    for (const cb of coBorrowers) {
      if (!coMap.has(cb.loan_id)) coMap.set(cb.loan_id, []);
      coMap.get(cb.loan_id).push({
        name: `${cb.first_name} ${cb.last_name}`,
        email: cb.email,
        phone: cb.phone,
        type: cb.borrower_type,
      });
    }

    const num = (v) => v ? Number(v) : null;

    // Transform for the pipeline table
    const pipeline = loans.map((loan) => ({
      id: loan.id,
      // Borrower
      borrower_name: `${loan.borrower_first_name} ${loan.borrower_last_name}`,
      borrower_email: loan.borrower_email,
      borrower_phone: loan.borrower_phone,
      ssn_last_four: loan.ssn_last_four,
      // Co-borrowers
      co_borrowers: coMap.get(loan.id) || [],
      num_borrowers: loan.num_borrowers,
      // Status
      status: loan.status,
      ball_in_court: loan.ball_in_court,
      // Loan details
      purpose: loan.purpose,
      loan_type: loan.loan_type,
      loan_number: loan.loan_number,
      lender_name: loan.lender_name,
      loan_amount: num(loan.loan_amount),
      interest_rate: num(loan.interest_rate),
      loan_term: loan.loan_term,
      credit_score: loan.credit_score,
      lien_status: loan.lien_status,
      // Property
      property_address: loan.property_address,
      property_street: loan.property_address?.street || null,
      property_city: loan.property_address?.city || null,
      property_state: loan.property_address?.state || null,
      property_zip: loan.property_address?.zip || null,
      property_county: loan.property_address?.county || null,
      property_type: loan.property_type,
      num_units: loan.num_units,
      occupancy: loan.occupancy,
      // Financials
      purchase_price: num(loan.purchase_price),
      down_payment: num(loan.down_payment),
      estimated_value: num(loan.estimated_value),
      current_balance: num(loan.current_balance),
      refi_purpose: loan.refi_purpose,
      cash_out_amount: num(loan.cash_out_amount),
      // Income / Employment
      employment_status: loan.employment_status,
      employer_name: loan.employer_name,
      position_title: loan.position_title,
      years_in_position: loan.years_in_position,
      monthly_base_income: num(loan.monthly_base_income),
      other_monthly_income: num(loan.other_monthly_income),
      other_income_source: loan.other_income_source,
      present_housing_expense: num(loan.present_housing_expense),
      // MLO
      mlo_id: loan.mlo_id,
      mlo_name: loan.mlo_first_name ? `${loan.mlo_first_name} ${loan.mlo_last_name}` : null,
      // Documents
      pending_docs: loan.pending_docs,
      total_docs: loan.total_docs,
      // Source / CRM
      lead_source: loan.lead_source,
      referral_source: loan.referral_source,
      application_method: loan.application_method,
      application_channel: loan.application_channel,
      ldox_loan_id: loan.ldox_loan_id,
      // MCR / HMDA
      action_taken: loan.action_taken,
      action_taken_date: loan.action_taken_date,
      // Dates (all)
      dates: loan.application_date !== undefined ? {
        application_date: loan.application_date,
        locked_date: loan.locked_date,
        lock_expiration: loan.lock_expiration,
        lock_term: loan.lock_term,
        credit_pulled_date: loan.credit_pulled_date,
        credit_expiration: loan.credit_expiration,
        appraisal_ordered: loan.appraisal_ordered,
        appraisal_scheduled: loan.appraisal_scheduled,
        appraisal_received: loan.appraisal_received,
        appraisal_due: loan.appraisal_due,
        appraisal_waiver: loan.appraisal_waiver,
        title_ordered: loan.title_ordered,
        title_received: loan.title_received,
        hoi_ordered: loan.hoi_ordered,
        hoi_received: loan.hoi_received,
        hoi_bound: loan.hoi_bound,
        flood_cert_ordered: loan.flood_cert_ordered,
        flood_cert_received: loan.flood_cert_received,
        estimated_closing: loan.estimated_closing,
        closing_date: loan.dates_closing_date,
        funding_date: loan.dates_funding_date,
        first_payment_date: loan.first_payment_date,
        submitted_to_uw_date: loan.submitted_to_uw_date,
        cond_approved_date: loan.cond_approved_date,
        ctc_date: loan.ctc_date,
        docs_out_date: loan.docs_out_date,
      } : null,
      // Convenience date fields for table columns
      lock_expiration: loan.lock_expiration || null,
      estimated_closing: loan.estimated_closing || null,
      closing_date: loan.dates_closing_date || null,
      // Timestamps
      submitted_at: loan.submitted_at,
      updated_at: loan.updated_at,
      created_at: loan.created_at,
    }));

    return NextResponse.json({ loans: pipeline });
  } catch (error) {
    console.error('Pipeline error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── Bulk Update ─────────────────────────────────────────────
// Body: { loanIds: string[], updates: { status?, mlo_id? } }
// Creates audit events for each loan updated.

export async function PATCH(request) {
  try {
    const { session, orgId, mloId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const body = await request.json();
    const { loanIds, updates } = body;

    if (!loanIds || !Array.isArray(loanIds) || loanIds.length === 0) {
      return NextResponse.json({ error: 'loanIds array is required' }, { status: 400 });
    }
    if (loanIds.length > 200) {
      return NextResponse.json({ error: 'Maximum 200 loans per batch operation' }, { status: 400 });
    }
    if (!updates || typeof updates !== 'object') {
      return NextResponse.json({ error: 'updates object is required' }, { status: 400 });
    }

    // Only allow specific fields for bulk update (accept both camelCase and snake_case keys)
    const statusVal = updates.status;
    const mloIdVal = updates.mlo_id ?? updates.mloId;
    if (statusVal === undefined && mloIdVal === undefined) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const isAdmin = session.user.role === 'admin';

    // Verify access to all loans
    const loans = await sql`SELECT * FROM loans WHERE id = ANY(${loanIds}) AND organization_id = ${orgId}`;

    if (loans.length !== loanIds.length) {
      return NextResponse.json({ error: 'One or more loans not found' }, { status: 404 });
    }

    if (!isAdmin) {
      const unauthorized = loans.find((l) => l.mlo_id !== mloId);
      if (unauthorized) {
        return NextResponse.json({ error: 'Unauthorized access to one or more loans' }, { status: 403 });
      }
    }

    // Update each loan individually (for audit trail with old/new values)
    let updatedCount = 0;
    for (const loan of loans) {
      const events = [];

      if (statusVal && statusVal !== loan.status) {
        const pendingDocRows = await sql`SELECT COUNT(*)::int AS c FROM documents WHERE loan_id = ${loan.id} AND status = 'requested'`;
        const bic = getBallInCourt(statusVal, pendingDocRows[0].c > 0) || 'none';
        await sql`UPDATE loans SET status = ${statusVal}, ball_in_court = ${bic}, updated_at = NOW() WHERE id = ${loan.id}`;
        events.push({
          event_type: 'status_change',
          old_value: loan.status,
          new_value: statusVal,
          details: JSON.stringify({ source: 'bulk_update' }),
        });
      }

      if (mloIdVal !== undefined && mloIdVal !== loan.mlo_id) {
        await sql`UPDATE loans SET mlo_id = ${mloIdVal || null}, updated_at = NOW() WHERE id = ${loan.id}`;
        events.push({
          event_type: 'field_updated',
          old_value: loan.mlo_id,
          new_value: mloIdVal || null,
          details: JSON.stringify({ field: 'mlo_id', source: 'bulk_update' }),
        });
      }

      for (const event of events) {
        await sql`
          INSERT INTO loan_events (loan_id, event_type, actor_type, actor_id, old_value, new_value, details)
          VALUES (${loan.id}, ${event.event_type}, 'mlo', ${mloId}, ${event.old_value}, ${event.new_value}, ${event.details})
        `;
      }

      if (events.length > 0) updatedCount++;
    }

    return NextResponse.json({ success: true, updatedCount });
  } catch (error) {
    console.error('Bulk update error:', error);
    return NextResponse.json({ error: 'Bulk update failed' }, { status: 500 });
  }
}

// ─── Bulk Delete ─────────────────────────────────────────────
// Body: { loanIds: string[] }
// Admin only. Deletes loans and associated records.

export async function DELETE(request) {
  try {
    const { session, orgId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required for delete' }, { status: 403 });
    }

    const body = await request.json();
    const { loanIds } = body;

    if (!loanIds || !Array.isArray(loanIds) || loanIds.length === 0) {
      return NextResponse.json({ error: 'loanIds array is required' }, { status: 400 });
    }

    // Delete associated records first (non-cascade), then loans
    await sql`DELETE FROM conditions WHERE loan_id = ANY(${loanIds})`.catch(() => {});
    await sql`DELETE FROM loan_events WHERE loan_id = ANY(${loanIds})`.catch(() => {});
    await sql`DELETE FROM documents WHERE loan_id = ANY(${loanIds})`.catch(() => {});

    const result = await sql`DELETE FROM loans WHERE id = ANY(${loanIds}) AND organization_id = ${orgId}`;

    return NextResponse.json({ success: true, deletedCount: result.length });
  } catch (error) {
    console.error('Bulk delete error:', error);
    return NextResponse.json({ error: 'Bulk delete failed' }, { status: 500 });
  }
}
