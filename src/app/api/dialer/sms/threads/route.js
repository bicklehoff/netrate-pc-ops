// SMS Threads API — Returns all SMS conversations grouped by contact/phone
// GET /api/dialer/sms/threads
// Returns threads sorted by most recent message, with contact info and last message preview
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
  const q = searchParams.get('q') || '';

  try {
    // Get recent SMS messages with contact info — limit to prevent full table scan
    const messages = await sql`
      SELECT sm.*, c.id AS c_id, c.first_name AS c_first_name, c.last_name AS c_last_name, c.phone AS c_phone
      FROM sms_messages sm
      LEFT JOIN contacts c ON sm.contact_id = c.id
      ORDER BY sm.sent_at DESC
      LIMIT 5000
    `;

    // Group by contact (or by phone number if no contact)
    const threadMap = new Map();

    for (const msg of messages) {
      // Determine the thread key: contact_id if available, otherwise the other party's phone
      const otherPhone = msg.direction === 'inbound' ? msg.from_number : msg.to_number;
      const key = msg.contact_id || otherPhone;

      if (!threadMap.has(key)) {
        threadMap.set(key, {
          contact_id: msg.contact_id,
          contact_name: msg.c_first_name
            ? `${msg.c_first_name} ${msg.c_last_name}`.trim()
            : null,
          phone: msg.c_phone || otherPhone,
          last_message: msg.body,
          last_message_at: msg.sent_at,
          last_direction: msg.direction,
          unread: 0,
          message_count: 0,
        });
      }

      const thread = threadMap.get(key);
      thread.message_count++;

      // Count inbound messages that are newer than any outbound as "unread" (simple heuristic)
      if (msg.direction === 'inbound' && thread.message_count <= 5) {
        thread.unread++;
      }
    }

    // Convert to array and sort by most recent
    let threads = Array.from(threadMap.values()).sort(
      (a, b) => new Date(b.last_message_at) - new Date(a.last_message_at)
    );

    // Search filter
    if (q) {
      const lower = q.toLowerCase();
      threads = threads.filter(
        (t) =>
          t.contact_name?.toLowerCase().includes(lower) ||
          t.phone?.includes(q) ||
          t.last_message?.toLowerCase().includes(lower)
      );
    }

    return Response.json({ threads });
  } catch (e) {
    console.error('SMS threads fetch failed:', e);
    return Response.json({ error: 'Failed to fetch threads' }, { status: 500 });
  }
}
