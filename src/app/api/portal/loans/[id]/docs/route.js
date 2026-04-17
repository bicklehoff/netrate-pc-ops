// API: Loan Documents
// GET /api/portal/loans/[id]/docs — List documents for a loan
// POST /api/portal/loans/[id]/docs — Upload a document
//
// Uploads go to Zoho WorkDrive (loan folder → subfolder by doc type).
// Falls back to Vercel Blob if WorkDrive folder doesn't exist yet.
//
// Requires authenticated borrower session.

import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import sql from '@/lib/db';
import { requireBorrowerAuth } from '@/lib/borrower-session';
import { uploadFile, getSubfolderForDocType } from '@/lib/zoho-workdrive';

export async function GET(request, { params }) {
  try {
    const session = await requireBorrowerAuth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: loanId } = await params;

    // Verify borrower owns this loan
    const loanRows = await sql`SELECT id FROM loans WHERE id = ${loanId} AND contact_id = ${session.contactId} LIMIT 1`;
    if (!loanRows[0]) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    const documents = await sql`SELECT * FROM documents WHERE loan_id = ${loanId} ORDER BY created_at DESC`;

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('Get documents error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    const session = await requireBorrowerAuth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: loanId } = await params;

    // Verify borrower owns this loan
    const loanRows = await sql`
      SELECT id, work_drive_folder_id, work_drive_subfolders FROM loans
      WHERE id = ${loanId} AND contact_id = ${session.contactId} LIMIT 1
    `;
    const loan = loanRows[0];
    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const documentId = formData.get('documentId');
    const docType = formData.get('docType') || 'other';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // ─── File Type Validation ────────────────────────────────
    const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg'];
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();

    if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(fileExt)) {
      return NextResponse.json({ error: 'Only PDF, PNG, and JPG files are accepted.' }, { status: 400 });
    }

    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 10 MB limit.' }, { status: 400 });
    }

    // ─── Upload to Storage ───────────────────────────────────
    let fileUrl;
    let storageType = 'blob';

    const subfolders = loan.work_drive_subfolders;

    if (loan.work_drive_folder_id && subfolders) {
      let effectiveDocType = docType;
      if (documentId) {
        const existingDoc = await sql`SELECT doc_type FROM documents WHERE id = ${documentId} LIMIT 1`;
        if (existingDoc[0]?.doc_type) effectiveDocType = existingDoc[0].doc_type;
      }

      const subfolderName = getSubfolderForDocType(effectiveDocType);
      const targetFolderId = subfolders[subfolderName] || loan.work_drive_folder_id;

      try {
        const uploaded = await uploadFile(file, file.name, targetFolderId, true);
        fileUrl = uploaded.url || `workdrive://${uploaded.id}`;
        storageType = 'workdrive';
        console.log(`Doc uploaded to WorkDrive: ${file.name} → ${subfolderName} (${uploaded.id})`);
      } catch (wdError) {
        console.error('WorkDrive upload failed, falling back to Blob:', wdError?.message);
        const blob = await put(`loans/${loanId}/${file.name}`, file, { access: 'public', addRandomSuffix: true });
        fileUrl = blob.url;
      }
    } else {
      const blob = await put(`loans/${loanId}/${file.name}`, file, { access: 'public', addRandomSuffix: true });
      fileUrl = blob.url;
    }

    if (documentId) {
      // Update existing document request with the upload
      const docRows = await sql`
        UPDATE documents SET status = 'uploaded', file_url = ${fileUrl}, file_name = ${file.name},
          file_size = ${file.size}, uploaded_at = NOW()
        WHERE id = ${documentId}
        RETURNING *
      `;
      const doc = docRows[0];

      await sql`
        INSERT INTO loan_events (loan_id, event_type, actor_type, actor_id, new_value, details, created_at)
        VALUES (${loanId}, 'doc_uploaded', 'borrower', ${session.contactId}, ${doc.label},
          ${JSON.stringify({ documentId: doc.id, fileName: file.name, storageType })}::jsonb, NOW())
      `;

      return NextResponse.json({ document: doc });
    } else {
      // Create a new document entry (borrower-initiated upload)
      const docRows = await sql`
        INSERT INTO documents (loan_id, doc_type, label, status, file_url, file_name, file_size, uploaded_at, created_at)
        VALUES (${loanId}, ${docType || 'other'}, ${file.name}, 'uploaded', ${fileUrl}, ${file.name}, ${file.size}, NOW(), NOW())
        RETURNING *
      `;
      const doc = docRows[0];

      await sql`
        INSERT INTO loan_events (loan_id, event_type, actor_type, actor_id, new_value, details, created_at)
        VALUES (${loanId}, 'doc_uploaded', 'borrower', ${session.contactId}, ${file.name},
          ${JSON.stringify({ documentId: doc.id, fileName: file.name, storageType })}::jsonb, NOW())
      `;

      return NextResponse.json({ document: doc });
    }
  } catch (error) {
    console.error('Upload document error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
