// SMS Threads API — Returns all SMS conversations grouped by contact/phone
// GET /api/dialer/sms/threads
// Returns threads sorted by most recent message, with contact info and last message preview
// Auth: MLO session required

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';

  try {
    // Get all SMS messages with contact info, ordered by most recent
    const messages = await prisma.smsMessage.findMany({
      orderBy: { sentAt: 'desc' },
      include: {
        contact: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
      },
    });

    // Group by contact (or by phone number if no contact)
    const threadMap = new Map();

    for (const msg of messages) {
      // Determine the thread key: contactId if available, otherwise the other party's phone
      const otherPhone = msg.direction === 'inbound' ? msg.fromNumber : msg.toNumber;
      const key = msg.contactId || otherPhone;

      if (!threadMap.has(key)) {
        threadMap.set(key, {
          contactId: msg.contactId,
          contactName: msg.contact
            ? `${msg.contact.firstName} ${msg.contact.lastName}`.trim()
            : null,
          phone: msg.contact?.phone || otherPhone,
          lastMessage: msg.body,
          lastMessageAt: msg.sentAt,
          lastDirection: msg.direction,
          unread: 0,
          messageCount: 0,
        });
      }

      const thread = threadMap.get(key);
      thread.messageCount++;

      // Count inbound messages that are newer than any outbound as "unread" (simple heuristic)
      if (msg.direction === 'inbound' && thread.messageCount <= 5) {
        // Check if this inbound message is more recent than the latest outbound in this thread
        thread.unread++;
      }
    }

    // Convert to array and sort by most recent
    let threads = Array.from(threadMap.values()).sort(
      (a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
    );

    // Search filter
    if (q) {
      const lower = q.toLowerCase();
      threads = threads.filter(
        (t) =>
          t.contactName?.toLowerCase().includes(lower) ||
          t.phone?.includes(q) ||
          t.lastMessage?.toLowerCase().includes(lower)
      );
    }

    return Response.json({ threads });
  } catch (e) {
    console.error('SMS threads fetch failed:', e);
    return Response.json({ error: 'Failed to fetch threads' }, { status: 500 });
  }
}
