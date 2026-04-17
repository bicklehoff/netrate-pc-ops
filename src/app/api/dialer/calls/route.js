// Dialer Call Logs API — List recent calls
// GET: Returns paginated call history for the MLO portal
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
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '30', 10);
  const contactId = searchParams.get('contactId');
  const direction = searchParams.get('direction'); // 'inbound' | 'outbound'
  const offset = (page - 1) * limit;

  const isAdmin = session.user.role === 'admin';
  const mloId = session.user.id;

  try {
    let calls, countRows;

    if (contactId && direction) {
      [calls, countRows] = await Promise.all([
        sql`
          SELECT cl.*,
            c.id AS contact_id_ref, c.first_name AS contact_first_name, c.last_name AS contact_last_name, c.phone AS contact_phone,
            m.first_name AS mlo_first_name, m.last_name AS mlo_last_name
          FROM call_logs cl
          LEFT JOIN contacts c ON cl.contact_id = c.id
          LEFT JOIN staff m ON cl.mlo_id = m.id
          WHERE cl.contact_id = ${contactId} AND cl.direction = ${direction}
            ${isAdmin ? sql`` : sql`AND cl.mlo_id = ${mloId}`}
          ORDER BY cl.started_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`SELECT COUNT(*)::int AS total FROM call_logs WHERE contact_id = ${contactId} AND direction = ${direction} ${isAdmin ? sql`` : sql`AND mlo_id = ${mloId}`}`,
      ]);
    } else if (contactId) {
      [calls, countRows] = await Promise.all([
        sql`
          SELECT cl.*,
            c.id AS contact_id_ref, c.first_name AS contact_first_name, c.last_name AS contact_last_name, c.phone AS contact_phone,
            m.first_name AS mlo_first_name, m.last_name AS mlo_last_name
          FROM call_logs cl
          LEFT JOIN contacts c ON cl.contact_id = c.id
          LEFT JOIN staff m ON cl.mlo_id = m.id
          WHERE cl.contact_id = ${contactId}
            ${isAdmin ? sql`` : sql`AND cl.mlo_id = ${mloId}`}
          ORDER BY cl.started_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`SELECT COUNT(*)::int AS total FROM call_logs WHERE contact_id = ${contactId} ${isAdmin ? sql`` : sql`AND mlo_id = ${mloId}`}`,
      ]);
    } else if (direction) {
      [calls, countRows] = await Promise.all([
        sql`
          SELECT cl.*,
            c.id AS contact_id_ref, c.first_name AS contact_first_name, c.last_name AS contact_last_name, c.phone AS contact_phone,
            m.first_name AS mlo_first_name, m.last_name AS mlo_last_name
          FROM call_logs cl
          LEFT JOIN contacts c ON cl.contact_id = c.id
          LEFT JOIN staff m ON cl.mlo_id = m.id
          WHERE cl.direction = ${direction}
            ${isAdmin ? sql`` : sql`AND cl.mlo_id = ${mloId}`}
          ORDER BY cl.started_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`SELECT COUNT(*)::int AS total FROM call_logs WHERE direction = ${direction} ${isAdmin ? sql`` : sql`AND mlo_id = ${mloId}`}`,
      ]);
    } else {
      [calls, countRows] = await Promise.all([
        sql`
          SELECT cl.*,
            c.id AS contact_id_ref, c.first_name AS contact_first_name, c.last_name AS contact_last_name, c.phone AS contact_phone,
            m.first_name AS mlo_first_name, m.last_name AS mlo_last_name
          FROM call_logs cl
          LEFT JOIN contacts c ON cl.contact_id = c.id
          LEFT JOIN staff m ON cl.mlo_id = m.id
          ${isAdmin ? sql`` : sql`WHERE cl.mlo_id = ${mloId}`}
          ORDER BY cl.started_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
        isAdmin
          ? sql`SELECT COUNT(*)::int AS total FROM call_logs`
          : sql`SELECT COUNT(*)::int AS total FROM call_logs WHERE mlo_id = ${mloId}`,
      ]);
    }

    // Fetch latest note for each call
    const callIds = calls.map(c => c.id);
    const notes = callIds.length
      ? await sql`
          SELECT DISTINCT ON (call_log_id) * FROM call_notes
          WHERE call_log_id = ANY(${callIds})
          ORDER BY call_log_id, created_at DESC
        `
      : [];

    // Nest contact/mlo/notes into each call
    for (const call of calls) {
      call.contact = call.contact_id ? {
        id: call.contact_id,
        first_name: call.contact_first_name,
        last_name: call.contact_last_name,
        phone: call.contact_phone,
      } : null;
      call.mlo = { first_name: call.mlo_first_name, last_name: call.mlo_last_name };
      call.notes = notes.filter(n => n.call_log_id === call.id);
      // Clean up flat join fields
      delete call.contact_id_ref; delete call.contact_first_name; delete call.contact_last_name;
      delete call.contact_phone; delete call.mlo_first_name; delete call.mlo_last_name;
    }

    return Response.json({ calls, total: countRows[0].total, page, limit });
  } catch (e) {
    console.error('Call logs fetch failed:', e);
    return Response.json({ error: 'Failed to fetch call logs' }, { status: 500 });
  }
}
