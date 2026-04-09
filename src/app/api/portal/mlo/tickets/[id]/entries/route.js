// Ticket Entries API — Add comment (with optional image) to a ticket
// POST /api/portal/mlo/tickets/:id/entries  FormData { content, image? } or JSON { content }

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import sql from '@/lib/db';
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
  const ticketRows = await sql`SELECT id FROM tickets WHERE id = ${id} LIMIT 1`;
  if (!ticketRows[0]) return Response.json({ error: 'Ticket not found' }, { status: 404 });

  const entryRows = await sql`
    INSERT INTO ticket_entries (ticket_id, content, image_url, author_id, author_label, entry_type, created_at)
    VALUES (
      ${id}, ${content.trim() || (imageUrl ? '(screenshot)' : '')}, ${imageUrl},
      ${session.user.id}, ${`${session.user.firstName} ${session.user.lastName}`},
      'comment', NOW()
    )
    RETURNING *
  `;

  // Touch the ticket's updated_at
  await sql`UPDATE tickets SET updated_at = NOW() WHERE id = ${id}`;

  return Response.json({ entry: entryRows[0] }, { status: 201 });
}
