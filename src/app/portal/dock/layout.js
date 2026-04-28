// Dock Layout — Standalone narrow window for the floating notification panel.
// Sibling to /portal/mlo (NOT nested) so it doesn't inherit MloHeader / MloNav /
// PhonePanel — we want a clean, chrome-free sliver for pinning to a screen edge.
//
// Auth is gated by middleware.js (same MLO-token check as /portal/mlo).
// We still set up SessionProvider + DialerProvider so the dock can read
// the same SMS state, unread badge, and incoming-call lifecycle as the
// main portal — both surfaces share the polling and notification fabric.

'use client';

import { useEffect } from 'react';
import SessionProvider from '@/components/Portal/SessionProvider';
import DialerProvider from '@/components/Portal/Dialer/DialerProvider';

export default function DockLayout({ children }) {
  // Lock body scroll — the dock content owns the full viewport
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Register the same /portal/sw.js so push notifications + PWA badging
  // work even when only the dock is open.
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('/portal/sw.js')
      .catch((err) => {
        console.error('Service worker registration failed:', err);
      });
  }, []);

  return (
    <SessionProvider>
      {/* mode="passive" — dock listens for call/SMS state from the main portal
         via BroadcastChannel instead of registering its own Twilio Voice Device.
         Avoids the "most recent registration wins" collision when both windows
         are open. */}
      <DialerProvider mode="passive">
        {/* z-50 + fixed inset-0 covers the public marketing nav from the
           root layout. Same trick MloLayout uses. */}
        <div className="flex flex-col h-screen fixed inset-0 z-50 bg-gray-50 overflow-hidden">
          {children}
        </div>
      </DialerProvider>
    </SessionProvider>
  );
}
