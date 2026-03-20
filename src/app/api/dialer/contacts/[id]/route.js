// Dialer Contact Detail — GET, PUT, DELETE a single contact
// Auth: MLO session required

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const contact = await prisma.contact.findUnique({
      where: { id },
      include: {
        callLogs: {
          orderBy: { startedAt: 'desc' },
          take: 20,
          include: {
            notes: true,
            mlo: { select: { firstName: true, lastName: true } },
          },
        },
        smsMessages: {
          orderBy: { sentAt: 'desc' },
          take: 50,
        },
        borrower: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            loans: {
              select: { id: true, status: true, purpose: true },
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
        },
      },
    });

    if (!contact) {
      return Response.json({ error: 'Contact not found' }, { status: 404 });
    }

    return Response.json({ contact });
  } catch (e) {
    console.error('Contact fetch failed:', e);
    return Response.json({ error: 'Failed to fetch contact' }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { firstName, lastName, email, phone, company, tags, notes } = body;

  try {
    const contact = await prisma.contact.update({
      where: { id },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(company !== undefined && { company }),
        ...(tags !== undefined && { tags }),
        ...(notes !== undefined && { notes }),
      },
    });

    return Response.json({ contact });
  } catch (e) {
    console.error('Contact update failed:', e);
    return Response.json({ error: 'Failed to update contact' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    await prisma.contact.delete({ where: { id } });
    return Response.json({ success: true });
  } catch (e) {
    console.error('Contact delete failed:', e);
    return Response.json({ error: 'Failed to delete contact' }, { status: 500 });
  }
}
