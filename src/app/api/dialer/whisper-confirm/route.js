// Whisper confirmation handler — receives the digit pressed during the
// whisper Gather. If 1, returns empty TwiML so Twilio bridges the legs.
// Anything else (including # or 0), hangs up so the parent <Dial> moves on
// to the voicemail fallback in the parent TwiML.
import { validateTwilioSignature, twilioForbiddenResponse } from '@/lib/twilio-validate';

export async function POST(req) {
  const formData = await req.formData();
  const params = Object.fromEntries(formData.entries());
  const { valid } = validateTwilioSignature(req, params);
  if (!valid) return twilioForbiddenResponse();

  const digits = formData.get('Digits');

  // Pressed 1 → accept: empty Response ends whisper TwiML normally,
  // Twilio bridges this leg to the caller.
  if (digits === '1') {
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { 'Content-Type': 'text/xml' } }
    );
  }

  // Anything else (or no input) → hangup this leg so caller gets portal voicemail.
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>',
    { headers: { 'Content-Type': 'text/xml' } }
  );
}
