import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';
import sql from '@/lib/db';

// Poll endpoint — UI calls this after "Record greeting" to detect when
// the Twilio save-greeting webhook has written the URL to the DB.
export async function GET() {
  const { session, mloId } = await requireMloSession();
  if (!session) return unauthorizedResponse();

  const rows = await sql`
    SELECT voicemail_greeting_url, voicemail_exception_url, voicemail_mode
    FROM staff WHERE id = ${mloId} LIMIT 1
  `;
  if (!rows.length) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({
    standard_url: rows[0].voicemail_greeting_url || null,
    exception_url: rows[0].voicemail_exception_url || null,
    mode: rows[0].voicemail_mode || 'standard',
  });
}
