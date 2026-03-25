// API: Accounts (Partner Directory)
// GET  /api/portal/mlo/accounts — List accounts with contacts
// POST /api/portal/mlo/accounts — Create account
// Auth: MLO session required

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.userType === 'mlo') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || '';
    const industry = searchParams.get('industry');

    const where = {};
    if (q) {
      where.name = { contains: q, mode: 'insensitive' };
    }
    if (industry) {
      where.industry = industry;
    }

    const accounts = await prisma.account.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        accountContacts: {
          orderBy: [{ isPrimary: 'desc' }, { firstName: 'asc' }],
        },
        _count: { select: { accountContacts: true } },
      },
    });

    // Industry counts for filter badges
    const industryCounts = await prisma.account.groupBy({
      by: ['industry'],
      _count: true,
    });

    return Response.json({
      accounts,
      industryCounts: industryCounts.reduce((acc, i) => ({ ...acc, [i.industry || 'other']: i._count }), {}),
    });
  } catch (error) {
    console.error('Accounts list error:', error?.message);
    return Response.json({ error: 'Failed to load accounts' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.userType === 'mlo') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name, phone, website, industry, address, city, state, zipCode, notes, contacts } = body;

    if (!name) {
      return Response.json({ error: 'Account name is required' }, { status: 400 });
    }

    const account = await prisma.account.create({
      data: {
        name,
        phone: phone || null,
        website: website || null,
        industry: industry || 'other',
        address: address || null,
        city: city || null,
        state: state || null,
        zipCode: zipCode || null,
        notes: notes || null,
        ...(contacts?.length > 0 && {
          accountContacts: {
            createMany: {
              data: contacts.map((c, i) => ({
                firstName: c.firstName || 'Unknown',
                lastName: c.lastName || '',
                email: c.email || null,
                phone: c.phone || null,
                role: c.role || null,
                title: c.title || null,
                isPrimary: i === 0,
              })),
            },
          },
        }),
      },
      include: { accountContacts: true },
    });

    return Response.json({ success: true, account }, { status: 201 });
  } catch (error) {
    console.error('Account create error:', error?.message);
    return Response.json({ error: 'Failed to create account' }, { status: 500 });
  }
}
