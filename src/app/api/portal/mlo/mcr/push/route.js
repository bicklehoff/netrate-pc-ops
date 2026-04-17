// API: MCR Push — Send loan pipeline snapshot to TrackerPortal for MCR reporting
// POST /api/portal/mlo/mcr/push — Admin-only, sends all non-draft loans to Tracker
//
// Tracker uses this data to generate NMLS MCR XML files (annual filing).
// This is an on-demand snapshot — David triggers it when ready to reconcile/file.

import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { requireMloSession } from '@/lib/require-mlo-session';

// ─── QM Auto-Classification ───────────────────────────────────
function deriveQmStatus(loanType) {
  switch (loanType) {
    case 'conventional':
    case 'fha':
    case 'va':
    case 'usda':
      return 'qm';
    case 'dscr':
    case 'bank_statement':
      return 'non_qm';
    case 'hecm':
      return 'not_subject';
    default:
      return 'qm';
  }
}

// ─── State Name → USPS Abbreviation ──────────────────────────
const STATE_NORMALIZE = {
  'colorado': 'CO', 'oregon': 'OR', 'texas': 'TX', 'california': 'CA',
  'co': 'CO', 'or': 'OR', 'tx': 'TX', 'ca': 'CA',
  'CO': 'CO', 'OR': 'OR', 'TX': 'TX', 'CA': 'CA',
};

function normalizeState(raw) {
  if (!raw) return null;
  const cleaned = raw.trim().split(' ')[0];
  return STATE_NORMALIZE[cleaned.toLowerCase()] || cleaned.toUpperCase();
}

// ─── Status → MCR Event Type ──────────────────────────────────
function mapStatusToMcrEvent(status, actionTaken) {
  if (status === 'funded' || status === 'settled') return 'FUNDED';
  if (status === 'denied') return 'DENIED';
  if (status === 'withdrawn' || actionTaken === 'withdrawn') return 'WITHDRAWN';
  if (actionTaken === 'incomplete') return 'FILE_CLOSED';
  if (status === 'archived') return 'FILE_CLOSED';
  return 'IN_PIPELINE';
}

// ─── POST: Push MCR snapshot to TrackerPortal ─────────────────
export async function POST() {
  try {
    const { session, orgId, mloId } = await requireMloSession();
    if (!session || session.user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 401 });
    }

    const now = new Date();

    // Query all non-draft loans with borrower + mlo data
    const loans = await sql`
      SELECT l.*,
        b.first_name AS borrower_first_name, b.last_name AS borrower_last_name,
        m.first_name AS mlo_first_name, m.last_name AS mlo_last_name, m.nmls AS mlo_nmls
      FROM loans l
      LEFT JOIN borrowers b ON l.borrower_id = b.id
      LEFT JOIN staff m ON l.mlo_id = m.id
      WHERE l.status != 'draft'
        AND l.organization_id = ${orgId}
      ORDER BY l.created_at ASC
    `;

    const pushed = [];
    const skipped = [];

    for (const loan of loans) {
      const propertyState = normalizeState(loan.property_address?.state);
      if (!propertyState) {
        skipped.push({
          loanId: loan.ldox_loan_id || loan.id,
          borrower: loan.borrower_first_name ? `${loan.borrower_first_name} ${loan.borrower_last_name}` : 'unknown',
          reason: 'Missing property state',
        });
        continue;
      }

      if (!loan.borrower_first_name) {
        skipped.push({
          loanId: loan.ldox_loan_id || loan.id,
          reason: 'No borrower linked',
        });
        continue;
      }

      const eventType = mapStatusToMcrEvent(loan.status, loan.action_taken);
      const loanType = (loan.loan_type || 'conventional').toLowerCase();

      pushed.push({
        ldoxLoanId: loan.ldox_loan_id || loan.id,
        borrowerName: `${loan.borrower_first_name} ${loan.borrower_last_name}`,
        loanAmount: loan.loan_amount ? Number(loan.loan_amount) : null,
        propertyState,
        loanType,
        loanPurpose: loan.purpose || null,
        propertyType: loan.property_type || 'one_to_four_family',
        lienPosition: loan.lien_status || 'first',
        occupancy: loan.occupancy || 'owner_occupied',
        mloNmlsId: loan.mlo_nmls || null,
        qmStatus: deriveQmStatus(loanType),
        eventType,
        eventDate: (loan.action_taken_date || loan.funding_date || loan.updated_at)?.toISOString?.()?.split('T')[0] || null,
        applicationDate: loan.created_at?.toISOString?.()?.split('T')[0] || null,
        brokerComp: loan.broker_compensation ? Number(loan.broker_compensation) : null,
        loanNumber: loan.lender_loan_number || loan.loan_number || null,
        creditScore: loan.credit_score || null,
      });
    }

    if (pushed.length === 0) {
      return NextResponse.json({
        success: true,
        pushed: 0,
        skipped: skipped.length,
        skippedLoans: skipped,
        message: 'No loans to push — all loans either draft or missing required fields.',
      });
    }

    // POST batch to TrackerPortal
    let trackerResult = null;
    try {
      const trackerRes = await fetch('https://tracker.netratemortgage.com/api/mcr/loans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tracker-api-key': process.env.TRACKER_API_KEY,
        },
        body: JSON.stringify({ loans: pushed }),
      });
      trackerResult = await trackerRes.json();
      if (!trackerRes.ok) {
        console.error('TrackerPortal MCR push error:', trackerResult);
      }
    } catch (trackerErr) {
      console.error('TrackerPortal MCR POST failed:', trackerErr);
      trackerResult = { error: trackerErr.message };
    }

    // Create audit trail — one event per loan pushed
    const auditPromises = pushed.map((payload) => {
      const loanId = loans.find((l) => (l.ldox_loan_id || l.id) === payload.ldoxLoanId)?.id;
      if (!loanId) return Promise.resolve();
      return sql`
        INSERT INTO loan_events (loan_id, event_type, actor_type, actor_id, new_value, details, created_at)
        VALUES (
          ${loanId}, 'mcr_pushed', 'admin', ${mloId}, ${payload.eventType},
          ${JSON.stringify({ mcrPayload: payload, pushedAt: now.toISOString() })}::jsonb,
          NOW()
        )
      `;
    });

    await Promise.allSettled(auditPromises);

    return NextResponse.json({
      success: true,
      pushed: pushed.length,
      skipped: skipped.length,
      skippedLoans: skipped.length > 0 ? skipped : undefined,
      trackerResult,
      pushedAt: now.toISOString(),
    });
  } catch (error) {
    console.error('MCR push error:', error);
    return NextResponse.json({ error: 'Failed to push MCR data' }, { status: 500 });
  }
}

// ─── GET: Preview what would be pushed ────────────────────────
export async function GET() {
  try {
    const { session, orgId } = await requireMloSession();
    if (!session || session.user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 401 });
    }

    const loans = await sql`
      SELECT l.*, b.first_name AS borrower_first_name, b.last_name AS borrower_last_name,
        m.first_name AS mlo_first_name, m.last_name AS mlo_last_name, m.nmls AS mlo_nmls
      FROM loans l
      LEFT JOIN borrowers b ON l.borrower_id = b.id
      LEFT JOIN staff m ON l.mlo_id = m.id
      WHERE l.status != 'draft'
        AND l.organization_id = ${orgId}
      ORDER BY l.created_at ASC
    `;

    const summary = { total: loans.length, byState: {}, byStatus: {}, byType: {}, missingState: 0 };

    for (const loan of loans) {
      const state = normalizeState(loan.property_address?.state) || 'MISSING';
      const eventType = mapStatusToMcrEvent(loan.status, loan.action_taken);
      const loanType = (loan.loan_type || 'unknown').toLowerCase();

      if (state === 'MISSING') summary.missingState++;
      summary.byState[state] = (summary.byState[state] || 0) + 1;
      summary.byStatus[eventType] = (summary.byStatus[eventType] || 0) + 1;
      summary.byType[loanType] = (summary.byType[loanType] || 0) + 1;
    }

    return NextResponse.json({
      preview: true,
      wouldPush: loans.length - summary.missingState,
      wouldSkip: summary.missingState,
      summary,
    });
  } catch (error) {
    console.error('MCR preview error:', error);
    return NextResponse.json({ error: 'Failed to preview MCR data' }, { status: 500 });
  }
}
