// API: SSN Reveal (Audited)
// POST /api/portal/mlo/loans/:id/ssn
// Decrypts and returns the borrower's full SSN. Creates an audit log entry.
// This is the ONLY way to access the full SSN.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { decrypt } from '@/lib/encryption';

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const loan = await prisma.loan.findUnique({
      where: { id },
      include: {
        borrower: {
          select: { id: true, ssnEncrypted: true },
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

    if (!loan.borrower?.ssnEncrypted) {
      return NextResponse.json({ error: 'SSN not on file' }, { status: 404 });
    }

    // Decrypt the SSN
    const ssn = decrypt(loan.borrower.ssnEncrypted);

    // Create audit trail — this is a sensitive operation
    await prisma.loanEvent.create({
      data: {
        loanId: id,
        eventType: 'ssn_revealed',
        actorType: 'mlo',
        actorId: session.user.id,
        details: {
          borrowerId: loan.borrower.id,
          ip: request.headers.get('x-forwarded-for') || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
        },
      },
    });

    return NextResponse.json({ ssn });
  } catch (error) {
    console.error('SSN reveal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
