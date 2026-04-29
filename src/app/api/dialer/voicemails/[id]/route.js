import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';
import sql from '@/lib/db';

// PATCH — mark voicemail as heard
export async function PATCH(req, { params }) {
  const { session, orgId } = await requireMloSession();
  if (!session) return unauthorizedResponse();

  const { id } = params;
  await sql`
    UPDATE call_logs
    SET voicemail_heard_at = now()
    WHERE id = ${id} AND organization_id = ${orgId} AND status = 'voicemail'
  `;

  return Response.json({ ok: true });
}

// GET — proxy Twilio recording audio (requires Basic Auth)
export async function GET(req, { params }) {
  const { session } = await requireMloSession();
  if (!session) return unauthorizedResponse();

  const { id } = params;
  const rows = await sql`
    SELECT recording_url FROM call_logs WHERE id = ${id} LIMIT 1
  `;
  const recordingUrl = rows[0]?.recording_url;
  if (!recordingUrl) return Response.json({ error: 'Not found' }, { status: 404 });

  // Append .mp3 if not already present
  const mp3Url = recordingUrl.endsWith('.mp3') ? recordingUrl : `${recordingUrl}.mp3`;
  const auth = Buffer.from(
    `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
  ).toString('base64');

  const upstream = await fetch(mp3Url, { headers: { Authorization: `Basic ${auth}` } });
  if (!upstream.ok) return Response.json({ error: 'Recording unavailable' }, { status: 502 });

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
