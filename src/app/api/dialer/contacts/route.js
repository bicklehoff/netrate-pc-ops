import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';
import sql from '@/lib/db';
import { normalizePhone } from '@/lib/normalize-phone';

export async function GET(req) {
  const { session, orgId } = await requireMloSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const tag = searchParams.get('tag');
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
          WHERE c.organization_id = ${orgId}
            AND ${tag} = ANY(c.tags)
            AND (c.first_name ILIKE ${pattern} OR c.last_name ILIKE ${pattern} OR c.email ILIKE ${pattern} OR c.phone LIKE ${pattern} OR c.company ILIKE ${pattern})
          ORDER BY c.updated_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*)::int AS total FROM contacts c
          WHERE c.organization_id = ${orgId}
            AND ${tag} = ANY(c.tags)
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
          WHERE c.organization_id = ${orgId}
            AND (c.first_name ILIKE ${pattern} OR c.last_name ILIKE ${pattern} OR c.email ILIKE ${pattern} OR c.phone LIKE ${pattern} OR c.company ILIKE ${pattern})
          ORDER BY c.updated_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*)::int AS total FROM contacts c
          WHERE c.organization_id = ${orgId}
            AND (c.first_name ILIKE ${pattern} OR c.last_name ILIKE ${pattern} OR c.email ILIKE ${pattern} OR c.phone LIKE ${pattern} OR c.company ILIKE ${pattern})
        `,
      ]);
    } else if (tag) {
      [contacts, countRows] = await Promise.all([
        sql`
          SELECT c.*,
            (SELECT COUNT(*)::int FROM call_logs WHERE contact_id = c.id) AS call_log_count,
            (SELECT COUNT(*)::int FROM sms_messages WHERE contact_id = c.id) AS sms_message_count
          FROM contacts c
          WHERE c.organization_id = ${orgId}
            AND ${tag} = ANY(c.tags)
          ORDER BY c.updated_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`SELECT COUNT(*)::int AS total FROM contacts c WHERE c.organization_id = ${orgId} AND ${tag} = ANY(c.tags)`,
      ]);
    } else {
      [contacts, countRows] = await Promise.all([
        sql`
          SELECT c.*,
            (SELECT COUNT(*)::int FROM call_logs WHERE contact_id = c.id) AS call_log_count,
            (SELECT COUNT(*)::int FROM sms_messages WHERE contact_id = c.id) AS sms_message_count
          FROM contacts c
          WHERE c.organization_id = ${orgId}
          ORDER BY c.updated_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`SELECT COUNT(*)::int AS total FROM contacts WHERE organization_id = ${orgId}`,
      ]);
    }

    return Response.json({ contacts, total: countRows[0].total, page, limit });
  } catch (e) {
    console.error('Contacts fetch failed:', e);
    return Response.json({ error: 'Failed to fetch contacts' }, { status: 500 });
  }
}

export async function POST(req) {
  const { session, orgId } = await requireMloSession();
  if (!session) return unauthorizedResponse();

  const body = await req.json();
  const { firstName, lastName, email, phone, company, source, tags, notes } = body;

  if (!firstName || !lastName) {
    return Response.json({ error: 'First and last name required' }, { status: 400 });
  }

  try {
    const rows = await sql`
      INSERT INTO contacts (organization_id, first_name, last_name, email, phone, company, source, tags, notes, updated_at)
      VALUES (${orgId}, ${firstName}, ${lastName}, ${email || null}, ${normalizePhone(phone) || phone || null}, ${company || null}, ${source || 'manual'}, ${tags || []}, ${notes || null}, NOW())
      RETURNING *
    `;

    return Response.json({ contact: rows[0] }, { status: 201 });
  } catch (e) {
    console.error('Contact create failed:', e);
    return Response.json({ error: 'Failed to create contact' }, { status: 500 });
  }
}
