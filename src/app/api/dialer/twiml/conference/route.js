// Public TwiML endpoint — Twilio fetches this when a call leg joins a conference.
export async function POST(req) {
  const { searchParams } = new URL(req.url);
  const room = searchParams.get('room') || 'default';

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference beep="false" waitUrl="https://twimlets.com/holdmusic?Bucket=com.twilio.music.ambient" waitMethod="GET">${room}</Conference>
  </Dial>
</Response>`;

  return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
}
