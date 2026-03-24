// API: MLO Contacts
// GET  /api/portal/mlo/contacts — List/search contacts
// POST /api/portal/mlo/contacts — Create a new contact
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
    const tag = searchParams.get('tag');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const skip = (page - 1) * limit;

    const where = {};

    if (q) {
      where.OR = [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
      ];
    }

    if (tag) {
      where.tags = { has: tag };
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        include: {
          borrower: {
            select: {
              id: true,
              loans: {
                select: { id: true, status: true, purpose: true, loanAmount: true, lenderName: true },
                orderBy: { createdAt: 'desc' },
                take: 3,
              },
            },
          },
        },
      }),
      prisma.contact.count({ where }),
    ]);

    return Response.json({
      contacts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Contacts list error:', error?.message);
    return Response.json({ error: 'Failed to load contacts' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.userType === 'mlo') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { firstName, lastName, email, phone, company, source, tags, notes } = body;

    if (!firstName || !lastName) {
      return Response.json({ error: 'First and last name are required' }, { status: 400 });
    }

    // Check for duplicate by email
    if (email) {
      const existing = await prisma.contact.findFirst({
        where: { email: email.toLowerCase().trim() },
      });
      if (existing) {
        return Response.json({
          error: 'A contact with this email already exists',
          existingId: existing.id,
        }, { status: 409 });
      }
    }

    const contact = await prisma.contact.create({
      data: {
        firstName,
        lastName,
        email: email ? email.toLowerCase().trim() : null,
        phone: phone || null,
        company: company || null,
        source: source || 'manual',
        tags: tags || [],
        notes: notes || null,
      },
    });

    return Response.json({ success: true, contact }, { status: 201 });
  } catch (error) {
    console.error('Contact create error:', error?.message);
    return Response.json({ error: 'Failed to create contact' }, { status: 500 });
  }
}
