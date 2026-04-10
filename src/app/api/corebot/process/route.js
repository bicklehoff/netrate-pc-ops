// CoreBot Process — Batch document processing
// POST /api/corebot/process
// Body: { loanId }
// Auth: MLO session
//
// Scans the loan's WorkDrive FLOOR, identifies all unprocessed files via Claude,
// renames them using the naming protocol, updates conditions, returns report.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import sql from '@/lib/db';
import { processLoanDocuments } from '@/lib/corebot/processor';

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { loanId } = await request.json();
    if (!loanId) {
      return NextResponse.json({ error: 'loanId is required' }, { status: 400 });
    }

    // Verify MLO owns this loan
    const loanRows = await sql`
      SELECT * FROM "Loan" WHERE id = ${loanId} LIMIT 1
    `;
    const loan = loanRows[0];

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    const isAdmin = session.user.role === 'admin';
    if (!isAdmin && loan.mlo_id !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const report = await processLoanDocuments(loanId, session.user.id);

    return NextResponse.json({ success: true, report });
  } catch (error) {
    console.error('CoreBot process error:', error);
    return NextResponse.json(
      { error: error.message || 'Processing failed' },
      { status: 500 }
    );
  }
}
