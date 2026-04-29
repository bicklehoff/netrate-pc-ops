import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';
import sql from '@/lib/db';

// Initiates a call to the MLO's cell. When they answer, greeting-prompt TwiML
// plays a prompt and records their voicemail greeting.
export async function POST() {
  const { session, mloId } = await requireMloSession();
  if (!session) return unauthorizedResponse();

  const staffRows = await sql`SELECT phone FROM staff WHERE id = ${mloId} LIMIT 1`;
  const cell = staffRows[0]?.phone;
  if (!cell) {
    return Response.json({ error: 'No cell number on your staff record' }, { status: 400 });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  const baseUrl = process.env.NEXTAUTH_URL || 'https://www.netratemortgage.com';

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: cell,
        From: fromNumber,
        Url: `${baseUrl}/api/dialer/voicemail/greeting-prompt?mloId=${mloId}`,
      }),
    }
  );

  const data = await res.json();
  if (!res.ok) {
    console.error('Failed to initiate greeting call:', data);
    return Response.json({ error: data.message || 'Failed to initiate call' }, { status: 500 });
  }

  return Response.json({ callSid: data.sid });
}
