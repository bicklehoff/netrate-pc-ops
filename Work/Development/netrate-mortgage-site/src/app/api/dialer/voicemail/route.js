// Dialer Voicemail — Handles voicemail recording completion
// Twilio POSTs here after a caller leaves a voicemail.
// Saves the recording URL to the call log.

import prisma from '@/lib/prisma';
import { buildVoicemailTwiml } from '@/lib/twilio-voice';

export async function POST(req) {
  const formData = await req.formData();
  const callSid = formData.get('CallSid');
  const recordingUrl = formData.get('RecordingUrl');

  if (callSid && recordingUrl) {
    try {
      await prisma.callLog.updateMany({
        where: { twilioCallSid: callSid },
        data: {
          recordingUrl,
          status: 'voicemail',
        },
      });
    } catch (e) {
      console.error('Failed to save voicemail:', e);
    }
  }

  const twiml = buildVoicemailTwiml();
  return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
}
