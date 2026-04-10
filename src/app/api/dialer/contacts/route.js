// Dialer Contacts API — CRUD for contacts
// GET: List/search contacts
// POST: Create a new contact
// Auth: MLO session required

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import sql from '@/lib/db';
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
  const offset = (page - 1) * limit;

  try {
    let contacts, countRows;

    if (q && tag) {
      const pattern = `%${q}%`;
      [contacts, countRows] = await Promise.all([
        sql`
          SELECT c.*,
            (SELECT COUNT(*)::int FROM call_logs WHERE contact_id = c.id) AS call_log_count,
            (SELECT COUNT(*)::int FROM sms_messages WHERE contact_id = c.id) AS sms_message_count
          FROM contacts c
          WHERE ${tag} = ANY(c.tags)
            AND (c.first_name ILIKE ${pattern} OR c.last_name ILIKE ${pattern} OR c.email ILIKE ${pattern} OR c.phone LIKE ${pattern} OR c.company ILIKE ${pattern})
          ORDER BY c.updated_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*)::int AS total FROM contacts c
          WHERE ${tag} = ANY(c.tags)
            AND (c.first_name ILIKE ${pattern} OR c.last_name ILIKE ${pattern} OR c.email ILIKE ${pattern} OR c.phone LIKE ${pattern} OR c.company ILIKE ${pattern})
        `,
      ]);
    } else if (q) {
      const pattern = `%${q}%`;
      [contacts, countRows] = await Promise.all([
        sql`
          SELECT c.*,
            (SELECT COUNT(*)::int FROM call_logs WHERE contact_id = c.id) AS call_log_count,
            (SELECT COUNT(*)::int FROM sms_messages WHERE contact_id = c.id) AS sms_message_count
          FROM contacts c
          WHERE c.first_name ILIKE ${pattern} OR c.last_name ILIKE ${pattern} OR c.email ILIKE ${pattern} OR c.phone LIKE ${pattern} OR c.company ILIKE ${pattern}
          ORDER BY c.updated_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*)::int AS total FROM contacts c
          WHERE c.first_name ILIKE ${pattern} OR c.last_name ILIKE ${pattern} OR c.email ILIKE ${pattern} OR c.phone LIKE ${pattern} OR c.company ILIKE ${pattern}
        `,
      ]);
    } else if (tag) {
      [contacts, countRows] = await Promise.all([
        sql`
          SELECT c.*,
            (SELECT COUNT(*)::int FROM call_logs WHERE contact_id = c.id) AS call_log_count,
            (SELECT COUNT(*)::int FROM sms_messages WHERE contact_id = c.id) AS sms_message_count
          FROM contacts c
          WHERE ${tag} = ANY(c.tags)
          ORDER BY c.updated_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`SELECT COUNT(*)::int AS total FROM contacts c WHERE ${tag} = ANY(c.tags)`,
      ]);
    } else {
      [contacts, countRows] = await Promise.all([
        sql`
          SELECT c.*,
            (SELECT COUNT(*)::int FROM call_logs WHERE contact_id = c.id) AS call_log_count,
            (SELECT COUNT(*)::int FROM sms_messages WHERE contact_id = c.id) AS sms_message_count
          FROM contacts c
          ORDER BY c.updated_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`SELECT COUNT(*)::int AS total FROM contacts`,
      ]);
    }

    return Response.json({ contacts, total: countRows[0].total, page, limit });
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
    const rows = await sql`
      INSERT INTO contacts (first_name, last_name, email, phone, company, source, tags, notes, borrower_id, updated_at)
      VALUES (${firstName}, ${lastName}, ${email || null}, ${normalizePhone(phone) || phone || null}, ${company || null}, ${source || 'manual'}, ${tags || []}, ${notes || null}, ${borrowerId || null}, NOW())
      RETURNING *
    `;

    return Response.json({ contact: rows[0] }, { status: 201 });
  } catch (e) {
    console.error('Contact create failed:', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
