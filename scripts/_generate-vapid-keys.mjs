/**
 * Generate a VAPID key pair for Web Push Protocol.
 *
 * VAPID ("Voluntary Application Server Identification") is the auth mechanism
 * for web push — the server signs push messages with the private key, the
 * browser verifies using the public key embedded in the client subscription.
 *
 * ONE-SHOT: run this once, copy the keys into Vercel env vars:
 *   - NEXT_PUBLIC_VAPID_PUBLIC_KEY  (exposed to client — used in PushManager.subscribe)
 *   - VAPID_PRIVATE_KEY             (server only — used to sign push payloads)
 *   - VAPID_SUBJECT                 (mailto:… contact the push service reaches you at)
 *
 * Do NOT regenerate these once live. Regenerating invalidates every existing
 * subscription — all staff would have to re-subscribe from every device.
 *
 * Run: node scripts/_generate-vapid-keys.mjs
 */

import webPush from 'web-push';

const keys = webPush.generateVAPIDKeys();

console.log('─────────────────────────────────────────────────────');
console.log('VAPID KEY PAIR — add these to Vercel env vars:');
console.log('─────────────────────────────────────────────────────');
console.log();
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('VAPID_SUBJECT=mailto:david@netratemortgage.com');
console.log();
console.log('─────────────────────────────────────────────────────');
console.log('Set in Vercel dashboard → Project Settings → Environment Variables');
console.log('Apply to: Production, Preview, Development');
console.log('Redeploy after setting.');
console.log('─────────────────────────────────────────────────────');
