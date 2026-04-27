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
    ? `NetRate Mortgage call from ${callerName}. Press 1 to accept, or hang up to send to voicemail.`
    : 'NetRate Mortgage call from an unknown number. Press 1 to accept, or hang up to send to voicemail.';

  // <Gather> waits up to 10s for a digit. If 1 is pressed, /whisper-confirm
  // returns empty TwiML which ends the whisper and triggers Twilio to bridge
  // the legs. If no input, the TwiML falls through to <Hangup/> which kills
  // this leg — the parent <Dial> then completes and the parent TwiML's
  // voicemail fallback (<Say>+<Record/>) handles the caller. This gate also
  // prevents the self-call collision: when Twilio dials your cell back during
  // a call you're already on, T-Mobile voicemail picks up and "answers" the
  // leg, but voicemail can't press 1, so this leg disconnects cleanly and
  // the caller lands in our portal voicemail instead of your cell voicemail.
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" timeout="10" action="/api/dialer/whisper-confirm">
    <Say>${escapeXml(announcement)}</Say>
  </Gather>
  <Hangup />
</Response>`;

  return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
}
