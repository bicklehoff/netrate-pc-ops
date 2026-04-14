// API: Contact Notes
// POST /api/portal/mlo/contacts/:id/notes — Add a note to a contact
// Auth: MLO session required

import sql from '@/lib/db';
import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';

export async function POST(req, { params }) {
  try {
    const { session, orgId, mloId } = await requireMloSession();
    if (!session) return unauthorizedResponse();

    const { id } = await params;
    const body = await req.json();
    const { content, title } = body;

    if (!content?.trim()) {
      return Response.json({ error: 'Note content is required' }, { status: 400 });
    }

    const contactRows = await sql`SELECT id FROM contacts WHERE id = ${id} AND organization_id = ${orgId} LIMIT 1`;
    if (!contactRows[0]) {
      return Response.json({ error: 'Contact not found' }, { status: 404 });
    }

    const noteRows = await sql`
      INSERT INTO contact_notes (contact_id, content, title, author_type, author_id, source, created_at)
      VALUES (${id}, ${content.trim()}, ${title || null}, 'mlo', ${mloId}, 'manual', NOW())
      RETURNING *
    `;

    // Update lastContactedAt
    await sql`UPDATE contacts SET last_contacted_at = NOW(), updated_at = NOW() WHERE id = ${id} AND organization_id = ${orgId}`;

    return Response.json({ success: true, note: noteRows[0] }, { status: 201 });
  } catch (error) {
    console.error('Add contact note error:', error?.message);
    return Response.json({ error: 'Failed to add note' }, { status: 500 });
  }
}
