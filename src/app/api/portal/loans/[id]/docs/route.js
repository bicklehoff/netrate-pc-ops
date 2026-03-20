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
import prisma from '@/lib/prisma';
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
    const loan = await prisma.loan.findFirst({
      where: { id: loanId, borrowerId: session.borrowerId },
    });

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    const documents = await prisma.document.findMany({
      where: { loanId },
      orderBy: { createdAt: 'desc' },
    });

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
    const loan = await prisma.loan.findFirst({
      where: { id: loanId, borrowerId: session.borrowerId },
    });

    if (!loan) {
      return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const documentId = formData.get('documentId'); // If uploading to a requested doc
    const docType = formData.get('docType') || 'other'; // For subfolder routing

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

    // ─── File Size Validation (10 MB max) ────────────────────
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds 10 MB limit.' },
        { status: 400 }
      );
    }

    // ─── Upload to Storage ───────────────────────────────────
    // Primary: Zoho WorkDrive (if loan has folder IDs)
    // Fallback: Vercel Blob (if WorkDrive not set up yet)
    let fileUrl;
    let storageType = 'blob'; // Track where the file went

    const subfolders = loan.workDriveSubfolders;

    if (loan.workDriveFolderId && subfolders) {
      // Route to correct subfolder based on doc type
      // If uploading to an existing document request, use that doc's type
      let effectiveDocType = docType;
      if (documentId) {
        const existingDoc = await prisma.document.findUnique({
          where: { id: documentId },
          select: { docType: true },
        });
        if (existingDoc?.docType) {
          effectiveDocType = existingDoc.docType;
        }
      }

      const subfolderName = getSubfolderForDocType(effectiveDocType);
      const targetFolderId = subfolders[subfolderName] || loan.workDriveFolderId;

      try {
        const uploaded = await uploadFile(file, file.name, targetFolderId, true);
        fileUrl = uploaded.url || `workdrive://${uploaded.id}`;
        storageType = 'workdrive';
        console.log(`Doc uploaded to WorkDrive: ${file.name} → ${subfolderName} (${uploaded.id})`);
      } catch (wdError) {
        // WorkDrive failed — fall back to Vercel Blob
        console.error('WorkDrive upload failed, falling back to Blob:', wdError?.message);
        const blob = await put(`loans/${loanId}/${file.name}`, file, {
          access: 'public',
          addRandomSuffix: true,
        });
        fileUrl = blob.url;
      }
    } else {
      // No WorkDrive folder — use Vercel Blob
      const blob = await put(`loans/${loanId}/${file.name}`, file, {
        access: 'public',
        addRandomSuffix: true,
      });
      fileUrl = blob.url;
    }

    if (documentId) {
      // Update existing document request with the upload
      const doc = await prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'uploaded',
          fileUrl,
          fileName: file.name,
          fileSize: file.size,
          uploadedAt: new Date(),
        },
      });

      // Audit trail
      await prisma.loanEvent.create({
        data: {
          loanId,
          eventType: 'doc_uploaded',
          actorType: 'borrower',
          actorId: session.borrowerId,
          newValue: doc.label,
          details: { documentId: doc.id, fileName: file.name, storageType },
        },
      });

      return NextResponse.json({ document: doc });
    } else {
      // Create a new document entry (borrower-initiated upload)
      const doc = await prisma.document.create({
        data: {
          loanId,
          docType: docType || 'other',
          label: file.name,
          status: 'uploaded',
          fileUrl,
          fileName: file.name,
          fileSize: file.size,
          uploadedAt: new Date(),
        },
      });

      // Audit trail
      await prisma.loanEvent.create({
        data: {
          loanId,
          eventType: 'doc_uploaded',
          actorType: 'borrower',
          actorId: session.borrowerId,
          newValue: file.name,
          details: { documentId: doc.id, fileName: file.name, storageType },
        },
      });

      return NextResponse.json({ document: doc });
    }
  } catch (error) {
    console.error('Upload document error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
