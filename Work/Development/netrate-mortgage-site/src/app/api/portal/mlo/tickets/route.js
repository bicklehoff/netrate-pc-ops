// Tickets API — List + Create
// GET  /api/portal/mlo/tickets?product=&status=&type=&priority=
// POST /api/portal/mlo/tickets  { title, description, product, ticketType, priority, assignedTo }

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const product = searchParams.get('product');
  const status = searchParams.get('status');
  const ticketType = searchParams.get('type');
  const priority = searchParams.get('priority');

  const where = {};
  if (product && product !== 'all') where.product = product;
  if (status && status !== 'all') where.status = status;
  if (ticketType && ticketType !== 'all') where.ticketType = ticketType;
  if (priority && priority !== 'all') where.priority = priority;

  try {
    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        entries: {
          orderBy: { createdAt: 'desc' },
          take: 1, // Latest entry for preview
        },
        _count: { select: { entries: true } },
      },
      orderBy: [
        { status: 'asc' },
        { priority: 'asc' },
        { createdAt: 'desc' },
      ],
    });

    return Response.json({ tickets });
  } catch (error) {
    console.error('Tickets API error:', error);
    return Response.json({ error: error.message, tickets: [] }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { title, description, product, ticketType, priority, assignedTo } = body;

  if (!title?.trim()) return Response.json({ error: 'Title is required' }, { status: 400 });
  if (!product) return Response.json({ error: 'Product is required' }, { status: 400 });
  if (!ticketType) return Response.json({ error: 'Type is required' }, { status: 400 });

  const validProducts = ['website', 'portal', 'corebot'];
  const validTypes = ['bug', 'feature', 'improvement'];
  const validPriorities = ['critical', 'high', 'medium', 'low'];

  if (!validProducts.includes(product)) return Response.json({ error: 'Invalid product' }, { status: 400 });
  if (!validTypes.includes(ticketType)) return Response.json({ error: 'Invalid type' }, { status: 400 });
  if (priority && !validPriorities.includes(priority)) return Response.json({ error: 'Invalid priority' }, { status: 400 });

  const ticket = await prisma.ticket.create({
    data: {
      title: title.trim(),
      description: description?.trim() || null,
      product,
      ticketType,
      priority: priority || 'medium',
      status: 'open',
      createdBy: session.user.id,
      assignedTo: assignedTo || null,
    },
  });

  return Response.json({ ticket }, { status: 201 });
}
