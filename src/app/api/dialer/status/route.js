// Dialer Status Callback — Receives call status updates from Twilio
// Twilio POSTs here as calls progress through states:
// initiated → ringing → in-progress → completed (or failed/busy/no-answer)
// Updates the call_logs record with the current status and duration.

import sql from '@/lib/db';

export async function POST(req) {
  const formData = await req.formData();
  const callSid = formData.get('CallSid');
  const callStatus = formData.get('CallStatus');       // initiated, ringing, in-progress, completed, failed, busy, no-answer, canceled
  const duration = formData.get('CallDuration');         // Only present on completed
  const recordingUrl = formData.get('RecordingUrl');

  if (!callSid) {
    return new Response('OK', { status: 200 });
  }

  try {
    // Mark end time for terminal statuses
    const isTerminal = ['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(callStatus);

    if (duration && recordingUrl && isTerminal) {
      await sql`
        UPDATE call_logs SET status = ${callStatus}, duration = ${parseInt(duration, 10)}, recording_url = ${recordingUrl}, ended_at = NOW()
        WHERE twilio_call_sid = ${callSid}
      `;
    } else if (duration && isTerminal) {
      await sql`
        UPDATE call_logs SET status = ${callStatus}, duration = ${parseInt(duration, 10)}, ended_at = NOW()
        WHERE twilio_call_sid = ${callSid}
      `;
    } else if (recordingUrl) {
      await sql`
        UPDATE call_logs SET status = ${callStatus}, recording_url = ${recordingUrl}
        WHERE twilio_call_sid = ${callSid}
      `;
    } else if (isTerminal) {
      await sql`
        UPDATE call_logs SET status = ${callStatus}, ended_at = NOW()
        WHERE twilio_call_sid = ${callSid}
      `;
    } else {
      await sql`
        UPDATE call_logs SET status = ${callStatus}
        WHERE twilio_call_sid = ${callSid}
      `;
    }
  } catch (e) {
    console.error('Failed to update call status:', e);
  }

  // Twilio expects 200 OK
  return new Response('OK', { status: 200 });
}
