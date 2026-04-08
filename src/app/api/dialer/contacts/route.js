// Dialer Contacts API — CRUD for contacts
// GET: List/search contacts
// POST: Create a new contact
// Auth: MLO session required

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { normalizePhone } from '@/lib/normalize-phone';

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');           // Search query
  const tag = searchParams.get('tag');       // Filter by tag
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const skip = (page - 1) * limit;

  const where = {};

  // Full-text search across name, email, phone
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q } },
      { company: { contains: q, mode: 'insensitive' } },
    ];
  }

  if (tag) {
    where.tags = { has: tag };
  }

  try {
    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: { select: { callLogs: true, smsMessages: true } },
        },
      }),
      prisma.contact.count({ where }),
    ]);

    return Response.json({ contacts, total, page, limit });
  } catch (e) {
    console.error('Contacts fetch failed:', e);
    return Response.json({ error: 'Failed to fetch contacts' }, { status: 500 });
  }
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { firstName, lastName, email, phone, company, source, tags, notes, borrowerId } = body;

  if (!firstName || !lastName) {
    return Response.json({ error: 'First and last name required' }, { status: 400 });
  }

  try {
    const contact = await prisma.contact.create({
      data: {
        firstName,
        lastName,
        email: email || null,
        phone: normalizePhone(phone) || phone || null,
        company: company || null,
        source: source || 'manual',
        tags: tags || [],
        notes: notes || null,
        borrowerId: borrowerId || null,
      },
    });

    return Response.json({ contact }, { status: 201 });
  } catch (e) {
    console.error('Contact create failed:', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
