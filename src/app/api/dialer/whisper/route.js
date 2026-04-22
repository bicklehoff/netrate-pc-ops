import { validateTwilioSignature, twilioForbiddenResponse } from '@/lib/twilio-validate';
import sql from '@/lib/db';
import { normalizePhone } from '@/lib/normalize-phone';

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Twilio fires this when the cell leg of the parallel <Dial> answers — BEFORE
// the caller is bridged in. The TwiML we return plays privately to the MLO
// (announcement whisper) and then Twilio bridges the two legs automatically
// when the TwiML completes.
export async function POST(req) {
  const formData = await req.formData();
  const params = Object.fromEntries(formData.entries());
  const { valid } = validateTwilioSignature(req, params);
  if (!valid) return twilioForbiddenResponse();

  const from = formData.get('From');
  const normalizedFrom = normalizePhone(from);

  let callerName = null;
  if (normalizedFrom) {
    try {
      const rows = await sql`SELECT first_name, last_name FROM contacts WHERE phone = ${normalizedFrom} LIMIT 1`;
      if (rows.length) {
        callerName = `${rows[0].first_name || ''} ${rows[0].last_name || ''}`.trim() || null;
      }
    } catch (e) {
      console.error('Whisper contact lookup failed:', e);
    }
  }

  const announcement = callerName
    ? `NetRate Mortgage call from ${callerName}.`
    : 'NetRate Mortgage call from an unknown number.';

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>${escapeXml(announcement)}</Say>
</Response>`;

  return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
}
