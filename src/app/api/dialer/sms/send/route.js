// Dialer SMS Send — Sends an SMS to a contact
// Auth: MLO session required
// Stores the message in SmsMessage table and sends via Twilio.

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendSms } from '@/lib/twilio-voice';
import prisma from '@/lib/prisma';
import { normalizePhone } from '@/lib/normalize-phone';

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { to, body, contactId } = await req.json();

  if (!to || !body) {
    return Response.json({ error: 'Missing "to" or "body"' }, { status: 400 });
  }

  const normalizedTo = normalizePhone(to) || to;

  try {
    // Send via Twilio
    const twilioResponse = await sendSms(normalizedTo, body);

    // Store in DB
    const message = await prisma.smsMessage.create({
      data: {
        contactId: contactId || null,
        mloId: session.user.id,
        direction: 'outbound',
        fromNumber: process.env.TWILIO_PHONE_NUMBER,
        toNumber: normalizedTo,
        body,
        status: twilioResponse.status || 'queued',
        twilioMessageSid: twilioResponse.sid,
      },
    });

    return Response.json({ message });
  } catch (e) {
    console.error('SMS send failed:', e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
