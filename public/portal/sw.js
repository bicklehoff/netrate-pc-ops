// NetRate Mortgage MLO Portal — Service Worker
// Located at /portal/sw.js so default scope resolves to /portal/.
//
// Responsibilities:
//   - install/activate lifecycle
//   - push event → show native notification
//   - notificationclick → focus or open the PWA at the payload URL

const SW_VERSION = 'v2-2026-04-22';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Push notifications —————————————————————————————————————————————
// Server-side payload shape (see src/lib/push.js):
//   { title, body, url?, tag?, data? }
//
// iOS Web Push REQUIRES a visible notification for every push message —
// silent data-only pushes are rejected. Always call showNotification.

self.addEventListener('push', (event) => {
  let payload = { title: 'NetRate Mortgage', body: 'New activity' };
  try {
    if (event.data) payload = event.data.json();
  } catch (e) {
    console.error('Push payload parse failed:', e);
  }

  const { title, body, tag, url, data } = payload;

  event.waitUntil(
    self.registration.showNotification(title || 'NetRate Mortgage', {
      body: body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: tag || undefined,
      data: { url: url || '/portal/mlo', ...(data || {}) },
      requireInteraction: false,
    })
  );
});

// Notification click —————————————————————————————————————————————
// Focus an open PWA window if one exists; otherwise open a new one.

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/portal/mlo';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

      for (const client of allClients) {
        if (client.url.includes('/portal/') && 'focus' in client) {
          if ('navigate' in client) {
            try { await client.navigate(targetUrl); } catch (e) { /* fall through */ }
          }
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })()
  );
});
