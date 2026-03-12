// Ticket Entries API — Add comment (with optional image) to a ticket
// POST /api/portal/mlo/tickets/:id/entries  FormData { content, image? } or JSON { content }

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { put } from '@vercel/blob';

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  let content = '';
  let imageUrl = null;

  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    content = formData.get('content') || '';
    const image = formData.get('image');

    if (image && image.size > 0) {
      if (!ALLOWED_TYPES.includes(image.type)) {
        return Response.json({ error: 'Image must be PNG, JPEG, GIF, or WebP' }, { status: 400 });
      }
      if (image.size > MAX_IMAGE_SIZE) {
        return Response.json({ error: 'Image must be under 10 MB' }, { status: 400 });
      }

      const blob = await put(`tickets/${id}/${image.name}`, image, {
        access: 'public',
        addRandomSuffix: true,
      });
      imageUrl = blob.url;
    }
  } else {
    const body = await request.json();
    content = body.content || '';
  }

  if (!content.trim() && !imageUrl) {
    return Response.json({ error: 'Content or image is required' }, { status: 400 });
  }

  // Verify ticket exists
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) return Response.json({ error: 'Ticket not found' }, { status: 404 });

  const entry = await prisma.ticketEntry.create({
    data: {
      ticketId: id,
      content: content.trim() || (imageUrl ? '(screenshot)' : ''),
      imageUrl,
      authorId: session.user.id,
      authorLabel: `${session.user.firstName} ${session.user.lastName}`,
      entryType: 'comment',
    },
  });

  // Touch the ticket's updatedAt
  await prisma.ticket.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  return Response.json({ entry }, { status: 201 });
}
