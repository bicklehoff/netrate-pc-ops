import sql from '@/lib/db';
import { del } from '@vercel/blob';

export const runtime = 'nodejs';

export async function GET(req) {
  // Vercel cron requests include an Authorization header with CRON_SECRET
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await sql`
    SELECT id, media_url
    FROM sms_messages
    WHERE media_url IS NOT NULL
      AND media_purged_at IS NULL
      AND sent_at < now() - interval '90 days'
  `;

  let purged = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      await del(row.media_url);
      await sql`
        UPDATE sms_messages
        SET media_url = NULL, media_purged_at = now()
        WHERE id = ${row.id}
      `;
      purged++;
    } catch (e) {
      console.error(`Failed to purge sms_messages.id=${row.id}:`, e.message);
      errors++;
    }
  }

  return Response.json({ purged, errors, total: rows.length });
}
