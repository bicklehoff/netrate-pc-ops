// API: Get Borrower's Loans
// GET /api/portal/loans
//
// Returns all loans for the authenticated borrower.
// Requires fully authenticated borrower session.

import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireBorrowerAuth } from '@/lib/borrower-session';
import { STATUS_LABELS, BALL_IN_COURT } from '@/lib/loan-states';

export async function GET() {
  try {
    const session = await requireBorrowerAuth();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get loans with mlo info
    const loans = await sql`
      SELECT l.*,
        json_build_object('first_name', m.first_name, 'last_name', m.last_name, 'email', m.email) AS mlo
      FROM loans l
      LEFT JOIN staff m ON m.id = l.mlo_id
      WHERE l.contact_id = ${session.contactId}
      ORDER BY l.created_at DESC
    `;

    // Get documents and events for all loans
    const loanIds = loans.map(l => l.id);

    let documents = [];
    let events = [];
    if (loanIds.length > 0) {
      [documents, events] = await Promise.all([
        sql`
          SELECT id, loan_id, doc_type, label, status, file_name, created_at
          FROM documents WHERE loan_id = ANY(${loanIds})
          ORDER BY created_at DESC
        `,
        sql`
          SELECT id, loan_id, event_type, old_value, new_value, details, created_at
          FROM loan_events WHERE loan_id = ANY(${loanIds})
          ORDER BY created_at DESC
        `,
      ]);
    }

    // Group by loan
    const docsByLoan = new Map();
    for (const d of documents) {
      if (!docsByLoan.has(d.loan_id)) docsByLoan.set(d.loan_id, []);
      docsByLoan.get(d.loan_id).push(d);
    }

    const eventsByLoan = new Map();
    for (const e of events) {
      if (!eventsByLoan.has(e.loan_id)) eventsByLoan.set(e.loan_id, []);
      const arr = eventsByLoan.get(e.loan_id);
      if (arr.length < 20) arr.push(e);
    }

    // Enrich with display labels
    const enrichedLoans = loans.map((loan) => {
      const loanDocs = docsByLoan.get(loan.id) || [];
      return {
        ...loan,
        mlo: loan.mlo?.first_name ? loan.mlo : null,
        documents: loanDocs,
        events: eventsByLoan.get(loan.id) || [],
        statusLabel: STATUS_LABELS[loan.status] || loan.status,
        ballInCourtLabel: BALL_IN_COURT[loan.status] || 'unknown',
        pendingDocs: loanDocs.filter((d) => d.status === 'requested').length,
      };
    });

    return NextResponse.json({ loans: enrichedLoans });
  } catch (error) {
    console.error('Get loans error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
