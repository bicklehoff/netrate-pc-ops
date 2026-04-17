// CoreBot Rename — Manual file rename
// POST /api/corebot/rename
// Body: { loanId, fileId, newFileName }
// Auth: MLO session
//
// MLO manually renames a file, overriding CoreBot's suggestion.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import sql from '@/lib/db';
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
    const loanRows = await sql`
      SELECT * FROM loans WHERE id = ${loanId} LIMIT 1
    `;
    const loan = loanRows[0];

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    const isAdmin = session.user.role === 'admin';
    if (!isAdmin && loan.mlo_id !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const result = await renameFile(fileId, newFileName);

    // Audit trail
    await sql`
      INSERT INTO loan_events (loan_id, event_type, actor_type, actor_id, new_value, details)
      VALUES (
        ${loanId},
        'doc_renamed',
        'mlo',
        ${session.user.id},
        ${newFileName},
        ${JSON.stringify({ fileId, source: 'manual_rename' })}::jsonb
      )
    `;

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('CoreBot rename error:', error);
    return NextResponse.json(
      { error: error.message || 'Rename failed' },
      { status: 500 }
    );
  }
}
