// MLO Layout — Wraps all /portal/mlo/* routes with NextAuth SessionProvider + Dialer
// This is needed for useSession() to work in MLO dashboard pages.
// The Dialer (Twilio Voice SDK) is initialized here so it's available on all MLO pages.

'use client';

import SessionProvider from '@/components/Portal/SessionProvider';
import DialerProvider from '@/components/Portal/Dialer/DialerProvider';
import { DialerPanel } from '@/components/Portal/Dialer';
import { IncomingCallPopup } from '@/components/Portal/Dialer';

export default function MloLayout({ children }) {
  return (
    <SessionProvider>
      <DialerProvider>
        {/* Incoming call popup (floating, always available) */}
        <IncomingCallPopup />

        {/* MLO content with dialer sidebar */}
        <div className="flex h-[calc(100vh-73px)]">
          {/* Main content area */}
          <div className="flex-1 overflow-y-auto px-6 py-8">
            {children}
          </div>

          {/* Dialer sidebar */}
          <DialerPanel />
        </div>
      </DialerProvider>
    </SessionProvider>
  );
}
