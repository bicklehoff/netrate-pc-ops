// Web Push helpers — sends notifications to all of a staff member's
// registered devices (PWA installs on iPhone, Mac, etc.).
//
// VAPID keys must be set in env vars before push can fire:
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY — client-side, used in PushManager.subscribe
//   VAPID_PRIVATE_KEY            — server-side, signs push payloads
//   VAPID_SUBJECT                — mailto:… contact
//
// Generated once via scripts/_generate-vapid-keys.mjs — do NOT regenerate
// once live (invalidates every existing subscription).

import webPush from 'web-push';
import sql from '@/lib/db';

let vapidConfigured = false;

function configureVapid() {
  if (vapidConfigured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    console.warn('VAPID env vars not set — push notifications disabled');
    return false;
  }
  webPush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

/**
 * Send a push notification to every active subscription a staff member has.
 * Returns summary: {sent, failed, pruned}.
 *
 * - sent: push successfully handed to the push service (not delivery-confirmed)
 * - failed: push service rejected for a reason we don't auto-prune (retry later)
 * - pruned: subscription was 404/410 (browser uninstalled / expired) — deleted
 *
 * Never throws — best-effort, errors logged.
 *
 * @param {string} staffId
 * @param {{title: string, body: string, url?: string, tag?: string, data?: object}} payload
 */
export async function sendPushToStaff(staffId, payload) {
  if (!configureVapid()) return { sent: 0, failed: 0, pruned: 0 };

  let subscriptions;
  try {
    subscriptions = await sql`
      SELECT id, endpoint, p256dh, auth FROM push_subscriptions
      WHERE staff_id = ${staffId}
    `;
  } catch (e) {
    console.error('Failed to load push subscriptions:', e);
    return { sent: 0, failed: 0, pruned: 0 };
  }

  if (subscriptions.length === 0) return { sent: 0, failed: 0, pruned: 0 };

  const serializedPayload = JSON.stringify(payload);
  let sent = 0, failed = 0, pruned = 0;
  const expiredIds = [];

  await Promise.all(subscriptions.map(async (sub) => {
    try {
      await webPush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        serializedPayload,
        { TTL: 60 } // short TTL — if the push service can't deliver in 60s, drop it (call is over)
      );
      sent++;
    } catch (err) {
      // 404 / 410 mean the subscription is dead (user uninstalled PWA or
      // revoked permission). Prune so we don't keep trying.
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        expiredIds.push(sub.id);
        pruned++;
      } else {
        failed++;
        console.error(`Push to sub ${sub.id} failed (${err?.statusCode}):`, err?.body || err?.message);
      }
    }
  }));

  if (expiredIds.length > 0) {
    try {
      await sql`DELETE FROM push_subscriptions WHERE id = ANY(${expiredIds}::uuid[])`;
    } catch (e) {
      console.error('Failed to prune expired subscriptions:', e);
    }
  }

  // Update last_used_at on remaining subscriptions (fire-and-forget)
  sql`
    UPDATE push_subscriptions SET last_used_at = NOW()
    WHERE staff_id = ${staffId}
  `.catch(() => {});

  return { sent, failed, pruned };
}
