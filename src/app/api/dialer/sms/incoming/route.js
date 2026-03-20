// Dialer SMS Incoming Webhook — Receives inbound SMS from Twilio
// Twilio POSTs here when someone texts your Twilio phone number.
// Stores the message and returns TwiML (empty response = no auto-reply).
//
// Configure this URL as the "Messaging Webhook" on your Twilio phone number.

import prisma from '@/lib/prisma';

export async function POST(req) {
  const formData = await req.formData();
  const from = formData.get('From');         // Sender's phone
  const to = formData.get('To');             // Your Twilio number
  const body = formData.get('Body');
  const messageSid = formData.get('MessageSid');

  // Look up sender in contacts
  let contactId = null;
  if (from) {
    try {
      const contact = await prisma.contact.findFirst({ where: { phone: from } });
      if (contact) contactId = contact.id;
    } catch (e) {
      console.error('Contact lookup for incoming SMS failed:', e);
    }
  }

  // Store the inbound message
  try {
    await prisma.smsMessage.create({
      data: {
        contactId,
        direction: 'inbound',
        fromNumber: from || '',
        toNumber: to || '',
        body: body || '',
        status: 'received',
        twilioMessageSid: messageSid,
      },
    });
  } catch (e) {
    console.error('Failed to store incoming SMS:', e);
  }

  // Return empty TwiML (no auto-reply — MLOs will reply manually)
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    { headers: { 'Content-Type': 'text/xml' } }
  );
}
