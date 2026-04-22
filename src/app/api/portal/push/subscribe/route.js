// Push subscription management for MLO staff.
// POST: save a new subscription for the authenticated staff + this device
// DELETE: remove the caller's subscription by endpoint (unsubscribe current device)

import { requireMloSession, unauthorizedResponse } from '@/lib/require-mlo-session';
import sql from '@/lib/db';

export async function POST(req) {
  const { session, mloId } = await requireMloSession();
  if (!session) return unauthorizedResponse();

  const body = await req.json();
  const { endpoint, keys } = body || {};
  const p256dh = keys?.p256dh;
  const auth = keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return Response.json({ error: 'Missing endpoint / keys' }, { status: 400 });
  }

  const userAgent = req.headers.get('user-agent') || null;

  try {
    // Upsert on endpoint — if the same device resubscribes (e.g. key rotation),
    // update its keys and re-bind to the current staff_id.
    await sql`
      INSERT INTO push_subscriptions (staff_id, endpoint, p256dh, auth, user_agent)
      VALUES (${mloId}, ${endpoint}, ${p256dh}, ${auth}, ${userAgent})
      ON CONFLICT (endpoint) DO UPDATE
      SET staff_id = EXCLUDED.staff_id,
          p256dh = EXCLUDED.p256dh,
          auth = EXCLUDED.auth,
          user_agent = EXCLUDED.user_agent
    `;
    return Response.json({ ok: true });
  } catch (e) {
    console.error('Push subscribe failed:', e);
    return Response.json({ error: 'Failed to save subscription' }, { status: 500 });
  }
}

export async function DELETE(req) {
  const { session, mloId } = await requireMloSession();
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const endpoint = searchParams.get('endpoint');
  if (!endpoint) return Response.json({ error: 'Missing endpoint' }, { status: 400 });

  try {
    await sql`DELETE FROM push_subscriptions WHERE staff_id = ${mloId} AND endpoint = ${endpoint}`;
    return Response.json({ ok: true });
  } catch (e) {
    console.error('Push unsubscribe failed:', e);
    return Response.json({ error: 'Failed to unsubscribe' }, { status: 500 });
  }
}
