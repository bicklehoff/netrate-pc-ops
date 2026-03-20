// Dialer Call Notes API — Add/list notes for a specific call
// GET: List notes for a call
// POST: Add a note to a call (with optional disposition)
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
    const notes = await prisma.callNote.findMany({
      where: { callLogId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        mlo: { select: { firstName: true, lastName: true } },
      },
    });

    return Response.json({ notes });
  } catch (e) {
    console.error('Call notes fetch failed:', e);
    return Response.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { content, disposition } = body;

  if (!content) {
    return Response.json({ error: 'Note content required' }, { status: 400 });
  }

  const validDispositions = ['interested', 'callback', 'not_interested', 'wrong_number', 'voicemail', 'no_answer'];
  if (disposition && !validDispositions.includes(disposition)) {
    return Response.json({ error: `Invalid disposition. Must be one of: ${validDispositions.join(', ')}` }, { status: 400 });
  }

  try {
    const note = await prisma.callNote.create({
      data: {
        callLogId: id,
        mloId: session.user.id,
        content,
        disposition: disposition || null,
      },
      include: {
        mlo: { select: { firstName: true, lastName: true } },
      },
    });

    return Response.json({ note }, { status: 201 });
  } catch (e) {
    console.error('Call note create failed:', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
