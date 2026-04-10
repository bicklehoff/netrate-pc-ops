// API: MLO Document Management
// POST /api/portal/mlo/loans/:id/docs — Request a document from the borrower
// PUT /api/portal/mlo/loans/:id/docs — Upload a file (MLO-side)
// PATCH /api/portal/mlo/loans/:id/docs — Update document status (accept/reject)

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import sql from '@/lib/db';
import { put } from '@vercel/blob';
import { getBallInCourt } from '@/lib/loan-states';
import { uploadFile, getSubfolderForDocType } from '@/lib/zoho-workdrive';
import { sendEmail } from '@/lib/resend';
import { docRequestTemplate } from '@/lib/email-templates/borrower';

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { docType, label, notes } = await request.json();

    if (!docType || !label) {
      return NextResponse.json({ error: 'docType and label are required' }, { status: 400 });
    }

    const loanRows = await sql`SELECT * FROM loans WHERE id = ${id} LIMIT 1`;
    const loan = loanRows[0];
    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    const isAdmin = session.user.role === 'admin';
    if (!isAdmin && loan.mlo_id !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Create the document request
    const docRows = await sql`
      INSERT INTO documents (id, loan_id, doc_type, label, status, requested_by, notes, created_at)
      VALUES (gen_random_uuid(), ${id}, ${docType}, ${label}, 'requested', ${session.user.id}, ${notes || null}, NOW())
      RETURNING *
    `;
    const document = docRows[0];

    // Update ball-in-court
    await sql`
      UPDATE loans SET ball_in_court = ${getBallInCourt(loan.status, true)}, updated_at = NOW() WHERE id = ${id}
    `;

    // Create audit event
    await sql`
      INSERT INTO loan_events (id, loan_id, event_type, actor_type, actor_id, new_value, details, created_at)
      VALUES (gen_random_uuid(), ${id}, 'doc_requested', 'mlo', ${session.user.id}, ${label},
              ${JSON.stringify({ docType, documentId: document.id })}, NOW())
    `;

    // Send doc request email to borrower (non-blocking)
    if (loan.borrower_id) {
      const borrowerRows = await sql`SELECT * FROM borrowers WHERE id = ${loan.borrower_id} LIMIT 1`;
      const borrower = borrowerRows[0];
      if (borrower?.email) {
        const template = docRequestTemplate({
          firstName: borrower.first_name,
          documents: [{ label, notes: notes || null }],
          loanId: id,
        });
        sendEmail({ to: borrower.email, ...template }).catch((err) => {
          console.error('Doc request email failed:', err.message);
        });
      }
    }

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    console.error('Doc request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── MLO File Upload ──────────────────────────────────────────
export async function PUT(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const loanRows = await sql`SELECT * FROM loans WHERE id = ${id} LIMIT 1`;
    const loan = loanRows[0];
    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    const isAdmin = session.user.role === 'admin';
    if (!isAdmin && loan.mlo_id !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const docType = formData.get('docType') || 'other';
    const label = formData.get('label') || file?.name || 'Untitled';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg'];
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();

    if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(fileExt)) {
      return NextResponse.json({ error: 'Only PDF, PNG, and JPG files are accepted.' }, { status: 400 });
    }

    const MAX_FILE_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 25 MB limit.' }, { status: 400 });
    }

    let fileUrl;
    let storageType = 'blob';
    const subfolders = loan.work_drive_subfolders;

    if (loan.work_drive_folder_id && subfolders) {
      const subfolderName = getSubfolderForDocType(docType);
      const targetFolderId = subfolders[subfolderName] || loan.work_drive_folder_id;

      try {
        const uploaded = await uploadFile(file, file.name, targetFolderId, true);
        fileUrl = uploaded.url || `workdrive://${uploaded.id}`;
        storageType = 'workdrive';
      } catch (wdError) {
        console.error('WorkDrive upload failed, falling back to Blob:', wdError?.message);
        const blob = await put(`loans/${id}/${file.name}`, file, { access: 'public', addRandomSuffix: true });
        fileUrl = blob.url;
      }
    } else {
      const blob = await put(`loans/${id}/${file.name}`, file, { access: 'public', addRandomSuffix: true });
      fileUrl = blob.url;
    }

    // Create document record
    const docRows = await sql`
      INSERT INTO documents (id, loan_id, doc_type, label, status, requested_by, file_url, file_name, file_size, uploaded_at, created_at)
      VALUES (gen_random_uuid(), ${id}, ${docType}, ${label}, 'uploaded', ${session.user.id}, ${fileUrl}, ${file.name}, ${file.size}, NOW(), NOW())
      RETURNING *
    `;
    const doc = docRows[0];

    // Audit trail
    await sql`
      INSERT INTO loan_events (id, loan_id, event_type, actor_type, actor_id, new_value, details, created_at)
      VALUES (gen_random_uuid(), ${id}, 'doc_uploaded', 'mlo', ${session.user.id}, ${label},
              ${JSON.stringify({ documentId: doc.id, fileName: file.name, storageType })}, NOW())
    `;

    return NextResponse.json({ document: doc });
  } catch (error) {
    console.error('MLO doc upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { documentId, status, notes } = await request.json();

    if (!documentId || !status) {
      return NextResponse.json({ error: 'documentId and status are required' }, { status: 400 });
    }

    const validStatuses = ['reviewed', 'accepted', 'rejected'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 });
    }

    // Get document with loan info
    const docRows = await sql`SELECT d.*, l.mlo_id, l.status AS loan_status FROM documents d JOIN loans l ON l.id = d.loan_id WHERE d.id = ${documentId} AND d.loan_id = ${id} LIMIT 1`;
    const document = docRows[0];

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const isAdmin = session.user.role === 'admin';
    if (!isAdmin && document.mlo_id !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const updatedRows = await sql`
      UPDATE documents SET status = ${status}, notes = ${notes || document.notes}, reviewed_at = NOW()
      WHERE id = ${documentId} RETURNING *
    `;

    // Re-check pending docs to update ball-in-court
    const pendingRows = await sql`SELECT COUNT(*)::int AS total FROM documents WHERE loan_id = ${id} AND status = 'requested'`;
    const pendingDocs = pendingRows[0].total;

    await sql`
      UPDATE loans SET ball_in_court = ${getBallInCourt(document.loan_status, pendingDocs > 0)}, updated_at = NOW() WHERE id = ${id}
    `;

    return NextResponse.json({ document: updatedRows[0] });
  } catch (error) {
    console.error('Doc review error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
