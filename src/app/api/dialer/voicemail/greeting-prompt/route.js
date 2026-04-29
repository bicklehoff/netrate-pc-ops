// Public TwiML endpoint — Twilio calls this when the MLO answers the
// greeting-recording call. Plays a prompt then records their greeting.
export async function POST(req) {
  const { searchParams } = new URL(req.url);
  const mloId = searchParams.get('mloId') || '';
  const baseUrl = process.env.NEXTAUTH_URL || 'https://www.netratemortgage.com';

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">You're about to record your voicemail greeting. Speak after the beep. Press any key or hang up when you're done.</Say>
  <Record maxLength="60" playBeep="true" action="${baseUrl}/api/dialer/voicemail/save-greeting?mloId=${mloId}" />
</Response>`;

  return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
}
