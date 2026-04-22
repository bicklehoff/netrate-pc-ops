import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';
import sql from '@/lib/db';

export async function GET(req, { params }) {
  const { session, orgId } = await requireMloSession();
  if (!session) return unauthorizedResponse();

  const { id } = await params;

  try {
    // Verify the call_log belongs to this org before returning its notes
    const callRows = await sql`SELECT id FROM call_logs WHERE id = ${id} AND organization_id = ${orgId} LIMIT 1`;
    if (!callRows.length) return Response.json({ error: 'Not found' }, { status: 404 });

    const notes = await sql`
      SELECT cn.*, m.first_name AS mlo_first_name, m.last_name AS mlo_last_name
      FROM call_notes cn
      LEFT JOIN staff m ON cn.mlo_id = m.id
      WHERE cn.call_log_id = ${id}
      ORDER BY cn.created_at DESC
    `;

    for (const note of notes) {
      note.mlo = { first_name: note.mlo_first_name, last_name: note.mlo_last_name };
      delete note.mlo_first_name; delete note.mlo_last_name;
    }

    return Response.json({ notes });
  } catch (e) {
    console.error('Call notes fetch failed:', e);
    return Response.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  const { session, orgId, mloId } = await requireMloSession();
  if (!session) return unauthorizedResponse();

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
    // Verify the call_log belongs to this org before writing
    const callRows = await sql`SELECT id FROM call_logs WHERE id = ${id} AND organization_id = ${orgId} LIMIT 1`;
    if (!callRows.length) return Response.json({ error: 'Not found' }, { status: 404 });

    const rows = await sql`
      INSERT INTO call_notes (call_log_id, mlo_id, content, disposition)
      VALUES (${id}, ${mloId}, ${content}, ${disposition || null})
      RETURNING *
    `;

    const note = rows[0];
    const mloRows = await sql`SELECT first_name, last_name FROM staff WHERE id = ${mloId} LIMIT 1`;
    note.mlo = mloRows[0] || { first_name: '', last_name: '' };

    return Response.json({ note }, { status: 201 });
  } catch (e) {
    console.error('Call note create failed:', e);
    return Response.json({ error: 'Failed to create note' }, { status: 500 });
  }
}
