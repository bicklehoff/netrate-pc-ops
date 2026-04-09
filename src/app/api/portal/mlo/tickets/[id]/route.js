// Single Ticket API — Get, Update, Delete
// GET    /api/portal/mlo/tickets/:id
// PATCH  /api/portal/mlo/tickets/:id  { status, priority, assignedTo, title, description }
// DELETE /api/portal/mlo/tickets/:id

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import sql from '@/lib/db';

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const ticketRows = await sql`SELECT * FROM tickets WHERE id = ${id} LIMIT 1`;
  const ticket = ticketRows[0];
  if (!ticket) return Response.json({ error: 'Ticket not found' }, { status: 404 });

  const entries = await sql`SELECT * FROM ticket_entries WHERE ticket_id = ${id} ORDER BY created_at ASC`;

  return Response.json({ ticket: { ...ticket, entries } });
}

export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const ticketRows = await sql`SELECT * FROM tickets WHERE id = ${id} LIMIT 1`;
  const ticket = ticketRows[0];
  if (!ticket) return Response.json({ error: 'Ticket not found' }, { status: 404 });

  const setClauses = [];
  const values = [];
  const autoEntries = [];

  if (body.title !== undefined) { values.push(body.title.trim()); setClauses.push(`title = $${values.length}`); }
  if (body.description !== undefined) { values.push(body.description?.trim() || null); setClauses.push(`description = $${values.length}`); }
  if (body.priority !== undefined) { values.push(body.priority); setClauses.push(`priority = $${values.length}`); }

  if (body.assignedTo !== undefined) {
    values.push(body.assignedTo || null);
    setClauses.push(`assigned_to = $${values.length}`);
    if (body.assignedTo !== ticket.assigned_to) {
      autoEntries.push({
        content: `Assigned to ${body.assignedTo || 'unassigned'}`,
        authorId: session.user.id,
        authorLabel: `${session.user.firstName} ${session.user.lastName}`,
        entryType: 'assignment',
      });
    }
  }

  if (body.status !== undefined && body.status !== ticket.status) {
    values.push(body.status);
    setClauses.push(`status = $${values.length}`);
    if (body.status === 'resolved') setClauses.push('resolved_at = NOW()');
    if (body.status === 'closed') setClauses.push('closed_at = NOW()');
    if (body.status === 'open' || body.status === 'in_progress') {
      setClauses.push('resolved_at = NULL');
      setClauses.push('closed_at = NULL');
    }
    autoEntries.push({
      content: `Status changed: ${ticket.status} → ${body.status}`,
      authorId: session.user.id,
      authorLabel: `${session.user.firstName} ${session.user.lastName}`,
      entryType: 'status_change',
    });
  }

  if (setClauses.length === 0 && autoEntries.length === 0) {
    return Response.json({ ticket });
  }

  setClauses.push('updated_at = NOW()');
  values.push(id);

  // Update ticket
  const query = `UPDATE tickets SET ${setClauses.join(', ')} WHERE id = $${values.length} RETURNING *`;
  const updated = await sql(query, values);

  // Create auto-entries
  for (const entry of autoEntries) {
    await sql`
      INSERT INTO ticket_entries (ticket_id, content, author_id, author_label, entry_type, created_at)
      VALUES (${id}, ${entry.content}, ${entry.authorId}, ${entry.authorLabel}, ${entry.entryType}, NOW())
    `;
  }

  // Return with entries
  const entries = await sql`SELECT * FROM ticket_entries WHERE ticket_id = ${id} ORDER BY created_at ASC`;

  return Response.json({ ticket: { ...updated[0], entries } });
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // Admin only
  if (session.user.role !== 'admin') {
    return Response.json({ error: 'Admin required' }, { status: 403 });
  }

  const { id } = await params;
  await sql`DELETE FROM ticket_entries WHERE ticket_id = ${id}`;
  await sql`DELETE FROM tickets WHERE id = ${id}`;

  return Response.json({ success: true });
}
