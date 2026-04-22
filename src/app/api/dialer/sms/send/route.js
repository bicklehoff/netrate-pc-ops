import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';
import { sendSms } from '@/lib/twilio-voice';
import sql from '@/lib/db';
import { normalizePhone } from '@/lib/normalize-phone';

export async function POST(req) {
  const { session, orgId, mloId } = await requireMloSession();
  if (!session) return unauthorizedResponse();

  const { to, body, contactId } = await req.json();

  if (!to || !body) {
    return Response.json({ error: 'Missing "to" or "body"' }, { status: 400 });
  }

  const normalizedTo = normalizePhone(to) || to;

  try {
    // Resolve this MLO's Twilio number — SMS goes out From the sender, not a
    // global shared pool. Falls back to TWILIO_PHONE_NUMBER for any staff row
    // without an assigned number (should not happen in prod post-migration 028).
    const staffRows = await sql`SELECT twilio_phone_number FROM staff WHERE id = ${mloId} LIMIT 1`;
    const fromNumber = staffRows[0]?.twilio_phone_number || process.env.TWILIO_PHONE_NUMBER;

    const twilioResponse = await sendSms(normalizedTo, body, fromNumber);

    const rows = await sql`
      INSERT INTO sms_messages (organization_id, contact_id, mlo_id, direction, from_number, to_number, body, status, twilio_message_sid)
      VALUES (${orgId}, ${contactId || null}, ${mloId}, 'outbound', ${fromNumber}, ${normalizedTo}, ${body}, ${twilioResponse.status || 'queued'}, ${twilioResponse.sid})
      RETURNING *
    `;

    return Response.json({ message: rows[0] });
  } catch (e) {
    console.error('SMS send failed:', e);
    return Response.json({ error: 'Failed to send SMS' }, { status: 500 });
  }
}
