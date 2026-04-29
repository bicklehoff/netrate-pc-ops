import { validateTwilioSignature, twilioForbiddenResponse } from '@/lib/twilio-validate';
import sql from '@/lib/db';

// Twilio POSTs here after the MLO finishes recording their greeting.
// Saves the recording URL to staff.voicemail_greeting_url.
export async function POST(req) {
  const formData = await req.formData();
  const params = Object.fromEntries(formData.entries());
  const { valid } = validateTwilioSignature(req, params);
  if (!valid) return twilioForbiddenResponse();

  const { searchParams } = new URL(req.url);
  const mloId = searchParams.get('mloId');
  const type = searchParams.get('type') === 'exception' ? 'exception' : 'standard';
  const recordingUrl = formData.get('RecordingUrl');

  if (mloId && recordingUrl) {
    try {
      const mp3Url = recordingUrl.endsWith('.mp3') ? recordingUrl : `${recordingUrl}.mp3`;
      if (type === 'exception') {
        await sql`UPDATE staff SET voicemail_exception_url = ${mp3Url} WHERE id = ${mloId}`;
      } else {
        await sql`UPDATE staff SET voicemail_greeting_url = ${mp3Url} WHERE id = ${mloId}`;
      }
    } catch (e) {
      console.error('Failed to save greeting URL:', e);
    }
  }

  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">Your greeting has been saved. Goodbye.</Say></Response>',
    { headers: { 'Content-Type': 'text/xml' } }
  );
}
