// CoreBot Identify — Single file identification
// POST /api/corebot/identify
// Body: { loanId, fileId, fileName }
// Auth: MLO session
//
// Identifies a single file without renaming. Returns suggestion for MLO review.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { identifyFile } from '@/lib/corebot/processor';

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { loanId, fileId, fileName } = await request.json();
    if (!loanId || !fileId || !fileName) {
      return NextResponse.json({ error: 'loanId, fileId, and fileName are required' }, { status: 400 });
    }

    // Verify MLO owns this loan
    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        borrower: { select: { firstName: true, lastName: true } },
        loanBorrowers: {
          include: { borrower: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    const isAdmin = session.user.role === 'admin';
    if (!isAdmin && loan.mloId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Build context
    const loanContext = {
      borrowerFirstName: loan.borrower?.firstName,
      borrowerLastName: loan.borrower?.lastName,
      propertyAddress: loan.propertyStreet || null,
      loanType: loan.loanType || null,
      purpose: loan.purpose || null,
      lenderName: loan.lenderName || null,
    };

    if (loan.loanBorrowers?.length > 1) {
      const coBorrower = loan.loanBorrowers.find((lb) => lb.borrowerType === 'co_borrower');
      if (coBorrower?.borrower) {
        loanContext.coBorrowerFirstName = coBorrower.borrower.firstName;
        loanContext.coBorrowerLastName = coBorrower.borrower.lastName;
      }
    }

    const result = await identifyFile(fileId, fileName, loanContext);

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('CoreBot identify error:', error);
    return NextResponse.json(
      { error: error.message || 'Identification failed' },
      { status: 500 }
    );
  }
}
