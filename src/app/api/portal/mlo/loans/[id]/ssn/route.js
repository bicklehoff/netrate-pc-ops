// API: SSN Reveal (Audited)
// POST /api/portal/mlo/loans/:id/ssn
// Decrypts and returns the borrower's full SSN. Creates an audit log entry.
// This is the ONLY way to access the full SSN.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import sql from '@/lib/db';
import { decrypt } from '@/lib/encryption';

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const loanRows = await sql`
      SELECT l.*, b.id AS b_id, b.ssn_encrypted AS b_ssn_encrypted
      FROM loans l
      LEFT JOIN borrowers b ON b.id = l.borrower_id
      WHERE l.id = ${id} LIMIT 1
    `;
    const loan = loanRows[0];

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    const isAdmin = session.user.role === 'admin';
    if (!isAdmin && loan.mlo_id !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!loan.b_ssn_encrypted) {
      return NextResponse.json({ error: 'SSN not on file' }, { status: 404 });
    }

    // Decrypt the SSN
    const ssn = decrypt(loan.b_ssn_encrypted);

    // Create audit trail — this is a sensitive operation
    await sql`
      INSERT INTO loan_events (id, loan_id, event_type, actor_type, actor_id, details, created_at)
      VALUES (gen_random_uuid(), ${id}, 'ssn_revealed', 'mlo', ${session.user.id},
              ${JSON.stringify({ borrowerId: loan.b_id, ip: request.headers.get('x-forwarded-for') || 'unknown', userAgent: request.headers.get('user-agent') || 'unknown' })},
              NOW())
    `;

    return NextResponse.json({ ssn });
  } catch (error) {
    console.error('SSN reveal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
