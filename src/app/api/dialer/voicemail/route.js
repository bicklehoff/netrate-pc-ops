import { validateTwilioSignature, twilioForbiddenResponse } from "@/lib/twilio-validate";
// Dialer Voicemail — Handles voicemail recording completion
// Twilio POSTs here after a caller leaves a voicemail.
// Saves the recording URL to the call log.

import sql from '@/lib/db';
import { buildVoicemailTwiml } from '@/lib/twilio-voice';

export async function POST(req) {
  const formData = await req.formData();
  const params = Object.fromEntries(formData.entries());
  const { valid } = validateTwilioSignature(req, params);
  if (!valid) return twilioForbiddenResponse();
  const callSid = formData.get('CallSid');
  const recordingUrl = formData.get('RecordingUrl');

  if (callSid && recordingUrl) {
    try {
      await sql`
        UPDATE call_logs SET recording_url = ${recordingUrl}, status = 'voicemail'
        WHERE twilio_call_sid = ${callSid}
      `;
    } catch (e) {
      console.error('Failed to save voicemail:', e);
    }
  }

  const twiml = buildVoicemailTwiml();
  return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
}
