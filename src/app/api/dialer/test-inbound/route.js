// Test Inbound Call — Trigger a Twilio API call directly to the MLO's
// Voice Client identity, simulating an inbound customer call WITHOUT
// going through the cell carrier (avoids the forwarding-loop bug fixed
// in /api/dialer/incoming).
//
// Why this exists: the simplest "test inbound" workflow used to be "call
// my own DID from my own cell." That path is now short-circuited at
// /api/dialer/incoming because cell→DID forwarding creates an unbreakable
// loop. This endpoint is the replacement: server-side Twilio API call
// directly to client:mlo-{id}, ringing the browser Voice SDK without
// involving the cell at all.
//
// What it tests:
//   - Voice Client receives 'incoming' event
//   - DialerProvider sets callState=INCOMING, broadcasts via BC
//   - Dock auto-focuses and shows green Accept/Decline banner
//   - Accept connects → bridges to Twilio TwiML which plays a Say message
//
// What it does NOT test (use a real customer call for these):
//   - /api/dialer/incoming webhook (this bypasses it entirely)
//   - Parallel-dial to MLO's cell
//   - Whisper TwiML
//   - Server-side push notifications (those fire from /api/dialer/incoming)

import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';
import sql from '@/lib/db';

export async function POST() {
  const { session, mloId } = await requireMloSession();
  if (!session) return unauthorizedResponse();

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    return Response.json({ error: 'Twilio credentials not configured' }, { status: 500 });
  }

  // Caller ID = the MLO's own Twilio DID, falls back to the env-level
  // pool number. Required because Twilio rejects API calls without a
  // valid From even when To is a Client identity.
  let fromNumber = process.env.TWILIO_PHONE_NUMBER;
  try {
    const staffRows = await sql`SELECT twilio_phone_number FROM staff WHERE id = ${mloId} LIMIT 1`;
    fromNumber = staffRows[0]?.twilio_phone_number || fromNumber;
  } catch (e) {
    console.error('Staff lookup for test-inbound failed:', e);
  }
  if (!fromNumber) {
    return Response.json({ error: 'No Twilio number assigned to staff' }, { status: 400 });
  }

  // Inline TwiML that runs after the client accepts. Brief Say so the
  // user can confirm audio is routing correctly, then hangup.
  const twiml = '<Response><Say voice="Polly.Joanna">This is a test call from your dialer. The connection is working.</Say><Pause length="1"/><Hangup/></Response>';

  const params = new URLSearchParams({
    From: fromNumber,
    To: `client:mlo-${mloId}`,
    Twiml: twiml,
  });

  const auth = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
      {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      console.error('Twilio test-inbound API error:', data);
      return Response.json({ error: data.message || 'Twilio rejected the call' }, { status: 502 });
    }
    return Response.json({ ok: true, callSid: data.sid });
  } catch (e) {
    console.error('Test inbound call failed:', e);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
