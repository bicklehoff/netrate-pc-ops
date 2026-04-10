// Borrower Checklist API
// GET /api/portal/loans/:id/checklist
// Auth: Borrower session
//
// Returns a simple checklist combining: doc requests, borrower-facing conditions,
// and submission checklist items. Borrower sees what's needed and what's received.

import { NextResponse } from 'next/server';
import { getBorrowerSession } from '@/lib/borrower-session';
import sql from '@/lib/db';

export async function GET(request, { params }) {
  try {
    const session = await getBorrowerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify borrower is associated with this loan (primary or co-borrower)
    const loanBorrower = await sql`
      SELECT id FROM loan_borrowers WHERE loan_id = ${id} AND borrower_id = ${session.borrowerId} LIMIT 1
    `;

    if (!loanBorrower[0]) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    // Load loan with documents and borrower-facing conditions
    const [loanRows, documents, conditions] = await Promise.all([
      sql`SELECT id FROM loans WHERE id = ${id} LIMIT 1`,
      sql`SELECT * FROM documents WHERE loan_id = ${id} ORDER BY created_at DESC`,
      sql`SELECT * FROM conditions WHERE loan_id = ${id} AND borrower_facing = true ORDER BY created_at ASC`,
    ]);

    if (!loanRows[0]) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    const checklist = [];

    // Add document requests
    for (const doc of documents) {
      const isNeeded = doc.status === 'requested' || doc.status === 'rejected';
      const isReceived = ['uploaded', 'reviewed', 'accepted'].includes(doc.status);

      checklist.push({
        id: doc.id,
        type: 'document',
        label: doc.label,
        notes: doc.notes || null,
        status: isNeeded ? 'needed' : isReceived ? 'received' : doc.status,
        canUpload: isNeeded,
        fileName: doc.file_name || null,
        rejectedReason: doc.status === 'rejected' ? (doc.notes || 'Please resubmit') : null,
      });
    }

    // Add borrower-facing conditions
    for (const cond of conditions) {
      const alreadyInList = checklist.some(
        (item) => item.label.toLowerCase() === cond.title.toLowerCase()
      );
      if (alreadyInList) continue;

      const isNeeded = ['needed', 'requested', 're_requested'].includes(cond.status);
      const isReceived = ['received', 'submitted', 'cleared', 'waived'].includes(cond.status);

      checklist.push({
        id: cond.id,
        type: 'condition',
        label: cond.title,
        notes: cond.description || null,
        status: isNeeded ? 'needed' : isReceived ? 'received' : cond.status,
        canUpload: isNeeded,
        fileName: cond.file_name || null,
        rejectedReason: null,
      });
    }

    // Sort: needed items first, then received
    checklist.sort((a, b) => {
      if (a.status === 'needed' && b.status !== 'needed') return -1;
      if (a.status !== 'needed' && b.status === 'needed') return 1;
      return 0;
    });

    const needed = checklist.filter((i) => i.status === 'needed').length;
    const received = checklist.filter((i) => i.status === 'received').length;

    return NextResponse.json({
      checklist,
      summary: { total: checklist.length, needed, received },
    });
  } catch (error) {
    console.error('Borrower checklist error:', error);
    return NextResponse.json({ error: 'Failed to load checklist' }, { status: 500 });
  }
}
