// Dialer SMS Status Callback — Receives SMS delivery status updates
// Twilio POSTs here as messages progress: queued → sent → delivered (or failed/undelivered)

import sql from '@/lib/db';

export async function POST(req) {
  const formData = await req.formData();
  const messageSid = formData.get('MessageSid');
  const messageStatus = formData.get('MessageStatus'); // queued, sent, delivered, undelivered, failed

  if (messageSid && messageStatus) {
    try {
      await sql`
        UPDATE sms_messages SET status = ${messageStatus}
        WHERE twilio_message_sid = ${messageSid}
      `;
    } catch (e) {
      console.error('Failed to update SMS status:', e);
    }
  }

  return new Response('OK', { status: 200 });
}
