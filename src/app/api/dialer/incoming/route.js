import { validateTwilioSignature, twilioForbiddenResponse } from "@/lib/twilio-validate";
import { buildIncomingTwiml } from '@/lib/twilio-voice';
import sql from '@/lib/db';
import { normalizePhone } from '@/lib/normalize-phone';
import { DEFAULT_ORG_ID } from '@/lib/constants/org';

export async function POST(req) {
  const formData = await req.formData();
  const params = Object.fromEntries(formData.entries());
  const { valid } = validateTwilioSignature(req, params);
  if (!valid) return twilioForbiddenResponse();
  const from = formData.get('From');       // Caller's phone number
  const to = formData.get('To');           // Your Twilio number
  const callSid = formData.get('CallSid');

  // Normalize caller phone for consistent lookup
  const normalizedFrom = normalizePhone(from);

  // Look up the caller in contacts
  let callerName = null;
  let contactId = null;
  if (normalizedFrom) {
    try {
      const rows = await sql`SELECT id, first_name, last_name FROM contacts WHERE phone = ${normalizedFrom} LIMIT 1`;
      if (rows.length) {
        callerName = `${rows[0].first_name} ${rows[0].last_name}`;
        contactId = rows[0].id;
      }
    } catch (e) {
      console.error('Incoming contact lookup failed:', e);
    }
  }

  // Find the first available MLO to ring.
  let targetIdentity = 'mlo-default';
  try {
    const mlos = await sql`SELECT id FROM staff LIMIT 1`;
    if (mlos.length > 0) {
      targetIdentity = `mlo-${mlos[0].id}`;

      // Log the inbound call
      await sql`
        INSERT INTO call_logs (organization_id, mlo_id, contact_id, direction, from_number, to_number, status, twilio_call_sid)
        VALUES (${DEFAULT_ORG_ID}, ${mlos[0].id}, ${contactId}, 'inbound', ${normalizedFrom || from || ''}, ${normalizePhone(to) || to || ''}, 'ringing', ${callSid})
      `;
    }
  } catch (e) {
    console.error('MLO lookup failed:', e);
  }

  const twiml = buildIncomingTwiml(targetIdentity, callerName);
  return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
}
