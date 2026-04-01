// API: MCR Push — Send loan pipeline snapshot to TrackerPortal for MCR reporting
// POST /api/portal/mlo/mcr/push — Admin-only, sends all non-draft loans to Tracker
//
// Tracker uses this data to generate NMLS MCR XML files (annual filing).
// This is an on-demand snapshot — David triggers it when ready to reconcile/file.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

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
      return 'qm'; // conservative default — David can override on Tracker
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
  const cleaned = raw.trim().split(' ')[0]; // handle "CO 80016" type entries
  return STATE_NORMALIZE[cleaned.toLowerCase()] || cleaned.toUpperCase();
}

// ─── Status → MCR Event Type ──────────────────────────────────
function mapStatusToMcrEvent(status, actionTaken) {
  if (status === 'funded' || status === 'settled') return 'FUNDED';
  if (status === 'denied') return 'DENIED';
  if (status === 'withdrawn' || actionTaken === 'withdrawn') return 'WITHDRAWN';
  if (actionTaken === 'incomplete') return 'FILE_CLOSED';
  if (status === 'archived') return 'FILE_CLOSED'; // archived without specific action = file closed
  // Everything else still in the pipeline
  return 'IN_PIPELINE';
}

// ─── POST: Push MCR snapshot to TrackerPortal ─────────────────
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo' || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 401 });
    }

    const now = new Date();

    // Query all non-draft loans with borrower + mlo data
    const loans = await prisma.loan.findMany({
      where: {
        status: { not: 'draft' },
      },
      include: {
        borrower: {
          select: { firstName: true, lastName: true },
        },
        mlo: {
          select: { firstName: true, lastName: true, nmls: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const pushed = [];
    const skipped = [];

    for (const loan of loans) {
      // Must have property state for MCR (per-state reporting)
      const propertyState = normalizeState(loan.propertyAddress?.state);
      if (!propertyState) {
        skipped.push({
          loanId: loan.loanId || loan.id,
          borrower: loan.borrower ? `${loan.borrower.firstName} ${loan.borrower.lastName}` : 'unknown',
          reason: 'Missing property state',
        });
        continue;
      }

      // Must have a borrower
      if (!loan.borrower) {
        skipped.push({
          loanId: loan.loanId || loan.id,
          reason: 'No borrower linked',
        });
        continue;
      }

      const eventType = mapStatusToMcrEvent(loan.status, loan.actionTaken);
      const loanType = (loan.loanType || 'conventional').toLowerCase();

      pushed.push({
        ldoxLoanId: loan.loanId || loan.id,
        borrowerName: `${loan.borrower.firstName} ${loan.borrower.lastName}`,
        loanAmount: loan.loanAmount ? Number(loan.loanAmount) : null,
        propertyState,
        loanType,
        loanPurpose: loan.purpose || null,
        propertyType: loan.propertyType || 'one_to_four_family',
        lienPosition: loan.lienStatus || 'first',
        occupancy: loan.occupancy || 'owner_occupied',
        mloNmlsId: loan.mlo?.nmls || null,
        qmStatus: deriveQmStatus(loanType),
        eventType,
        eventDate: (loan.actionTakenDate || loan.fundingDate || loan.updatedAt)?.toISOString()?.split('T')[0] || null,
        applicationDate: loan.createdAt?.toISOString()?.split('T')[0] || null,
        brokerComp: loan.brokerCompensation ? Number(loan.brokerCompensation) : null,
        loanNumber: loan.lenderLoanNumber || loan.loanNumber || null,
        creditScore: loan.creditScore || null,
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
    const auditPromises = pushed.map((payload) =>
      prisma.loanEvent.create({
        data: {
          loanId: loans.find((l) => (l.loanId || l.id) === payload.ldoxLoanId)?.id,
          eventType: 'mcr_pushed',
          actorType: 'admin',
          actorId: session.user.id,
          newValue: payload.eventType,
          details: {
            mcrPayload: payload,
            pushedAt: now.toISOString(),
          },
        },
      })
    );

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
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo' || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 401 });
    }

    const loans = await prisma.loan.findMany({
      where: {
        status: { not: 'draft' },
      },
      include: {
        borrower: {
          select: { firstName: true, lastName: true },
        },
        mlo: {
          select: { firstName: true, lastName: true, nmls: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const summary = { total: loans.length, byState: {}, byStatus: {}, byType: {}, missingState: 0 };

    for (const loan of loans) {
      const state = normalizeState(loan.propertyAddress?.state) || 'MISSING';
      const eventType = mapStatusToMcrEvent(loan.status, loan.actionTaken);
      const loanType = (loan.loanType || 'unknown').toLowerCase();

      if (state === 'MISSING') {
        summary.missingState++;
      }

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
