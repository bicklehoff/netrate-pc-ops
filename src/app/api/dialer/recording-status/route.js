// Dialer Recording Status — Receives recording completion events from Twilio
// Twilio POSTs here when a call recording is ready.
// Updates the call_logs with the recording URL.

import sql from '@/lib/db';

export async function POST(req) {
  const formData = await req.formData();
  const callSid = formData.get('CallSid');
  const recordingUrl = formData.get('RecordingUrl');
  const recordingStatus = formData.get('RecordingStatus'); // completed, failed

  if (callSid && recordingUrl && recordingStatus === 'completed') {
    try {
      await sql`
        UPDATE call_logs SET recording_url = ${recordingUrl}
        WHERE twilio_call_sid = ${callSid}
      `;
    } catch (e) {
      console.error('Failed to save recording URL:', e);
    }
  }

  return new Response('OK', { status: 200 });
}
