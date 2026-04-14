// Borrower Dashboard — Loan Status Overview
// Auth required (magic link + SMS verified)
// Fetches loans server-side, renders status, documents, and timeline.

import { redirect } from 'next/navigation';
import sql from '@/lib/db';
import { requireBorrowerAuth } from '@/lib/borrower-session';
import LoanStatusCard from '@/components/Portal/LoanStatusCard';
import BorrowerChecklist from '@/components/Portal/BorrowerChecklist';
import LoanTimeline from '@/components/Portal/LoanTimeline';

export default async function BorrowerDashboardPage() {
  const session = await requireBorrowerAuth();

  if (!session) {
    redirect('/portal/auth/login');
  }

  const borrowerRows = await sql`
    SELECT first_name, last_name, email FROM borrowers
    WHERE id = ${session.borrowerId}
    LIMIT 1
  `;
  const borrower = borrowerRows[0];

  // Find loans where this borrower is either primary or co-borrower
  const loanBorrowers = await sql`
    SELECT lb.loan_id, lb.borrower_type
    FROM loan_borrowers lb
    JOIN loans l ON lb.loan_id = l.id
    WHERE lb.borrower_id = ${session.borrowerId}
    ORDER BY l.created_at DESC
  `;
  const loanIds = loanBorrowers.map((lb) => lb.loan_id);

  let loans = [];
  if (loanIds.length > 0) {
    // Load loans
    loans = await sql`
      SELECT * FROM loans
      WHERE id = ANY(${loanIds})
      ORDER BY created_at DESC
    `;

    // Load related data for all loans in batch
    const [allDocuments, allEvents, allMlos, allPrimaryBorrowers] = await Promise.all([
      sql`
        SELECT * FROM documents
        WHERE loan_id = ANY(${loanIds})
        ORDER BY created_at DESC
      `,
      sql`
        SELECT * FROM loan_events
        WHERE loan_id = ANY(${loanIds})
        ORDER BY created_at DESC
      `,
      sql`
        SELECT m.id, m.first_name, m.last_name, m.email
        FROM mlos m
        WHERE m.id = ANY(${loans.map(l => l.mlo_id).filter(Boolean)})
      `,
      sql`
        SELECT lb.loan_id, b.first_name
        FROM loan_borrowers lb
        JOIN borrowers b ON lb.borrower_id = b.id
        WHERE lb.loan_id = ANY(${loanIds})
          AND lb.borrower_type = 'primary'
      `,
    ]);

    // Group by loan_id and attach
    const docsByLoan = {};
    for (const d of allDocuments) {
      if (!docsByLoan[d.loan_id]) docsByLoan[d.loan_id] = [];
      docsByLoan[d.loan_id].push(d);
    }

    const eventsByLoan = {};
    for (const e of allEvents) {
      if (!eventsByLoan[e.loan_id]) eventsByLoan[e.loan_id] = [];
      eventsByLoan[e.loan_id].push(e);
    }

    const mloById = {};
    for (const m of allMlos) {
      mloById[m.id] = { first_name: m.first_name, last_name: m.last_name, email: m.email };
    }

    const primaryByLoan = {};
    for (const pb of allPrimaryBorrowers) {
      if (!primaryByLoan[pb.loan_id]) primaryByLoan[pb.loan_id] = pb;
    }

    // Attach to loans
    for (const loan of loans) {
      loan.documents = docsByLoan[loan.id] || [];
      loan.events = (eventsByLoan[loan.id] || []).slice(0, 15);
      loan.mlo = loan.mlo_id ? mloById[loan.mlo_id] || null : null;
      loan.loanBorrowers = primaryByLoan[loan.id]
        ? [{ borrower: { first_name: primaryByLoan[loan.id].first_name } }]
        : [];
    }
  }

  // Most recent loan (borrowers typically have one active)
  const loan = loans[0] || null;

  // Use the primary borrower's name for the greeting, not the session borrower
  // (handles shared-email cases where co-borrower's name overwrites the record)
  const primaryName = loan?.loanBorrowers?.[0]?.borrower?.first_name || borrower?.first_name;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {primaryName || 'there'}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Track your application status, upload documents, and see what&apos;s next.
        </p>
      </div>

      {!loan ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm text-center">
          <p className="text-gray-500 mb-4">You don&apos;t have any loan applications yet.</p>
          <a
            href="/portal/apply"
            className="inline-block bg-go text-white px-6 py-2.5 rounded-lg font-bold hover:bg-go-dark transition-colors"
          >
            Start an Application
          </a>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Status Card */}
          <LoanStatusCard loan={loan} />

          {/* Checklist */}
          <BorrowerChecklist loan={loan} />

          {/* Timeline */}
          <LoanTimeline events={loan.events} />
        </div>
      )}
    </div>
  );
}
