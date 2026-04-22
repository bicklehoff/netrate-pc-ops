// Client-side push subscription helpers.
// Runs in the browser / PWA. Never imports the server lib.

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export function pushCapabilityState() {
  if (typeof window === 'undefined') return { supported: false, reason: 'ssr' };
  if (!('serviceWorker' in navigator)) return { supported: false, reason: 'no-sw' };
  if (!('PushManager' in window)) return { supported: false, reason: 'no-push-manager' };
  if (!('Notification' in window)) return { supported: false, reason: 'no-notifications' };
  if (!VAPID_PUBLIC_KEY) return { supported: false, reason: 'no-vapid-key' };
  return { supported: true, permission: Notification.permission };
}

// Convert base64url VAPID key → Uint8Array for PushManager.subscribe
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

async function getActiveRegistration() {
  // /portal/sw.js registration is kicked off in MloLayout; wait for it to be ready.
  return navigator.serviceWorker.getRegistration('/portal/');
}

/**
 * Subscribe this device for push, save the subscription to the server.
 * Requests Notification permission if needed.
 * Returns { ok: true } or { ok: false, reason }
 */
export async function enablePushNotifications() {
  const state = pushCapabilityState();
  if (!state.supported) return { ok: false, reason: state.reason };

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') return { ok: false, reason: 'permission-denied' };

  const reg = await getActiveRegistration();
  if (!reg) return { ok: false, reason: 'no-registration' };

  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  // Save to server
  const res = await fetch('/api/portal/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!res.ok) return { ok: false, reason: 'server-save-failed' };
  return { ok: true };
}

/**
 * Unsubscribe this device and tell the server to drop the record.
 */
export async function disablePushNotifications() {
  const reg = await getActiveRegistration();
  if (!reg) return { ok: true };

  const subscription = await reg.pushManager.getSubscription();
  if (!subscription) return { ok: true };

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  await fetch(`/api/portal/push/subscribe?endpoint=${encodeURIComponent(endpoint)}`, {
    method: 'DELETE',
  }).catch(() => {});
  return { ok: true };
}

export async function isSubscribedOnThisDevice() {
  const reg = await getActiveRegistration();
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}

export async function sendTestPush() {
  const res = await fetch('/api/portal/push/test', { method: 'POST' });
  if (!res.ok) return { ok: false, reason: `status-${res.status}` };
  const data = await res.json();
  return { ok: true, ...data };
}
