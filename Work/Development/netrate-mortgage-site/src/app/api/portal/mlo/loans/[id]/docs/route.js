// API: MLO Document Management
// POST /api/portal/mlo/loans/:id/docs — Request a document from the borrower
// PATCH /api/portal/mlo/loans/:id/docs — Update document status (accept/reject)

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getBallInCourt } from '@/lib/loan-states';

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

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    console.error('Doc request error:', error);
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
