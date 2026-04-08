// Dialer Incoming Call Webhook — Routes inbound calls to MLO browser clients
// Twilio POSTs here when someone calls your Twilio phone number.
// Returns TwiML that rings the appropriate MLO's browser client.
//
// This is the "Voice URL" on your Twilio phone number configuration.

import { buildIncomingTwiml } from '@/lib/twilio-voice';
import prisma from '@/lib/prisma';
import { normalizePhone } from '@/lib/normalize-phone';

export async function POST(req) {
  const formData = await req.formData();
  const from = formData.get('From');       // Caller's phone number
  const to = formData.get('To');           // Your Twilio number
  const callSid = formData.get('CallSid');

  // Normalize caller phone for consistent lookup
  const normalizedFrom = normalizePhone(from);

  // Look up the caller in contacts
  let callerName = null;
  let contactId = null;
  if (normalizedFrom) {
    try {
      const contact = await prisma.contact.findFirst({ where: { phone: normalizedFrom } });
      if (contact) {
        callerName = `${contact.firstName} ${contact.lastName}`;
        contactId = contact.id;
      }
    } catch (e) {
      console.error('Incoming contact lookup failed:', e);
    }
  }

  // Find the first available MLO to ring.
  // For now, ring all MLOs (can be smarter later with availability/routing).
  // TODO: Implement round-robin or availability-based routing
  let targetIdentity = 'mlo-default';
  try {
    const mlos = await prisma.mlo.findMany({ select: { id: true }, take: 1 });
    if (mlos.length > 0) {
      targetIdentity = `mlo-${mlos[0].id}`;

      // Log the inbound call
      await prisma.callLog.create({
        data: {
          mloId: mlos[0].id,
          contactId,
          direction: 'inbound',
          fromNumber: normalizedFrom || from || '',
          toNumber: normalizePhone(to) || to || '',
          status: 'ringing',
          twilioCallSid: callSid,
        },
      });
    }
  } catch (e) {
    console.error('MLO lookup failed:', e);
  }

  const twiml = buildIncomingTwiml(targetIdentity, callerName);
  return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
}
