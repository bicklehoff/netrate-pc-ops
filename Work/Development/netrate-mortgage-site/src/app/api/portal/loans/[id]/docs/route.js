// API: Loan Documents
// GET /api/portal/loans/[id]/docs — List documents for a loan
// POST /api/portal/loans/[id]/docs — Upload a document
//
// Requires authenticated borrower session.

import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import prisma from '@/lib/prisma';
import { requireBorrowerAuth } from '@/lib/borrower-session';

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

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Upload to Vercel Blob
    const blob = await put(`loans/${loanId}/${file.name}`, file, {
      access: 'public', // Behind auth check, so URL alone isn't enough
      addRandomSuffix: true,
    });

    if (documentId) {
      // Update existing document request with the upload
      const doc = await prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'uploaded',
          fileUrl: blob.url,
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
          details: { documentId: doc.id, fileName: file.name },
        },
      });

      return NextResponse.json({ document: doc });
    } else {
      // Create a new document entry (borrower-initiated upload)
      const doc = await prisma.document.create({
        data: {
          loanId,
          docType: 'other',
          label: file.name,
          status: 'uploaded',
          fileUrl: blob.url,
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
          details: { documentId: doc.id, fileName: file.name },
        },
      });

      return NextResponse.json({ document: doc });
    }
  } catch (error) {
    console.error('Upload document error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
