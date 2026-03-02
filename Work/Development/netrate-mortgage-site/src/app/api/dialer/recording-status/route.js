// Dialer Recording Status — Receives recording completion events from Twilio
// Twilio POSTs here when a call recording is ready.
// Updates the CallLog with the recording URL.

import prisma from '@/lib/prisma';

export async function POST(req) {
  const formData = await req.formData();
  const callSid = formData.get('CallSid');
  const recordingUrl = formData.get('RecordingUrl');
  const recordingStatus = formData.get('RecordingStatus'); // completed, failed

  if (callSid && recordingUrl && recordingStatus === 'completed') {
    try {
      await prisma.callLog.updateMany({
        where: { twilioCallSid: callSid },
        data: { recordingUrl },
      });
    } catch (e) {
      console.error('Failed to save recording URL:', e);
    }
  }

  return new Response('OK', { status: 200 });
}
