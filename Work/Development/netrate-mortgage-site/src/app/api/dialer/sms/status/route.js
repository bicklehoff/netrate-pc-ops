// Dialer SMS Status Callback — Receives SMS delivery status updates
// Twilio POSTs here as messages progress: queued → sent → delivered (or failed/undelivered)

import prisma from '@/lib/prisma';

export async function POST(req) {
  const formData = await req.formData();
  const messageSid = formData.get('MessageSid');
  const messageStatus = formData.get('MessageStatus'); // queued, sent, delivered, undelivered, failed

  if (messageSid && messageStatus) {
    try {
      await prisma.smsMessage.updateMany({
        where: { twilioMessageSid: messageSid },
        data: { status: messageStatus },
      });
    } catch (e) {
      console.error('Failed to update SMS status:', e);
    }
  }

  return new Response('OK', { status: 200 });
}
