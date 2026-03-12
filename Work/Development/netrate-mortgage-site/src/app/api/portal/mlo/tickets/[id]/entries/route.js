// Ticket Entries API — Add comment to a ticket
// POST /api/portal/mlo/tickets/:id/entries  { content }

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  if (!body.content?.trim()) {
    return Response.json({ error: 'Content is required' }, { status: 400 });
  }

  // Verify ticket exists
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) return Response.json({ error: 'Ticket not found' }, { status: 404 });

  const entry = await prisma.ticketEntry.create({
    data: {
      ticketId: id,
      content: body.content.trim(),
      authorId: session.user.id,
      authorLabel: `${session.user.firstName} ${session.user.lastName}`,
      entryType: 'comment',
    },
  });

  // Touch the ticket's updatedAt
  await prisma.ticket.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  return Response.json({ entry }, { status: 201 });
}
