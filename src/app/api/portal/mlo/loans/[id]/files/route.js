// API: MLO WorkDrive File Browser
// GET /api/portal/mlo/loans/:id/files?folder=SUBMITTED — List folder contents
// GET /api/portal/mlo/loans/:id/files?download=fileId — Get download URL
// PUT /api/portal/mlo/loans/:id/files — Upload file to specific subfolder
// DELETE /api/portal/mlo/loans/:id/files?fileId=xxx — Delete a file
//
// Proxies WorkDrive API through MLO auth. All operations are audited.

// Allow larger file uploads (default 4.5MB is too small for docs)
export const maxDuration = 30;

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import sql from '@/lib/db';
import { listFolder, uploadFile, downloadFile, deleteResource, createLoanFolder } from '@/lib/zoho-workdrive';
import { put } from '@vercel/blob';
import { PDFDocument } from 'pdf-lib';
import { sendSms } from '@/lib/twilio-voice';

async function verifyMloAccess(loanId, session) {
  if (!session || session.user.userType !== 'mlo') return null;
  const rows = await sql`SELECT * FROM loans WHERE id = ${loanId} LIMIT 1`;
  const loan = rows[0];
  if (!loan) return null;
  const isAdmin = session.user.role === 'admin';
  if (!isAdmin && loan.mlo_id !== session.user.id) return null;
  return loan;
}

// ─── List folder contents or get download URL ─────────────────
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    const loan = await verifyMloAccess(id, session);
    if (!loan) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const downloadFileId = searchParams.get('download');
    const folderName = searchParams.get('folder');

    // Download (proxy stream)
    if (downloadFileId) {
      const { stream, contentType, contentDisposition, contentLength } = await downloadFile(downloadFileId);
      const headers = new Headers();
      if (contentType) headers.set('Content-Type', contentType);
      if (contentDisposition) headers.set('Content-Disposition', contentDisposition);
      if (contentLength) headers.set('Content-Length', contentLength);
      return new Response(stream, { headers });
    }

    // List folder contents
    if (!loan.work_drive_folder_id || !loan.work_drive_subfolders) {
      return NextResponse.json({
        files: [],
        folders: { SUBMITTED: null, EXTRA: null, CLOSING: null },
        hasWorkDrive: false,
      });
    }

    const subfolders = loan.work_drive_subfolders;

    if (folderName && subfolders[folderName]) {
      const files = await listFolder(subfolders[folderName]);
      return NextResponse.json({
        files,
        currentFolder: folderName,
        folderId: subfolders[folderName],
        hasWorkDrive: true,
      });
    }

    const allFiles = {};
    const subfolderIds = new Set(Object.values(subfolders));
    try {
      const rootContents = await listFolder(loan.work_drive_folder_id);
      allFiles['FLOOR'] = rootContents.filter(item => !item.isFolder && !subfolderIds.has(item.id));
    } catch {
      allFiles['FLOOR'] = [];
    }

    for (const [name, folderId] of Object.entries(subfolders)) {
      try {
        allFiles[name] = await listFolder(folderId);
      } catch {
        allFiles[name] = [];
      }
    }

    return NextResponse.json({
      files: allFiles,
      folders: subfolders,
      rootFolderId: loan.work_drive_folder_id,
      hasWorkDrive: true,
    });
  } catch (error) {
    console.error('WorkDrive list error:', error);
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
  }
}

// ─── Upload file to subfolder ─────────────────────────────────
export async function PUT(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    const loan = await verifyMloAccess(id, session);
    if (!loan) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    let targetFolder = formData.get('folder') || 'FLOOR';
    const docType = formData.get('docType') || 'other';

    if (targetFolder === 'FLOOR' && (docType === 'closing_disclosure' || docType === 'cd' || /closing.?disclosure|\.cd\b/i.test(file.name))) {
      targetFolder = 'CLOSING';
    }

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg'];
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
      return NextResponse.json({ error: 'Only PDF, PNG, and JPG files are accepted.' }, { status: 400 });
    }
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 25 MB limit.' }, { status: 400 });
    }

    // Convert images to PDF
    let uploadBlob = file;
    let uploadFileName = file.name;
    const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg'];
    if (IMAGE_EXTENSIONS.includes(fileExt)) {
      try {
        const imageBytes = new Uint8Array(await file.arrayBuffer());
        const pdfDoc = await PDFDocument.create();
        const image = fileExt === '.png'
          ? await pdfDoc.embedPng(imageBytes)
          : await pdfDoc.embedJpg(imageBytes);
        const { width, height } = image.scale(1);
        const page = pdfDoc.addPage([width, height]);
        page.drawImage(image, { x: 0, y: 0, width, height });
        const pdfBytes = await pdfDoc.save();
        uploadFileName = file.name.replace(/\.(png|jpg|jpeg)$/i, '.pdf');
        uploadBlob = new Blob([pdfBytes], { type: 'application/pdf' });
        uploadBlob.name = uploadFileName;
      } catch (convErr) {
        console.error('Image-to-PDF conversion failed, uploading as-is:', convErr?.message);
      }
    }

    let subfolders = loan.work_drive_subfolders;
    let fileUrl;
    let storageType = 'blob';

    // Auto-create WorkDrive folder if it doesn't exist
    if (!loan.work_drive_folder_id) {
      try {
        const borrowerRows = await sql`SELECT first_name, last_name FROM borrowers WHERE id = ${loan.borrower_id} LIMIT 1`;
        const borrower = borrowerRows[0];
        const mloRows = loan.mlo_id
          ? await sql`SELECT first_name, last_name FROM mlos WHERE id = ${loan.mlo_id} LIMIT 1`
          : [];
        const mlo = mloRows[0];
        const loName = mlo ? `${mlo.first_name} ${mlo.last_name}` : 'David Burson';

        const folder = await createLoanFolder({
          borrowerFirstName: borrower.first_name,
          borrowerLastName: borrower.last_name,
          purpose: loan.purpose || 'purchase',
          loName,
        });

        await sql`
          UPDATE loans SET work_drive_folder_id = ${folder.rootFolderId}, work_drive_subfolders = ${JSON.stringify(folder.subfolders)}, updated_at = NOW()
          WHERE id = ${loan.id}
        `;

        loan.work_drive_folder_id = folder.rootFolderId;
        subfolders = folder.subfolders;
        console.log(`Auto-created WorkDrive folder for loan ${loan.loan_number}: ${loName}/${borrower.last_name}`);
      } catch (folderErr) {
        console.error('Auto-create WorkDrive folder failed:', folderErr?.message);
      }
    }

    let targetFolderId = null;
    if (targetFolder === 'FLOOR' && loan.work_drive_folder_id) {
      targetFolderId = loan.work_drive_folder_id;
    } else if (subfolders && subfolders[targetFolder]) {
      targetFolderId = subfolders[targetFolder];
    }

    if (targetFolderId) {
      try {
        const uploaded = await uploadFile(uploadBlob, uploadFileName, targetFolderId, true);
        fileUrl = uploaded.url || `workdrive://${uploaded.id}`;
        storageType = 'workdrive';
      } catch (wdError) {
        console.error('WorkDrive upload failed:', wdError?.message);
        const blob = await put(`loans/${id}/${uploadFileName}`, uploadBlob, { access: 'public', addRandomSuffix: true });
        fileUrl = blob.url;
      }
    } else {
      const blob = await put(`loans/${id}/${uploadFileName}`, uploadBlob, { access: 'public', addRandomSuffix: true });
      fileUrl = blob.url;
    }

    // Create document record
    const docRows = await sql`
      INSERT INTO documents (id, loan_id, doc_type, label, status, requested_by, file_url, file_name, file_size, uploaded_at, created_at)
      VALUES (gen_random_uuid(), ${id}, ${docType}, ${uploadFileName}, 'uploaded', ${session.user.id}, ${fileUrl}, ${uploadFileName}, ${file.size}, NOW(), NOW())
      RETURNING *
    `;
    const doc = docRows[0];

    // Audit
    await sql`
      INSERT INTO loan_events (id, loan_id, event_type, actor_type, actor_id, new_value, details, created_at)
      VALUES (gen_random_uuid(), ${id}, 'doc_uploaded', 'mlo', ${session.user.id}, ${uploadFileName},
              ${JSON.stringify({ documentId: doc.id, fileName: uploadFileName, originalName: file.name, folder: targetFolder, storageType })},
              NOW())
    `;

    // Notify David when a CD or closing doc is uploaded
    const isClosingDoc = docType === 'closing_disclosure' || docType === 'cd' ||
      /closing.?disclosure|\.cd\b/i.test(uploadFileName) ||
      targetFolder === 'CLOSING';
    if (isClosingDoc || loan.status === 'funded') {
      const uploaderName = session.user.name || session.user.email;
      const borrowerRows = await sql`SELECT first_name, last_name FROM borrowers WHERE id = ${loan.borrower_id} LIMIT 1`;
      const borrower = borrowerRows[0];
      const borrowerName = borrower ? `${borrower.first_name} ${borrower.last_name}` : `Loan #${loan.loan_number}`;
      try {
        await sendSms(
          process.env.DAVID_PHONE || '+13034445251',
          `CD uploaded for ${borrowerName} (Loan #${loan.loan_number}) by ${uploaderName}. File: ${uploadFileName}`
        );
      } catch (smsErr) {
        console.error('CD notification SMS failed:', smsErr?.message);
      }
    }

    return NextResponse.json({ document: doc, storageType });
  } catch (error) {
    console.error('WorkDrive upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

// ─── Delete file ──────────────────────────────────────────────
export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    const loan = await verifyMloAccess(id, session);
    if (!loan) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    const fileName = searchParams.get('fileName');

    if (!fileId) {
      return NextResponse.json({ error: 'fileId is required' }, { status: 400 });
    }

    await deleteResource(fileId);

    // Audit
    await sql`
      INSERT INTO loan_events (id, loan_id, event_type, actor_type, actor_id, new_value, details, created_at)
      VALUES (gen_random_uuid(), ${id}, 'doc_deleted', 'mlo', ${session.user.id}, ${`Deleted: ${fileName || fileId}`},
              ${JSON.stringify({ action: 'delete', workDriveFileId: fileId })}, NOW())
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('WorkDrive delete error:', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
