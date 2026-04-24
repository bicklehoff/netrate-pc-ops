import { validateTwilioSignature, twilioForbiddenResponse } from "@/lib/twilio-validate";
import sql from '@/lib/db';
import { normalizePhone } from '@/lib/normalize-phone';
import { DEFAULT_ORG_ID } from '@/lib/constants/org';
import { sendPushToStaff } from '@/lib/push';

export async function POST(req) {
  const formData = await req.formData();
  const params = Object.fromEntries(formData.entries());
  const { valid } = validateTwilioSignature(req, params);
  if (!valid) return twilioForbiddenResponse();
  const from = formData.get('From');
  const to = formData.get('To');
  const body = formData.get('Body');
  const messageSid = formData.get('MessageSid');

  const normalizedFrom = normalizePhone(from);
  const normalizedTo = normalizePhone(to);

  // Look up sender in contacts
  let contactId = null;
  let senderName = null;
  if (normalizedFrom) {
    try {
      const rows = await sql`SELECT id, first_name, last_name FROM contacts WHERE phone = ${normalizedFrom} LIMIT 1`;
      if (rows.length) {
        contactId = rows[0].id;
        senderName = `${rows[0].first_name} ${rows[0].last_name}`.trim() || null;
      }
    } catch (e) {
      console.error('Contact lookup for incoming SMS failed:', e);
    }
  }

  // Store the inbound message
  try {
    await sql`
      INSERT INTO sms_messages (organization_id, contact_id, direction, from_number, to_number, body, status, twilio_message_sid)
      VALUES (${DEFAULT_ORG_ID}, ${contactId}, 'inbound', ${normalizedFrom || from || ''}, ${normalizedTo || to || ''}, ${body || ''}, 'received', ${messageSid})
    `;
  } catch (e) {
    console.error('Failed to store incoming SMS:', e);
  }

  // Push notification to the MLO who owns this Twilio number
  try {
    const staffRows = normalizedTo
      ? await sql`SELECT id FROM staff WHERE twilio_phone_number = ${normalizedTo} AND is_active = true LIMIT 1`
      : [];
    if (staffRows.length) {
      await sendPushToStaff(staffRows[0].id, {
        title: senderName ? `SMS from ${senderName}` : 'New text message',
        body: (body || '').slice(0, 100),
        url: contactId ? `/portal/mlo/contacts/${contactId}` : '/portal/mlo',
        tag: `sms-${normalizedFrom}`,
      });
    }
  } catch (e) {
    console.error('Push notification for incoming SMS failed:', e);
  }

  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    { headers: { 'Content-Type': 'text/xml' } }
  );
}
