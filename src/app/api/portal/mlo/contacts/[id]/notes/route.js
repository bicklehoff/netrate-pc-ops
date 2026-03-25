// API: Contact Notes
// POST /api/portal/mlo/contacts/:id/notes — Add a note to a contact
// Auth: MLO session required

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.userType === 'mlo') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { content, title } = body;

    if (!content?.trim()) {
      return Response.json({ error: 'Note content is required' }, { status: 400 });
    }

    const contact = await prisma.contact.findUnique({ where: { id } });
    if (!contact) {
      return Response.json({ error: 'Contact not found' }, { status: 404 });
    }

    const note = await prisma.contactNote.create({
      data: {
        contactId: id,
        content: content.trim(),
        title: title || null,
        authorType: 'mlo',
        authorId: session.user.id,
        source: 'manual',
      },
    });

    // Update lastContactedAt
    await prisma.contact.update({
      where: { id },
      data: { lastContactedAt: new Date() },
    });

    return Response.json({ success: true, note }, { status: 201 });
  } catch (error) {
    console.error('Add contact note error:', error?.message);
    return Response.json({ error: 'Failed to add note' }, { status: 500 });
  }
}
