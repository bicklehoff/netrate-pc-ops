// Single Ticket API — Get, Update, Delete
// GET    /api/portal/mlo/tickets/:id
// PATCH  /api/portal/mlo/tickets/:id  { status, priority, assignedTo, title, description }
// DELETE /api/portal/mlo/tickets/:id

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      entries: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!ticket) return Response.json({ error: 'Ticket not found' }, { status: 404 });

  return Response.json({ ticket });
}

export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) return Response.json({ error: 'Ticket not found' }, { status: 404 });

  const updates = {};
  const entries = []; // Auto-log status/assignment changes

  if (body.title !== undefined) updates.title = body.title.trim();
  if (body.description !== undefined) updates.description = body.description?.trim() || null;
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.assignedTo !== undefined) {
    updates.assignedTo = body.assignedTo || null;
    if (body.assignedTo !== ticket.assignedTo) {
      entries.push({
        content: `Assigned to ${body.assignedTo || 'unassigned'}`,
        authorId: session.user.id,
        authorLabel: `${session.user.firstName} ${session.user.lastName}`,
        entryType: 'assignment',
      });
    }
  }

  if (body.status !== undefined && body.status !== ticket.status) {
    updates.status = body.status;
    if (body.status === 'resolved') updates.resolvedAt = new Date();
    if (body.status === 'closed') updates.closedAt = new Date();
    // Re-opening clears resolved/closed timestamps
    if (body.status === 'open' || body.status === 'in_progress') {
      updates.resolvedAt = null;
      updates.closedAt = null;
    }
    entries.push({
      content: `Status changed: ${ticket.status} → ${body.status}`,
      authorId: session.user.id,
      authorLabel: `${session.user.firstName} ${session.user.lastName}`,
      entryType: 'status_change',
    });
  }

  const updated = await prisma.ticket.update({
    where: { id },
    data: {
      ...updates,
      entries: entries.length > 0 ? { create: entries } : undefined,
    },
    include: {
      entries: { orderBy: { createdAt: 'asc' } },
    },
  });

  return Response.json({ ticket: updated });
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // Admin only
  if (session.user.role !== 'admin') {
    return Response.json({ error: 'Admin required' }, { status: 403 });
  }

  const { id } = await params;
  await prisma.ticket.delete({ where: { id } });

  return Response.json({ success: true });
}
