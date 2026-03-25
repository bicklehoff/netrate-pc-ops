// API: MLO Leads List
// GET /api/portal/mlo/leads
// Returns all leads with contact/MLO data, ordered by most recent first.
// Query params: ?status=, ?mloId=, ?q=

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');
    const mloId = searchParams.get('mloId');
    const q = searchParams.get('q');

    const where = {};
    if (statusFilter && statusFilter !== 'all') where.status = statusFilter;
    if (mloId) where.mloId = mloId;
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
      ];
    }

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({ leads });
  } catch (error) {
    console.error('Leads list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
