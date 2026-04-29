// Public TwiML endpoint — Twilio fetches this when a call is blind-transferred.
// Returns <Dial> TwiML to connect the caller to the destination number.
export async function POST(req) {
  const { searchParams } = new URL(req.url);
  const to = searchParams.get('to') || '';

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>${to}</Dial>
</Response>`;

  return new Response(twiml, { headers: { 'Content-Type': 'text/xml' } });
}
