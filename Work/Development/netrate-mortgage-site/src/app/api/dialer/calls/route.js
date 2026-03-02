// Dialer Call Logs API — List recent calls
// GET: Returns paginated call history for the MLO portal
// Auth: MLO session required

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '30', 10);
  const contactId = searchParams.get('contactId');
  const direction = searchParams.get('direction'); // 'inbound' | 'outbound'
  const skip = (page - 1) * limit;

  const where = {};

  // Admins see all calls, MLOs see only their own
  if (session.user.role !== 'admin') {
    where.mloId = session.user.id;
  }

  if (contactId) where.contactId = contactId;
  if (direction) where.direction = direction;

  try {
    const [calls, total] = await Promise.all([
      prisma.callLog.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
        include: {
          contact: {
            select: { id: true, firstName: true, lastName: true, phone: true },
          },
          notes: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          mlo: {
            select: { firstName: true, lastName: true },
          },
        },
      }),
      prisma.callLog.count({ where }),
    ]);

    return Response.json({ calls, total, page, limit });
  } catch (e) {
    console.error('Call logs fetch failed:', e);
    return Response.json({ error: 'Failed to fetch call logs' }, { status: 500 });
  }
}
