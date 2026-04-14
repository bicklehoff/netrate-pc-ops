import { validateTwilioSignature, twilioForbiddenResponse } from "@/lib/twilio-validate";
// Dialer Call Complete — Handles post-dial action for incoming calls
// Twilio POSTs here after the <Dial> in the incoming call TwiML completes.
// If the call wasn't answered (DialCallStatus != completed), route to voicemail.

export async function POST(req) {
  const formData = await req.formData();
  const params = Object.fromEntries(formData.entries());
  const { valid } = validateTwilioSignature(req, params);
  if (!valid) return twilioForbiddenResponse();
  const dialStatus = formData.get('DialCallStatus'); // completed, no-answer, busy, failed, canceled

  // If the call was answered and completed normally, just hang up
  if (dialStatus === 'completed') {
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup /></Response>',
      { headers: { 'Content-Type': 'text/xml' } }
    );
  }

  // Otherwise, offer voicemail
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Sorry, no one is available to take your call. Please leave a message after the beep.</Say>
  <Record maxLength="120" action="/api/dialer/voicemail" />
</Response>`,
    { headers: { 'Content-Type': 'text/xml' } }
  );
}
