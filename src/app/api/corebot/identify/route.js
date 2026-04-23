// CoreBot Identify — Single file identification
// POST /api/corebot/identify
// Body: { loanId, fileId, fileName }
// Auth: MLO session
//
// Identifies a single file without renaming. Returns suggestion for MLO review.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import sql from '@/lib/db';
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

    // Verify MLO owns this loan (with borrower contact + loanBorrowers)
    const loanRows = await sql`
      SELECT l.*,
             b.first_name AS borrower_first_name,
             b.last_name AS borrower_last_name
      FROM loans l
      LEFT JOIN contacts b ON b.id = l.contact_id
      WHERE l.id = ${loanId}
      LIMIT 1
    `;
    const loan = loanRows[0];

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    const isAdmin = session.user.role === 'admin';
    if (!isAdmin && loan.mlo_id !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Fetch loan participants for co-borrower context (post-D9e, reads
    // from the authoritative loan_participants junction instead of the
    // retiring loan_borrowers snapshot table).
    const loanBorrowers = await sql`
      SELECT lp.role AS borrower_type,
             b.first_name, b.last_name
      FROM loan_participants lp
      JOIN contacts b ON b.id = lp.contact_id
      WHERE lp.loan_id = ${loanId}
        AND lp.role IN ('primary_borrower', 'co_borrower')
    `;

    // Build context
    const loanContext = {
      borrowerFirstName: loan.borrower_first_name,
      borrowerLastName: loan.borrower_last_name,
      propertyAddress: loan.property_street || null,
      loanType: loan.loan_type || null,
      purpose: loan.purpose || null,
      lenderName: loan.lender_name || null,
    };

    if (loanBorrowers.length > 1) {
      const coBorrower = loanBorrowers.find((lb) => lb.borrower_type === 'co_borrower');
      if (coBorrower) {
        loanContext.coBorrowerFirstName = coBorrower.first_name;
        loanContext.coBorrowerLastName = coBorrower.last_name;
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
