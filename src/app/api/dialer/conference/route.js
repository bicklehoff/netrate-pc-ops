import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';

const BASE_URL = process.env.NEXTAUTH_URL || 'https://www.netratemortgage.com';

// POST { callSid, to } — merge the active call into a conference and
// dial `to` as a third participant.
//
// Flow:
//   1. Redirect the parent call (callSid) to conference TwiML → caller joins room
//   2. Initiate a new outbound call to `to` that also joins the same room
//   3. Browser reconnects to the conference via a new Twilio Device call
//      (the browser leg on the original <Dial> disconnects when the parent redirects)
//
// The conference room name is returned so the browser can reconnect.
export async function POST(req) {
  const { session } = await requireMloSession();
  if (!session) return unauthorizedResponse();

  const { callSid, to } = await req.json();
  if (!callSid || !to) {
    return Response.json({ error: 'callSid and to are required' }, { status: 400 });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  // Use the callSid as the conference room name — unique per call session.
  const room = `conf-${callSid.slice(-8)}`;

  // 1. Redirect the original inbound call into the conference room.
  const redirectRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        Url: `${BASE_URL}/api/dialer/twiml/conference?room=${encodeURIComponent(room)}`,
        Method: 'POST',
      }),
    }
  );
  if (!redirectRes.ok) {
    const err = await redirectRes.json();
    console.error('[Conference] redirect failed:', err);
    return Response.json({ error: err.message || 'Failed to start conference' }, { status: 502 });
  }

  // 2. Dial the third party into the same conference room.
  const dialRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: to,
        From: fromNumber,
        Url: `${BASE_URL}/api/dialer/twiml/conference?room=${encodeURIComponent(room)}`,
      }),
    }
  );
  if (!dialRes.ok) {
    const err = await dialRes.json();
    console.error('[Conference] outbound dial failed:', err);
    return Response.json({ error: err.message || 'Failed to dial participant' }, { status: 502 });
  }

  // Browser reconnects by calling the conference room via device.connect({ params: { To: 'conference:room' } })
  // The /api/dialer/voice TwiML handler will need to detect this prefix.
  return Response.json({ ok: true, room });
}
