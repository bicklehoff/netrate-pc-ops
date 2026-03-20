// NextAuth Session Provider Wrapper
// Wraps portal pages that need session access (MLO dashboard, etc.)
// Use in layout.js files for auth-required sections.

'use client';

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';

export default function SessionProvider({ children }) {
  return (
    <NextAuthSessionProvider>
      {children}
    </NextAuthSessionProvider>
  );
}
