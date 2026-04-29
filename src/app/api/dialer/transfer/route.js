import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';

const BASE_URL = process.env.NEXTAUTH_URL || 'https://www.netratemortgage.com';

// POST { callSid, to } — blind transfer the active call to `to`.
// Redirects the parent call's TwiML to dial the destination number.
// The browser leg disconnects automatically when the parent <Dial> ends.
export async function POST(req) {
  const { session } = await requireMloSession();
  if (!session) return unauthorizedResponse();

  const { callSid, to } = await req.json();
  if (!callSid || !to) {
    return Response.json({ error: 'callSid and to are required' }, { status: 400 });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  // Redirect the in-progress call to a TwiML URL that dials the destination.
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        Url: `${BASE_URL}/api/dialer/twiml/transfer?to=${encodeURIComponent(to)}`,
        Method: 'POST',
      }),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    console.error('[Transfer] Twilio error:', data);
    return Response.json({ error: data.message || 'Transfer failed' }, { status: 502 });
  }

  return Response.json({ ok: true });
}
