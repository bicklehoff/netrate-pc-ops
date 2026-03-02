// API: MLO Pipeline
// GET /api/portal/mlo/pipeline
// Returns all loans for the authenticated MLO (or all loans if admin).
// Includes borrower name, status, ball-in-court, and pending doc count.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = session.user.role === 'admin';

    const loans = await prisma.loan.findMany({
      where: isAdmin ? {} : { mloId: session.user.id },
      include: {
        borrower: {
          select: { firstName: true, lastName: true, email: true, ssnLastFour: true },
        },
        documents: {
          select: { id: true, status: true },
        },
        mlo: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Transform for the pipeline table
    const pipeline = loans.map((loan) => ({
      id: loan.id,
      borrowerName: `${loan.borrower.firstName} ${loan.borrower.lastName}`,
      borrowerEmail: loan.borrower.email,
      ssnLastFour: loan.borrower.ssnLastFour,
      status: loan.status,
      ballInCourt: loan.ballInCourt,
      purpose: loan.purpose,
      propertyType: loan.propertyType,
      purchasePrice: loan.purchasePrice ? Number(loan.purchasePrice) : null,
      estimatedValue: loan.estimatedValue ? Number(loan.estimatedValue) : null,
      pendingDocs: loan.documents.filter((d) => d.status === 'requested').length,
      totalDocs: loan.documents.length,
      mloName: loan.mlo ? `${loan.mlo.firstName} ${loan.mlo.lastName}` : null,
      submittedAt: loan.submittedAt,
      updatedAt: loan.updatedAt,
      createdAt: loan.createdAt,
    }));

    return NextResponse.json({ loans: pipeline });
  } catch (error) {
    console.error('Pipeline error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
