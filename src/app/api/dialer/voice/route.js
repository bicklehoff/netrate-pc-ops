import { validateTwilioSignature, twilioForbiddenResponse } from "@/lib/twilio-validate";
import { buildOutboundTwiml } from '@/lib/twilio-voice';
import sql from '@/lib/db';
import { normalizePhone } from '@/lib/normalize-phone';
import { DEFAULT_ORG_ID } from '@/lib/constants/org';

export async function POST(req) {
  const formData = await req.formData();
  const params = Object.fromEntries(formData.entries());
  const { valid } = validateTwilioSignature(req, params);
  if (!valid) return twilioForbiddenResponse();
  const to = formData.get('To');
  const from = formData.get('From');        // client:mlo-<uuid>
  const callSid = formData.get('CallSid');

  if (!to) {
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Say>No destination number provided.</Say></Response>',
      { headers: { 'Content-Type': 'text/xml' } }
    );
  }

  const mloId = from?.replace('client:mlo-', '') || null;
  const normalizedTo = normalizePhone(to);

  // Look up the MLO's assigned Twilio number — this becomes the outbound caller ID.
  let mloTwilioNumber = null;
  if (mloId) {
    try {
      const staffRows = await sql`SELECT twilio_phone_number FROM staff WHERE id = ${mloId} LIMIT 1`;
      mloTwilioNumber = staffRows[0]?.twilio_phone_number || null;
    } catch (e) {
      console.error('Staff Twilio number lookup failed:', e);
    }
  }

  const callerId = mloTwilioNumber || process.env.TWILIO_PHONE_NUMBER || '';

  let contactId = null;
  if (normalizedTo) {
    try {
      const rows = await sql`SELECT id FROM contacts WHERE phone = ${normalizedTo} LIMIT 1`;
      if (rows.length) contactId = rows[0].id;
    } catch (e) {
      console.error('Contact lookup failed:', e);
    }
  }

  if (mloId) {
    try {
      await sql`
        INSERT INTO call_logs (organization_id, mlo_id, contact_id, direction, from_number, to_number, status, twilio_call_sid)
        VALUES (${DEFAULT_ORG_ID}, ${mloId}, ${contactId}, 'outbound', ${callerId}, ${normalizedTo || to}, 'initiated', ${callSid})
      `;
    } catch (e) {
      console.error('Failed to log outbound call:', e);
    }
  }

  const twiml = buildOutboundTwiml(to, callerId);
  return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
}
