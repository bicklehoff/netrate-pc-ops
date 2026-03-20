// Dialer Status Callback — Receives call status updates from Twilio
// Twilio POSTs here as calls progress through states:
// initiated → ringing → in-progress → completed (or failed/busy/no-answer)
// Updates the CallLog record with the current status and duration.

import prisma from '@/lib/prisma';

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
    const updateData = { status: callStatus };

    if (duration) {
      updateData.duration = parseInt(duration, 10);
    }

    if (recordingUrl) {
      updateData.recordingUrl = recordingUrl;
    }

    // Mark end time for terminal statuses
    if (['completed', 'failed', 'busy', 'no-answer', 'canceled'].includes(callStatus)) {
      updateData.endedAt = new Date();
    }

    await prisma.callLog.updateMany({
      where: { twilioCallSid: callSid },
      data: updateData,
    });
  } catch (e) {
    console.error('Failed to update call status:', e);
  }

  // Twilio expects 200 OK
  return new Response('OK', { status: 200 });
}
