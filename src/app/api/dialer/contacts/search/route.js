// Dialer Contact Search — Fast typeahead search for the dialer
// Returns minimal contact data for quick lookup (used by ContactSearch component).
// Auth: MLO session required

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import sql from '@/lib/db';

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
      WHERE first_name ILIKE ${pattern}
        OR last_name ILIKE ${pattern}
        OR email ILIKE ${pattern}
        OR phone LIKE ${pattern}
        OR company ILIKE ${pattern}
      ORDER BY updated_at DESC
      LIMIT 10
    `;

    return Response.json({ contacts });
  } catch (e) {
    console.error('Contact search failed:', e);
    return Response.json({ error: 'Search failed' }, { status: 500 });
  }
}
