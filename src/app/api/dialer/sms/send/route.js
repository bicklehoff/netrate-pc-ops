// Dialer SMS Send — Sends an SMS to a contact
// Auth: MLO session required
// Stores the message in sms_messages table and sends via Twilio.

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendSms } from '@/lib/twilio-voice';
import sql from '@/lib/db';
import { normalizePhone } from '@/lib/normalize-phone';

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { to, body, contactId } = await req.json();

  if (!to || !body) {
    return Response.json({ error: 'Missing "to" or "body"' }, { status: 400 });
  }

  const normalizedTo = normalizePhone(to) || to;

  try {
    // Send via Twilio
    const twilioResponse = await sendSms(normalizedTo, body);

    // Store in DB
    const rows = await sql`
      INSERT INTO sms_messages (contact_id, mlo_id, direction, from_number, to_number, body, status, twilio_message_sid)
      VALUES (${contactId || null}, ${session.user.id}, 'outbound', ${process.env.TWILIO_PHONE_NUMBER}, ${normalizedTo}, ${body}, ${twilioResponse.status || 'queued'}, ${twilioResponse.sid})
      RETURNING *
    `;

    return Response.json({ message: rows[0] });
  } catch (e) {
    console.error('SMS send failed:', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
