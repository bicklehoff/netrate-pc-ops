// API: Get Borrower's Loans
// GET /api/portal/loans
//
// Returns all loans for the authenticated borrower.
// Requires fully authenticated borrower session.

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireBorrowerAuth } from '@/lib/borrower-session';
import { STATUS_LABELS, BALL_IN_COURT } from '@/lib/loan-states';

export async function GET() {
  try {
    const session = await requireBorrowerAuth();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const loans = await prisma.loan.findMany({
      where: { borrowerId: session.borrowerId },
      include: {
        documents: {
          select: {
            id: true,
            docType: true,
            label: true,
            status: true,
            fileName: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        events: {
          select: {
            id: true,
            eventType: true,
            oldValue: true,
            newValue: true,
            details: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        mlo: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Enrich with display labels
    const enrichedLoans = loans.map((loan) => ({
      ...loan,
      statusLabel: STATUS_LABELS[loan.status] || loan.status,
      ballInCourtLabel: BALL_IN_COURT[loan.status] || 'unknown',
      pendingDocs: loan.documents.filter((d) => d.status === 'requested').length,
    }));

    return NextResponse.json({ loans: enrichedLoans });
  } catch (error) {
    console.error('Get loans error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
