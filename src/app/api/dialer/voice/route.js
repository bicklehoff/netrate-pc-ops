// Dialer Voice Webhook — Handles outbound call routing
// Twilio POSTs here when a browser client initiates a call via device.connect().
// Returns TwiML that tells Twilio to dial the destination number.
//
// This is the "Voice URL" configured in your TwiML App.

import { buildOutboundTwiml } from '@/lib/twilio-voice';
import sql from '@/lib/db';
import { normalizePhone } from '@/lib/normalize-phone';

export async function POST(req) {
  const formData = await req.formData();
  const to = formData.get('To');
  const from = formData.get('From');        // client:mlo-<uuid>
  const callSid = formData.get('CallSid');

  if (!to) {
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>No destination number provided.</Say></Response>',
      { headers: { 'Content-Type': 'text/xml' } }
    );
  }

  // Extract MLO ID from the client identity (format: "client:mlo-<uuid>")
  const mloId = from?.replace('client:mlo-', '') || null;

  // Normalize destination phone for consistent lookup
  const normalizedTo = normalizePhone(to);

  // Look up contact by phone number
  let contactId = null;
  if (normalizedTo) {
    try {
      const rows = await sql`SELECT id FROM contacts WHERE phone = ${normalizedTo} LIMIT 1`;
      if (rows.length) contactId = rows[0].id;
    } catch (e) {
      console.error('Contact lookup failed:', e);
    }
  }

  // Log the outbound call
  if (mloId) {
    try {
      await sql`
        INSERT INTO call_logs (mlo_id, contact_id, direction, from_number, to_number, status, twilio_call_sid)
        VALUES (${mloId}, ${contactId}, 'outbound', ${process.env.TWILIO_PHONE_NUMBER || ''}, ${normalizedTo || to}, 'initiated', ${callSid})
      `;
    } catch (e) {
      console.error('Failed to log outbound call:', e);
    }
  }

  const twiml = buildOutboundTwiml(to);
  return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
}
