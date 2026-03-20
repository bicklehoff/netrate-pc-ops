// CoreBot Rename — Manual file rename
// POST /api/corebot/rename
// Body: { loanId, fileId, newFileName }
// Auth: MLO session
//
// MLO manually renames a file, overriding CoreBot's suggestion.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { renameFile } from '@/lib/zoho-workdrive';

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { loanId, fileId, newFileName } = await request.json();
    if (!loanId || !fileId || !newFileName) {
      return NextResponse.json({ error: 'loanId, fileId, and newFileName are required' }, { status: 400 });
    }

    // Verify MLO owns this loan
    const loan = await prisma.loan.findUnique({ where: { id: loanId } });
    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    const isAdmin = session.user.role === 'admin';
    if (!isAdmin && loan.mloId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const result = await renameFile(fileId, newFileName);

    // Audit trail
    await prisma.loanEvent.create({
      data: {
        loanId,
        eventType: 'doc_renamed',
        actorType: 'mlo',
        actorId: session.user.id,
        newValue: newFileName,
        details: { fileId, source: 'manual_rename' },
      },
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('CoreBot rename error:', error);
    return NextResponse.json(
      { error: error.message || 'Rename failed' },
      { status: 500 }
    );
  }
}
