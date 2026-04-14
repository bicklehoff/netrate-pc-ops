import { validateTwilioSignature, twilioForbiddenResponse } from "@/lib/twilio-validate";
// Dialer SMS Incoming Webhook — Receives inbound SMS from Twilio
// Twilio POSTs here when someone texts your Twilio phone number.
// Stores the message and returns TwiML (empty response = no auto-reply).
//
// Configure this URL as the "Messaging Webhook" on your Twilio phone number.

import sql from '@/lib/db';
import { normalizePhone } from '@/lib/normalize-phone';

export async function POST(req) {
  const formData = await req.formData();
  const params = Object.fromEntries(formData.entries());
  const { valid } = validateTwilioSignature(req, params);
  if (!valid) return twilioForbiddenResponse();
  const from = formData.get('From');         // Sender's phone
  const to = formData.get('To');             // Your Twilio number
  const body = formData.get('Body');
  const messageSid = formData.get('MessageSid');

  // Normalize sender phone for consistent lookup
  const normalizedFrom = normalizePhone(from);

  // Look up sender in contacts
  let contactId = null;
  if (normalizedFrom) {
    try {
      const rows = await sql`SELECT id FROM contacts WHERE phone = ${normalizedFrom} LIMIT 1`;
      if (rows.length) contactId = rows[0].id;
    } catch (e) {
      console.error('Contact lookup for incoming SMS failed:', e);
    }
  }

  // Store the inbound message
  try {
    await sql`
      INSERT INTO sms_messages (contact_id, direction, from_number, to_number, body, status, twilio_message_sid)
      VALUES (${contactId}, 'inbound', ${normalizedFrom || from || ''}, ${normalizePhone(to) || to || ''}, ${body || ''}, 'received', ${messageSid})
    `;
  } catch (e) {
    console.error('Failed to store incoming SMS:', e);
  }

  // Return empty TwiML (no auto-reply — MLOs will reply manually)
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    { headers: { 'Content-Type': 'text/xml' } }
  );
}
