// Conditions CRUD API
// GET    /api/portal/mlo/loans/:id/conditions — List all conditions
// POST   /api/portal/mlo/loans/:id/conditions — Create condition
// PATCH  /api/portal/mlo/loans/:id/conditions — Update condition status/fields
// Auth: MLO session

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

async function verifyMloAccess(loanId, session) {
  if (!session || session.user.userType !== 'mlo') return null;
  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan) return null;
  const isAdmin = session.user.role === 'admin';
  if (!isAdmin && loan.mloId !== session.user.id) return null;
  return loan;
}

// ─── List conditions ────────────────────────────────────────
export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    const loan = await verifyMloAccess(id, session);
    if (!loan) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const conditions = await prisma.condition.findMany({
      where: { loanId: id },
      orderBy: [{ stage: 'asc' }, { createdAt: 'asc' }],
    });

    return NextResponse.json({ conditions });
  } catch (error) {
    console.error('Conditions list error:', error);
    return NextResponse.json({ error: 'Failed to list conditions' }, { status: 500 });
  }
}

// ─── Create condition ───────────────────────────────────────
export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    const loan = await verifyMloAccess(id, session);
    if (!loan) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, conditionType, stage, borrowerFacing, blockingProgress, dueDate } = body;

    if (!title || !conditionType) {
      return NextResponse.json({ error: 'title and conditionType are required' }, { status: 400 });
    }

    const condition = await prisma.condition.create({
      data: {
        loanId: id,
        title,
        description: description || null,
        conditionType,
        stage: stage || 'prior_to_docs',
        status: 'needed',
        borrowerFacing: borrowerFacing || false,
        blockingProgress: blockingProgress || false,
        dueDate: dueDate ? new Date(dueDate) : null,
        ownerRole: 'mlo',
        requestedDate: new Date(),
      },
    });

    // Audit
    await prisma.loanEvent.create({
      data: {
        loanId: id,
        eventType: 'condition_created',
        actorType: 'mlo',
        actorId: session.user.id,
        details: { conditionId: condition.id, title, conditionType, stage: stage || 'prior_to_docs' },
      },
    });

    return NextResponse.json({ condition });
  } catch (error) {
    console.error('Condition create error:', error);
    return NextResponse.json({ error: 'Failed to create condition' }, { status: 500 });
  }
}

// ─── Update condition ───────────────────────────────────────
export async function PATCH(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;
    const loan = await verifyMloAccess(id, session);
    if (!loan) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { conditionId, status, notes, blockingProgress } = body;

    if (!conditionId) {
      return NextResponse.json({ error: 'conditionId is required' }, { status: 400 });
    }

    // Verify condition belongs to this loan
    const existing = await prisma.condition.findFirst({
      where: { id: conditionId, loanId: id },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Condition not found' }, { status: 404 });
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (typeof blockingProgress === 'boolean') updateData.blockingProgress = blockingProgress;

    // Append note to internal notes array
    if (notes) {
      const existingNotes = Array.isArray(existing.internalNotes) ? existing.internalNotes : [];
      updateData.internalNotes = [
        ...existingNotes,
        {
          note: notes,
          author: session.user.id,
          timestamp: new Date().toISOString(),
        },
      ];
    }

    // Set received timestamp
    if (status === 'received' && !existing.receivedAt) {
      updateData.receivedAt = new Date();
    }

    const condition = await prisma.condition.update({
      where: { id: conditionId },
      data: updateData,
    });

    // Audit
    await prisma.loanEvent.create({
      data: {
        loanId: id,
        eventType: 'condition_updated',
        actorType: 'mlo',
        actorId: session.user.id,
        details: {
          conditionId,
          changes: Object.keys(updateData),
          newStatus: status || undefined,
        },
      },
    });

    return NextResponse.json({ condition });
  } catch (error) {
    console.error('Condition update error:', error);
    return NextResponse.json({ error: 'Failed to update condition' }, { status: 500 });
  }
}
