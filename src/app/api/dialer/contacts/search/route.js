import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';
import sql from '@/lib/db';

export async function GET(req) {
  const { session, orgId } = await requireMloSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');

  if (!q || q.length < 2) {
    return Response.json({ contacts: [] });
  }

  try {
    const pattern = `%${q}%`;
    const contacts = await sql`
      SELECT id, first_name, last_name, phone, email, company, tags
      FROM contacts
      WHERE organization_id = ${orgId}
        AND (
          first_name ILIKE ${pattern}
          OR last_name ILIKE ${pattern}
          OR email ILIKE ${pattern}
          OR phone LIKE ${pattern}
          OR company ILIKE ${pattern}
        )
      ORDER BY updated_at DESC
      LIMIT 10
    `;

    return Response.json({ contacts });
  } catch (e) {
    console.error('Contact search failed:', e);
    return Response.json({ error: 'Search failed' }, { status: 500 });
  }
}
