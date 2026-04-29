// MLO Layout — Wraps all /portal/mlo/* routes with NextAuth SessionProvider + Dialer
// Phone panel is a floating window that doesn't affect the content layout.

'use client';

import { useEffect } from 'react';
import SessionProvider from '@/components/Portal/SessionProvider';
import DialerProvider from '@/components/Portal/Dialer/DialerProvider';
import PhonePanel from '@/components/Portal/Dialer/PhonePanel';
import { IncomingCallPopup, SmsIncomingPopup } from '@/components/Portal/Dialer';
import MloNav from '@/components/Portal/MloNav';
import MloHeader from '@/components/Portal/MloHeader';

export default function MloLayout({ children }) {
  // Lock body scroll — MLO portal owns the full viewport
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Register the service worker scoped to /portal/mlo/ so Chrome treats the
  // MLO portal as a distinct PWA from the dock (/portal/dock/). Two PWAs on
  // the same origin require separate SW registrations with non-overlapping
  // scopes — sharing the same /portal/ registration causes Chrome to suppress
  // the second install prompt. Scope /portal/mlo/ is valid because the SW
  // file lives at /portal/sw.js (a parent path), which allows any sub-scope.
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('/portal/sw.js', { scope: '/portal/mlo/' })
      .catch((err) => {
        console.error('Service worker registration failed:', err);
      });
  }, []);

  return (
    <SessionProvider>
      <DialerProvider>
        {/* Incoming call popup (floating, always available) */}
        <IncomingCallPopup />

        {/* Incoming SMS popup (floating, always available) */}
        <SmsIncomingPopup />

        {/* MLO portal — full viewport */}
        <div className="flex flex-col h-screen fixed inset-0 z-50 bg-gray-50">
          {/* Top header bar */}
          <MloHeader />

          {/* Main area: left nav + content (no sidebar — phone panel floats) */}
          <div className="flex flex-1 min-h-0">
            {/* Left sidebar nav */}
            <MloNav />

            {/* Main content area — gets full width now */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {children}
            </div>
          </div>
        </div>

        {/* Floating phone panel */}
        <PhonePanel />
      </DialerProvider>
    </SessionProvider>
  );
}
