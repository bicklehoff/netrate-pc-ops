// API: MLO Document Management
// POST /api/portal/mlo/loans/:id/docs — Request a document from the borrower
// PUT /api/portal/mlo/loans/:id/docs — Upload a file (MLO-side)
// PATCH /api/portal/mlo/loans/:id/docs — Update document status (accept/reject)

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
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
      return NextResponse.json(
        { error: 'docType and label are required' },
        { status: 400 }
      );
    }

    const loan = await prisma.loan.findUnique({ where: { id } });
    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    const isAdmin = session.user.role === 'admin';
    if (!isAdmin && loan.mloId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Create the document request
    const document = await prisma.document.create({
      data: {
        loanId: id,
        docType,
        label,
        status: 'requested',
        requestedById: session.user.id,
        notes: notes || null,
      },
    });

    // Update ball-in-court (requesting a doc may shift ball to borrower)
    await prisma.loan.update({
      where: { id },
      data: {
        ballInCourt: getBallInCourt(loan.status, true),
      },
    });

    // Create audit event
    await prisma.loanEvent.create({
      data: {
        loanId: id,
        eventType: 'doc_requested',
        actorType: 'mlo',
        actorId: session.user.id,
        newValue: label,
        details: { docType, documentId: document.id },
      },
    });

    // Send doc request email to borrower (non-blocking)
    const borrower = await prisma.borrower.findUnique({ where: { id: loan.borrowerId } });
    if (borrower?.email) {
      const template = docRequestTemplate({
        firstName: borrower.firstName,
        documents: [{ label, notes: notes || null }],
        loanId: id,
      });
      sendEmail({ to: borrower.email, ...template }).catch((err) => {
        console.error('Doc request email failed:', err.message);
      });
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

    const loan = await prisma.loan.findUnique({ where: { id } });
    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    const isAdmin = session.user.role === 'admin';
    if (!isAdmin && loan.mloId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const docType = formData.get('docType') || 'other';
    const label = formData.get('label') || file?.name || 'Untitled';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // ─── File Type Validation ────────────────────────────────
    const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg'];
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();

    if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(fileExt)) {
      return NextResponse.json(
        { error: 'Only PDF, PNG, and JPG files are accepted.' },
        { status: 400 }
      );
    }

    // ─── File Size Validation (25 MB for MLO — larger than borrower) ─
    const MAX_FILE_SIZE = 25 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 25 MB limit.' },
        { status: 400 }
      );
    }

    // ─── Upload to Storage ───────────────────────────────────
    let fileUrl;
    let storageType = 'blob';

    const subfolders = loan.workDriveSubfolders;

    if (loan.workDriveFolderId && subfolders) {
      const subfolderName = getSubfolderForDocType(docType);
      const targetFolderId = subfolders[subfolderName] || loan.workDriveFolderId;

      try {
        const uploaded = await uploadFile(file, file.name, targetFolderId, true);
        fileUrl = uploaded.url || `workdrive://${uploaded.id}`;
        storageType = 'workdrive';
      } catch (wdError) {
        console.error('WorkDrive upload failed, falling back to Blob:', wdError?.message);
        const blob = await put(`loans/${id}/${file.name}`, file, {
          access: 'public',
          addRandomSuffix: true,
        });
        fileUrl = blob.url;
      }
    } else {
      const blob = await put(`loans/${id}/${file.name}`, file, {
        access: 'public',
        addRandomSuffix: true,
      });
      fileUrl = blob.url;
    }

    // Create document record
    const doc = await prisma.document.create({
      data: {
        loanId: id,
        docType,
        label,
        status: 'uploaded',
        requestedById: session.user.id,
        fileUrl,
        fileName: file.name,
        fileSize: file.size,
        uploadedAt: new Date(),
      },
    });

    // Audit trail
    await prisma.loanEvent.create({
      data: {
        loanId: id,
        eventType: 'doc_uploaded',
        actorType: 'mlo',
        actorId: session.user.id,
        newValue: label,
        details: { documentId: doc.id, fileName: file.name, storageType },
      },
    });

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
      return NextResponse.json(
        { error: 'documentId and status are required' },
        { status: 400 }
      );
    }

    const validStatuses = ['reviewed', 'accepted', 'rejected'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { loan: true },
    });

    if (!document || document.loanId !== id) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const isAdmin = session.user.role === 'admin';
    if (!isAdmin && document.loan.mloId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const updated = await prisma.document.update({
      where: { id: documentId },
      data: {
        status,
        notes: notes || document.notes,
        reviewedAt: new Date(),
      },
    });

    // Re-check pending docs to update ball-in-court
    const pendingDocs = await prisma.document.count({
      where: { loanId: id, status: 'requested' },
    });

    await prisma.loan.update({
      where: { id },
      data: {
        ballInCourt: getBallInCourt(document.loan.status, pendingDocs > 0),
      },
    });

    return NextResponse.json({ document: updated });
  } catch (error) {
    console.error('Doc review error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
