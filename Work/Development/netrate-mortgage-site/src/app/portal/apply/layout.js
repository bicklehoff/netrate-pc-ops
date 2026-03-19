// Apply Layout — Tunnel Vision UI
// Uses fixed positioning to visually override parent portal layout.
// Only shows: logo, security badge, and exit button.

'use client';

import Link from 'next/link';
import { ApplicationProvider } from '@/components/Portal/ApplicationContext';

export default function ApplyLayout({ children }) {
  return (
    <ApplicationProvider>
      {/* Fixed full-screen overlay — hides portal nav/footer */}
      <div className="fixed inset-0 z-40 bg-gray-50 flex flex-col overflow-auto">
        {/* Minimal header — logo + security + exit */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shrink-0">
          <div className="max-w-3xl mx-auto px-6 py-3.5 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-0.5">
              <span className="text-lg font-bold text-gray-900">Net</span>
              <span className="text-lg font-bold text-brand">Rate</span>
              <span className="text-sm font-normal text-gray-400 ml-1.5">Mortgage</span>
            </Link>
            <div className="flex items-center gap-4">
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-gray-400 font-medium">
                <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                AES-256 Encrypted
              </span>
              <Link
                href="/"
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                ✕ Exit
              </Link>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-8">
          {children}
        </main>

        {/* Minimal footer */}
        <footer className="border-t border-gray-100 shrink-0">
          <div className="max-w-3xl mx-auto px-6 py-4 text-center text-[11px] text-gray-400">
            <p>Your information is encrypted and secure. We never share your data without consent.</p>
            <p className="mt-1">
              NetRate Mortgage | NMLS #1111861 | Equal Housing Opportunity
            </p>
          </div>
        </footer>
      </div>
    </ApplicationProvider>
  );
}
