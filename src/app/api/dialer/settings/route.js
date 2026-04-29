import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';
import sql from '@/lib/db';

const ALLOWED = [
  'voicemail_mode',
  'sms_auto_reply_enabled',
  'sms_auto_reply_message',
  'call_forward_enabled',
  'call_forward_number',
  'dnd_enabled',
];

export async function GET() {
  const { session, mloId } = await requireMloSession();
  if (!session) return unauthorizedResponse();

  const rows = await sql`
    SELECT
      voicemail_mode,
      voicemail_greeting_url,
      voicemail_exception_url,
      voicemail_exception_until,
      sms_auto_reply_enabled,
      sms_auto_reply_message,
      call_forward_enabled,
      call_forward_number,
      dnd_enabled
    FROM staff WHERE id = ${mloId} LIMIT 1
  `;
  if (!rows.length) return Response.json({ error: 'Staff not found' }, { status: 404 });
  return Response.json({ settings: rows[0] });
}

export async function PATCH(req) {
  const { session, mloId } = await requireMloSession();
  if (!session) return unauthorizedResponse();

  const body = await req.json();
  const updates = {};
  for (const key of ALLOWED) {
    if (key in body) updates[key] = body[key];
  }
  if (!Object.keys(updates).length) {
    return Response.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const setClauses = Object.keys(updates)
    .map((k, i) => `${k} = $${i + 1}`)
    .join(', ');
  const values = [...Object.values(updates), mloId];
  await sql.query(
    `UPDATE staff SET ${setClauses} WHERE id = $${values.length}`,
    values
  );

  return Response.json({ ok: true });
}
