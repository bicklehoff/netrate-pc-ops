// Apply Layout — Wraps all /portal/apply/* routes with ApplicationProvider
// This preserves form state across steps.

'use client';

import { ApplicationProvider } from '@/components/Portal/ApplicationContext';

export default function ApplyLayout({ children }) {
  return (
    <ApplicationProvider>
      {children}
    </ApplicationProvider>
  );
}
