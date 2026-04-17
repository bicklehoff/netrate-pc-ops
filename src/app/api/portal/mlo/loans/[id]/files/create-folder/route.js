// Create WorkDrive folder for a loan that doesn't have one
// POST /api/portal/mlo/loans/:id/files/create-folder
// Auth: MLO session
//
// Creates the full folder structure (SUBMITTED, EXTRA, CLOSING)
// and links it to the loan record.

import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { createLoanFolder } from '@/lib/zoho-workdrive';
import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';

export async function POST(request, { params }) {
  try {
    const { session, orgId, mloId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const { id } = await params;

    const loanRows = await sql`
      SELECT l.*, b.first_name AS b_first_name, b.last_name AS b_last_name
      FROM loans l
      LEFT JOIN contacts b ON b.id = l.contact_id
      WHERE l.id = ${id} AND l.organization_id = ${orgId} LIMIT 1
    `;
    const loan = loanRows[0];

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    const isAdmin = session.user.role === 'admin';
    if (!isAdmin && loan.mlo_id !== mloId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (loan.work_drive_folder_id) {
      return NextResponse.json({ error: 'Loan already has a WorkDrive folder' }, { status: 400 });
    }

    if (!loan.b_first_name || !loan.b_last_name) {
      return NextResponse.json({ error: 'Borrower name is required to create folder' }, { status: 400 });
    }

    // Create folder structure in WorkDrive
    const folder = await createLoanFolder({
      borrowerFirstName: loan.b_first_name,
      borrowerLastName: loan.b_last_name,
      purpose: loan.purpose || 'purchase',
    });

    // Link folder to loan
    await sql`
      UPDATE loans SET work_drive_folder_id = ${folder.rootFolderId}, work_drive_subfolders = ${JSON.stringify(folder.subfolders)}, updated_at = NOW()
      WHERE id = ${id}
    `;

    // Audit
    await sql`
      INSERT INTO loan_events (id, loan_id, event_type, actor_type, actor_id, details, created_at)
      VALUES (gen_random_uuid(), ${id}, 'workdrive_folder_created', 'mlo', ${mloId},
              ${JSON.stringify({ folderId: folder.rootFolderId, subfolders: folder.subfolders })}, NOW())
    `;

    return NextResponse.json({
      success: true,
      folderId: folder.rootFolderId,
      subfolders: folder.subfolders,
    });
  } catch (error) {
    console.error('Create folder error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create folder' },
      { status: 500 }
    );
  }
}
