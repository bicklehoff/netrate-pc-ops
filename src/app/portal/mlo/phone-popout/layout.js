// Phone Pop-out Layout — Minimal wrapper (no nav, no header)
// This page renders in a window.open() popup, so it only needs auth.

'use client';

import SessionProvider from '@/components/Portal/SessionProvider';

export default function PhonePopoutLayout({ children }) {
  return (
    <SessionProvider>
      {children}
    </SessionProvider>
  );
}
