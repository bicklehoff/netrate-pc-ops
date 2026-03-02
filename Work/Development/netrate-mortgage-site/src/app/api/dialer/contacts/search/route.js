// Dialer Contact Search — Fast typeahead search for the dialer
// Returns minimal contact data for quick lookup (used by ContactSearch component).
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
  const q = searchParams.get('q');

  if (!q || q.length < 2) {
    return Response.json({ contacts: [] });
  }

  try {
    const contacts = await prisma.contact.findMany({
      where: {
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q } },
          { company: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        company: true,
        tags: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });

    return Response.json({ contacts });
  } catch (e) {
    console.error('Contact search failed:', e);
    return Response.json({ error: 'Search failed' }, { status: 500 });
  }
}
