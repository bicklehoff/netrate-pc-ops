// API: MLO Pipeline
// GET  /api/portal/mlo/pipeline — List all loans with inline-editable fields
// PATCH /api/portal/mlo/pipeline — Bulk update loans (status, mloId)
//
// Returns all loans for the authenticated MLO (or all loans if admin).
// Includes borrower name, status, ball-in-court, pending doc count, and
// editable fields (loanNumber, lenderName, mloId).

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getBallInCourt } from '@/lib/loan-states';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = session.user.role === 'admin';

    const loans = await prisma.loan.findMany({
      where: isAdmin ? {} : { mloId: session.user.id },
      include: {
        borrower: {
          select: { firstName: true, lastName: true, email: true, ssnLastFour: true },
        },
        documents: {
          select: { id: true, status: true },
        },
        mlo: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Transform for the pipeline table
    const pipeline = loans.map((loan) => ({
      id: loan.id,
      borrowerName: `${loan.borrower.firstName} ${loan.borrower.lastName}`,
      borrowerEmail: loan.borrower.email,
      ssnLastFour: loan.borrower.ssnLastFour,
      status: loan.status,
      ballInCourt: loan.ballInCourt,
      purpose: loan.purpose,
      propertyType: loan.propertyType,
      purchasePrice: loan.purchasePrice ? Number(loan.purchasePrice) : null,
      estimatedValue: loan.estimatedValue ? Number(loan.estimatedValue) : null,
      loanAmount: loan.loanAmount ? Number(loan.loanAmount) : null,
      loanNumber: loan.loanNumber,
      lenderName: loan.lenderName,
      propertyStreet: loan.propertyAddress?.street || null,
      mloId: loan.mloId,
      mloName: loan.mlo ? `${loan.mlo.firstName} ${loan.mlo.lastName}` : null,
      pendingDocs: loan.documents.filter((d) => d.status === 'requested').length,
      totalDocs: loan.documents.length,
      submittedAt: loan.submittedAt,
      updatedAt: loan.updatedAt,
      createdAt: loan.createdAt,
    }));

    return NextResponse.json({ loans: pipeline });
  } catch (error) {
    console.error('Pipeline error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── Bulk Update ─────────────────────────────────────────────
// Body: { loanIds: string[], updates: { status?, mloId? } }
// Creates audit events for each loan updated.

export async function PATCH(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { loanIds, updates } = body;

    if (!loanIds || !Array.isArray(loanIds) || loanIds.length === 0) {
      return NextResponse.json({ error: 'loanIds array is required' }, { status: 400 });
    }
    if (!updates || typeof updates !== 'object') {
      return NextResponse.json({ error: 'updates object is required' }, { status: 400 });
    }

    // Only allow specific fields for bulk update
    const allowedFields = ['status', 'mloId'];
    const updateKeys = Object.keys(updates).filter((k) => allowedFields.includes(k));
    if (updateKeys.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const isAdmin = session.user.role === 'admin';

    // Verify access to all loans
    const loans = await prisma.loan.findMany({
      where: { id: { in: loanIds } },
    });

    if (loans.length !== loanIds.length) {
      return NextResponse.json({ error: 'One or more loans not found' }, { status: 404 });
    }

    if (!isAdmin) {
      const unauthorized = loans.find((l) => l.mloId !== session.user.id);
      if (unauthorized) {
        return NextResponse.json({ error: 'Unauthorized access to one or more loans' }, { status: 403 });
      }
    }

    // Update each loan individually (for audit trail with old/new values)
    let updatedCount = 0;
    for (const loan of loans) {
      const data = {};
      const events = [];

      if (updates.status && updates.status !== loan.status) {
        const pendingDocs = await prisma.document.count({
          where: { loanId: loan.id, status: 'requested' },
        });
        data.status = updates.status;
        data.ballInCourt = getBallInCourt(updates.status, pendingDocs > 0) || 'none';
        events.push({
          loanId: loan.id,
          eventType: 'status_change',
          actorType: 'mlo',
          actorId: session.user.id,
          oldValue: loan.status,
          newValue: updates.status,
          details: { source: 'bulk_update' },
        });
      }

      if (updates.mloId !== undefined && updates.mloId !== loan.mloId) {
        data.mloId = updates.mloId || null;
        events.push({
          loanId: loan.id,
          eventType: 'field_updated',
          actorType: 'mlo',
          actorId: session.user.id,
          oldValue: loan.mloId,
          newValue: updates.mloId || null,
          details: { field: 'mloId', source: 'bulk_update' },
        });
      }

      if (Object.keys(data).length > 0) {
        await prisma.loan.update({ where: { id: loan.id }, data });
        for (const event of events) {
          await prisma.loanEvent.create({ data: event });
        }
        updatedCount++;
      }
    }

    return NextResponse.json({ success: true, updatedCount });
  } catch (error) {
    console.error('Bulk update error:', error);
    return NextResponse.json({ error: 'Bulk update failed' }, { status: 500 });
  }
}

// ─── Bulk Delete ─────────────────────────────────────────────
// Body: { loanIds: string[] }
// Admin only. Deletes loans and associated records.

export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required for delete' }, { status: 403 });
    }

    const body = await request.json();
    const { loanIds } = body;

    if (!loanIds || !Array.isArray(loanIds) || loanIds.length === 0) {
      return NextResponse.json({ error: 'loanIds array is required' }, { status: 400 });
    }

    // Delete associated records first (non-cascade), then loans (cascade handles the rest)
    await prisma.condition.deleteMany({ where: { loanId: { in: loanIds } } }).catch(() => {});
    await prisma.loanEvent.deleteMany({ where: { loanId: { in: loanIds } } }).catch(() => {});
    await prisma.document.deleteMany({ where: { loanId: { in: loanIds } } }).catch(() => {});

    const result = await prisma.loan.deleteMany({ where: { id: { in: loanIds } } });

    return NextResponse.json({ success: true, deletedCount: result.count });
  } catch (error) {
    console.error('Bulk delete error:', error);
    return NextResponse.json({ error: 'Bulk delete failed' }, { status: 500 });
  }
}
