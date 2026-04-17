// Dialer Contact Detail — GET, PUT, DELETE a single contact
// Auth: MLO session required

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import sql from '@/lib/db';
import { normalizePhone } from '@/lib/normalize-phone';

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Main contact
    const contactRows = await sql`SELECT * FROM contacts WHERE id = ${id} LIMIT 1`;
    if (!contactRows.length) {
      return Response.json({ error: 'Contact not found' }, { status: 404 });
    }

    const contact = contactRows[0];

    // Fetch related data in parallel
    const [callLogs, smsMessages, borrowerRows] = await Promise.all([
      sql`
        SELECT cl.*, m.first_name AS mlo_first_name, m.last_name AS mlo_last_name
        FROM call_logs cl
        LEFT JOIN staff m ON cl.mlo_id = m.id
        WHERE cl.contact_id = ${id}
        ORDER BY cl.started_at DESC
        LIMIT 20
      `,
      sql`
        SELECT * FROM sms_messages
        WHERE contact_id = ${id}
        ORDER BY sent_at DESC
        LIMIT 50
      `,
      contact.role === 'borrower'
        ? sql`
            SELECT c.id, c.first_name, c.last_name, c.email FROM contacts c WHERE c.id = ${contact.id} LIMIT 1
          `
        : Promise.resolve([]),
    ]);

    // Fetch call notes for these calls
    const callIds = callLogs.map(c => c.id);
    const callNotes = callIds.length
      ? await sql`SELECT * FROM call_notes WHERE call_log_id = ANY(${callIds}) ORDER BY created_at DESC`
      : [];

    // Attach notes to their calls
    for (const call of callLogs) {
      call.notes = callNotes.filter(n => n.call_log_id === call.id);
    }

    // Fetch loans if contact has borrower role (post-migration: contact.id IS the loan owner)
    const borrower = borrowerRows[0] || null;
    if (borrower) {
      const loans = await sql`
        SELECT id, status, purpose FROM loans WHERE contact_id = ${borrower.id} ORDER BY created_at DESC LIMIT 5
      `;
      borrower.loans = loans;
    }

    contact.call_logs = callLogs;
    contact.sms_messages = smsMessages;
    contact.borrower = borrower;

    return Response.json({ contact });
  } catch (e) {
    console.error('Contact fetch failed:', e);
    return Response.json({ error: 'Failed to fetch contact' }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { firstName, lastName, email, phone, company, tags, notes } = body;

  // Build SET clauses dynamically
  const sets = [];
  const values = [];
  if (firstName !== undefined) { sets.push('first_name'); values.push(firstName); }
  if (lastName !== undefined) { sets.push('last_name'); values.push(lastName); }
  if (email !== undefined) { sets.push('email'); values.push(email); }
  if (phone !== undefined) { sets.push('phone'); values.push(normalizePhone(phone) || phone); }
  if (company !== undefined) { sets.push('company'); values.push(company); }
  if (tags !== undefined) { sets.push('tags'); values.push(tags); }
  if (notes !== undefined) { sets.push('notes'); values.push(notes); }

  if (sets.length === 0) {
    return Response.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
    // Build a dynamic update — since neon tagged templates don't support dynamic column names easily,
    // use a full update with COALESCE pattern
    const rows = await sql`
      UPDATE contacts SET
        first_name = COALESCE(${firstName !== undefined ? firstName : null}, first_name),
        last_name = COALESCE(${lastName !== undefined ? lastName : null}, last_name),
        email = ${email !== undefined ? email : null},
        phone = ${phone !== undefined ? (normalizePhone(phone) || phone) : null},
        company = ${company !== undefined ? company : null},
        tags = ${tags !== undefined ? tags : null},
        notes = ${notes !== undefined ? notes : null},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    return Response.json({ contact: rows[0] });
  } catch (e) {
    console.error('Contact update failed:', e);
    return Response.json({ error: 'Failed to update contact' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    await sql`DELETE FROM contacts WHERE id = ${id}`;
    return Response.json({ success: true });
  } catch (e) {
    console.error('Contact delete failed:', e);
    return Response.json({ error: 'Failed to delete contact' }, { status: 500 });
  }
}
