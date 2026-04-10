// Dialer Call Notes API — Add/list notes for a specific call
// GET: List notes for a call
// POST: Add a note to a call (with optional disposition)
// Auth: MLO session required

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import sql from '@/lib/db';

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const notes = await sql`
      SELECT cn.*, m.first_name AS mlo_first_name, m.last_name AS mlo_last_name
      FROM call_notes cn
      LEFT JOIN mlos m ON cn.mlo_id = m.id
      WHERE cn.call_log_id = ${id}
      ORDER BY cn.created_at DESC
    `;

    // Nest mlo info
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
    const rows = await sql`
      INSERT INTO call_notes (call_log_id, mlo_id, content, disposition)
      VALUES (${id}, ${session.user.id}, ${content}, ${disposition || null})
      RETURNING *
    `;

    const note = rows[0];

    // Fetch mlo name for the response
    const mloRows = await sql`SELECT first_name, last_name FROM mlos WHERE id = ${session.user.id} LIMIT 1`;
    note.mlo = mloRows[0] || { first_name: '', last_name: '' };

    return Response.json({ note }, { status: 201 });
  } catch (e) {
    console.error('Call note create failed:', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
