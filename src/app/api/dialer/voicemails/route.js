import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';
import sql from '@/lib/db';

export async function GET() {
  const { session, orgId } = await requireMloSession();
  if (!session) return unauthorizedResponse();

  const rows = await sql`
    SELECT
      cl.id,
      cl.from_number,
      cl.started_at,
      cl.duration,
      cl.recording_url,
      cl.transcription_text,
      cl.voicemail_heard_at,
      c.id        AS contact_id,
      c.first_name,
      c.last_name,
      c.phone     AS contact_phone
    FROM call_logs cl
    LEFT JOIN contacts c ON c.id = cl.contact_id
    WHERE cl.organization_id = ${orgId}
      AND cl.status = 'voicemail'
      AND cl.recording_url IS NOT NULL
    ORDER BY cl.started_at DESC
    LIMIT 50
  `;

  return Response.json({ voicemails: rows });
}
