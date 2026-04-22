import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';
import sql from '@/lib/db';
import { normalizePhone } from '@/lib/normalize-phone';

export async function GET(req, { params }) {
  const { session, orgId } = await requireMloSession();
  if (!session) return unauthorizedResponse();

  const { id } = await params;

  try {
    const contactRows = await sql`SELECT * FROM contacts WHERE id = ${id} AND organization_id = ${orgId} LIMIT 1`;
    if (!contactRows.length) return Response.json({ error: 'Contact not found' }, { status: 404 });

    const contact = contactRows[0];

    const [callLogs, smsMessages, borrowerRows] = await Promise.all([
      sql`
        SELECT cl.*, m.first_name AS mlo_first_name, m.last_name AS mlo_last_name
        FROM call_logs cl
        LEFT JOIN staff m ON cl.mlo_id = m.id
        WHERE cl.contact_id = ${id} AND cl.organization_id = ${orgId}
        ORDER BY cl.started_at DESC
        LIMIT 20
      `,
      sql`
        SELECT * FROM sms_messages
        WHERE contact_id = ${id} AND organization_id = ${orgId}
        ORDER BY sent_at DESC
        LIMIT 50
      `,
      contact.role === 'borrower'
        ? sql`SELECT c.id, c.first_name, c.last_name, c.email FROM contacts c WHERE c.id = ${contact.id} AND c.organization_id = ${orgId} LIMIT 1`
        : Promise.resolve([]),
    ]);

    const callIds = callLogs.map(c => c.id);
    const callNotes = callIds.length
      ? await sql`SELECT * FROM call_notes WHERE call_log_id = ANY(${callIds}) ORDER BY created_at DESC`
      : [];

    for (const call of callLogs) {
      call.notes = callNotes.filter(n => n.call_log_id === call.id);
    }

    const borrower = borrowerRows[0] || null;
    if (borrower) {
      const loans = await sql`
        SELECT id, status, purpose FROM loans WHERE contact_id = ${borrower.id} AND organization_id = ${orgId} ORDER BY created_at DESC LIMIT 5
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
  const { session, orgId } = await requireMloSession();
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  const body = await req.json();
  const { firstName, lastName, email, phone, company, tags, notes } = body;

  if (firstName === undefined && lastName === undefined && email === undefined &&
      phone === undefined && company === undefined && tags === undefined && notes === undefined) {
    return Response.json({ error: 'No fields to update' }, { status: 400 });
  }

  try {
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
      WHERE id = ${id} AND organization_id = ${orgId}
      RETURNING *
    `;

    if (!rows.length) return Response.json({ error: 'Contact not found' }, { status: 404 });
    return Response.json({ contact: rows[0] });
  } catch (e) {
    console.error('Contact update failed:', e);
    return Response.json({ error: 'Failed to update contact' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const { session, orgId } = await requireMloSession();
  if (!session) return unauthorizedResponse();

  const { id } = await params;

  try {
    const rows = await sql`DELETE FROM contacts WHERE id = ${id} AND organization_id = ${orgId} RETURNING id`;
    if (!rows.length) return Response.json({ error: 'Contact not found' }, { status: 404 });
    return Response.json({ success: true });
  } catch (e) {
    console.error('Contact delete failed:', e);
    return Response.json({ error: 'Failed to delete contact' }, { status: 500 });
  }
}
