import { validateTwilioSignature, twilioForbiddenResponse } from '@/lib/twilio-validate';
import sql from '@/lib/db';

// Twilio POSTs here when transcription is ready for a voicemail recording.
export async function POST(req) {
  const formData = await req.formData();
  const params = Object.fromEntries(formData.entries());
  const { valid } = validateTwilioSignature(req, params);
  if (!valid) return twilioForbiddenResponse();

  const callSid = formData.get('CallSid');
  const transcriptionText = formData.get('TranscriptionText');
  const transcriptionStatus = formData.get('TranscriptionStatus');

  if (callSid && transcriptionText && transcriptionStatus === 'completed') {
    try {
      await sql`
        UPDATE call_logs SET transcription_text = ${transcriptionText}
        WHERE twilio_call_sid = ${callSid}
      `;
    } catch (e) {
      console.error('Failed to save transcription:', e);
    }
  }

  return new Response('OK', { status: 200 });
}
