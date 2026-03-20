// MLO Layout — Wraps all /portal/mlo/* routes with NextAuth SessionProvider + Dialer
// Dialer is collapsible: starts as a floating button, expands to full sidebar.

'use client';

import { useState, useEffect } from 'react';
import SessionProvider from '@/components/Portal/SessionProvider';
import DialerProvider, { useDialer } from '@/components/Portal/Dialer/DialerProvider';
import { DialerPanel } from '@/components/Portal/Dialer';
import { IncomingCallPopup } from '@/components/Portal/Dialer';
import MloNav from '@/components/Portal/MloNav';

function DialerSidebar() {
  const [expanded, setExpanded] = useState(false);
  const { callState, IDLE } = useDialer();

  // Auto-expand when a call is active
  useEffect(() => {
    if (callState !== IDLE) setExpanded(true);
  }, [callState, IDLE]);

  if (!expanded) {
    return (
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setExpanded(true)}
          className="w-14 h-14 bg-brand text-white rounded-full shadow-lg hover:bg-brand/90 hover:scale-105 transition-all flex items-center justify-center"
          title="Open Dialer"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="w-72 border-l border-gray-200 bg-white flex flex-col h-full relative flex-shrink-0">
      <button
        onClick={() => setExpanded(false)}
        className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 z-10 transition-colors"
        title="Collapse Dialer"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      <DialerPanel />
    </div>
  );
}

export default function MloLayout({ children }) {
  return (
    <SessionProvider>
      <DialerProvider>
        {/* Incoming call popup (floating, always available) */}
        <IncomingCallPopup />

        {/* Floating nav (bottom-left) */}
        <MloNav />

        {/* MLO content with collapsible dialer sidebar */}
        <div className="flex h-[calc(100vh-73px)]">
          {/* Main content area */}
          <div className="flex-1 overflow-y-auto px-6 py-8">
            {children}
          </div>

          {/* Collapsible dialer */}
          <DialerSidebar />
        </div>
      </DialerProvider>
    </SessionProvider>
  );
}
