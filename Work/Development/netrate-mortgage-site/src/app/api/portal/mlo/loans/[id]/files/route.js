// API: MLO WorkDrive File Browser
// GET /api/portal/mlo/loans/:id/files?folder=SUBMITTED — List folder contents
// GET /api/portal/mlo/loans/:id/files?download=fileId — Get download URL
// PUT /api/portal/mlo/loans/:id/files — Upload file to specific subfolder
// DELETE /api/portal/mlo/loans/:id/files?fileId=xxx — Delete a file
//
// Proxies WorkDrive API through MLO auth. All operations are audited.

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { listFolder, uploadFile, downloadFile, deleteResource } from '@/lib/zoho-workdrive';
import { put } from '@vercel/blob';
import { PDFDocument } from 'pdf-lib';

async function verifyMloAccess(loanId, session) {
  if (!session || session.user.userType !== 'mlo') return null;
  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan) return null;
  const isAdmin = session.user.role === 'admin';
  if (!isAdmin && loan.mloId !== session.user.id) return null;
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

    // ─── Download (proxy stream) ───────────────────────────
    if (downloadFileId) {
      const { stream, contentType, contentDisposition, contentLength } = await downloadFile(downloadFileId);
      const headers = new Headers();
      if (contentType) headers.set('Content-Type', contentType);
      if (contentDisposition) headers.set('Content-Disposition', contentDisposition);
      if (contentLength) headers.set('Content-Length', contentLength);
      return new Response(stream, { headers });
    }

    // ─── List folder contents ──────────────────────────────
    if (!loan.workDriveFolderId || !loan.workDriveSubfolders) {
      return NextResponse.json({
        files: [],
        folders: { SUBMITTED: null, EXTRA: null, CLOSING: null },
        hasWorkDrive: false,
      });
    }

    const subfolders = loan.workDriveSubfolders;

    // If specific subfolder requested, list that one
    if (folderName && subfolders[folderName]) {
      const files = await listFolder(subfolders[folderName]);
      return NextResponse.json({
        files,
        currentFolder: folderName,
        folderId: subfolders[folderName],
        hasWorkDrive: true,
      });
    }

    // List all folders' contents including FLOOR (root folder files)
    const allFiles = {};

    // FLOOR = files in root loan folder (excluding subfolder directories)
    const subfolderIds = new Set(Object.values(subfolders));
    try {
      const rootContents = await listFolder(loan.workDriveFolderId);
      allFiles['FLOOR'] = rootContents.filter(item => !item.isFolder && !subfolderIds.has(item.id));
    } catch {
      allFiles['FLOOR'] = [];
    }

    // Subfolders (SUBMITTED, EXTRA, CLOSING)
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
      rootFolderId: loan.workDriveFolderId,
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
    const targetFolder = formData.get('folder') || 'FLOOR';
    const docType = formData.get('docType') || 'other';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // File validation
    const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg'];
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
      return NextResponse.json({ error: 'Only PDF, PNG, and JPG files are accepted.' }, { status: 400 });
    }
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 25 MB limit.' }, { status: 400 });
    }

    // Convert images to PDF for lender-ready storage
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

    const subfolders = loan.workDriveSubfolders;
    let fileUrl;
    let storageType = 'blob';

    // Determine target folder ID: FLOOR = root folder, others = subfolder
    let targetFolderId = null;
    if (targetFolder === 'FLOOR' && loan.workDriveFolderId) {
      targetFolderId = loan.workDriveFolderId;
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
    const doc = await prisma.document.create({
      data: {
        loanId: id,
        docType,
        label: uploadFileName,
        status: 'uploaded',
        requestedById: session.user.id,
        fileUrl,
        fileName: uploadFileName,
        fileSize: file.size,
        uploadedAt: new Date(),
      },
    });

    // Audit
    await prisma.loanEvent.create({
      data: {
        loanId: id,
        eventType: 'doc_uploaded',
        actorType: 'mlo',
        actorId: session.user.id,
        newValue: uploadFileName,
        details: { documentId: doc.id, fileName: uploadFileName, originalName: file.name, folder: targetFolder, storageType },
      },
    });

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
    await prisma.loanEvent.create({
      data: {
        loanId: id,
        eventType: 'doc_deleted',
        actorType: 'mlo',
        actorId: session.user.id,
        newValue: `Deleted: ${fileName || fileId}`,
        details: { action: 'delete', workDriveFileId: fileId },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('WorkDrive delete error:', error);
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 });
  }
}
