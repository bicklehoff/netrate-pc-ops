// NetRate Mortgage MLO Portal — Service Worker
// Scope: /portal/ (set via scope=/portal/ in manifest.webmanifest)
//
// Current responsibilities (PWA scaffold PR):
//   - install/activate lifecycle (required for PWA installability)
//   - claim existing clients immediately on activation
//
// Upcoming (separate PR):
//   - 'push' event handler to show notifications
//   - 'notificationclick' handler to focus/open at the deep-link URL

const SW_VERSION = 'v1-2026-04-22';

self.addEventListener('install', (event) => {
  // Activate the new service worker without waiting for open tabs to close.
  // Safe here because we don't cache anything yet.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Take control of any open tabs immediately.
  event.waitUntil(self.clients.claim());
});

// No fetch handler in the scaffold PR — we're not caching anything.
// Network-only behavior preserves existing Next.js routing + auth flows.
