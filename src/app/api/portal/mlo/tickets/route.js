// Tickets API — List + Create
// GET  /api/portal/mlo/tickets?product=&status=&type=&priority=
// POST /api/portal/mlo/tickets  { title, description, product, ticketType, priority, assignedTo }

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import sql from '@/lib/db';

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const product = searchParams.get('product');
  const status = searchParams.get('status');
  const ticketType = searchParams.get('type');
  const priority = searchParams.get('priority');

  const effectiveProduct = (product && product !== 'all') ? product : null;
  const effectiveStatus = (status && status !== 'all') ? status : null;
  const effectiveType = (ticketType && ticketType !== 'all') ? ticketType : null;
  const effectivePriority = (priority && priority !== 'all') ? priority : null;

  try {
    const tickets = await sql`
      SELECT t.*,
        (SELECT COUNT(*)::int FROM ticket_entries WHERE ticket_id = t.id) AS entry_count,
        (SELECT json_build_object(
          'id', te.id, 'content', te.content, 'author_label', te.author_label,
          'entry_type', te.entry_type, 'created_at', te.created_at
        ) FROM ticket_entries te WHERE te.ticket_id = t.id ORDER BY te.created_at DESC LIMIT 1) AS latest_entry
      FROM tickets t
      WHERE (${effectiveProduct}::text IS NULL OR t.product = ${effectiveProduct})
        AND (${effectiveStatus}::text IS NULL OR t.status = ${effectiveStatus})
        AND (${effectiveType}::text IS NULL OR t.ticket_type = ${effectiveType})
        AND (${effectivePriority}::text IS NULL OR t.priority = ${effectivePriority})
      ORDER BY t.status ASC, t.priority ASC, t.created_at DESC
    `;

    // Shape to match expected format
    const result = tickets.map(t => ({
      ...t,
      entries: t.latest_entry ? [t.latest_entry] : [],
      _count: { entries: t.entry_count },
    }));

    return Response.json({ tickets: result });
  } catch (error) {
    console.error('Tickets API error:', error);
    return Response.json({ error: error.message, tickets: [] }, { status: 500 });
  }
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { title, description, product, ticketType, priority, assignedTo } = body;

  if (!title?.trim()) return Response.json({ error: 'Title is required' }, { status: 400 });
  if (!product) return Response.json({ error: 'Product is required' }, { status: 400 });
  if (!ticketType) return Response.json({ error: 'Type is required' }, { status: 400 });

  const validProducts = ['website', 'portal', 'corebot'];
  const validTypes = ['bug', 'feature', 'improvement'];
  const validPriorities = ['critical', 'high', 'medium', 'low'];

  if (!validProducts.includes(product)) return Response.json({ error: 'Invalid product' }, { status: 400 });
  if (!validTypes.includes(ticketType)) return Response.json({ error: 'Invalid type' }, { status: 400 });
  if (priority && !validPriorities.includes(priority)) return Response.json({ error: 'Invalid priority' }, { status: 400 });

  const ticketRows = await sql`
    INSERT INTO tickets (title, description, product, ticket_type, priority, status, created_by, assigned_to, created_at, updated_at)
    VALUES (
      ${title.trim()}, ${description?.trim() || null}, ${product}, ${ticketType},
      ${priority || 'medium'}, 'open', ${session.user.id}, ${assignedTo || null},
      NOW(), NOW()
    )
    RETURNING *
  `;

  return Response.json({ ticket: ticketRows[0] }, { status: 201 });
}
