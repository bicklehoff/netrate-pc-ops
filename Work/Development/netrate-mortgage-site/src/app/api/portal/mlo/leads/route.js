// API: MLO Leads List
// GET /api/portal/mlo/leads
// Returns all leads, ordered by most recent first.
// Optional ?status= query param to filter.

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

    const where = statusFilter && statusFilter !== 'all'
      ? { status: statusFilter }
      : {};

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ leads });
  } catch (error) {
    console.error('Leads list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
