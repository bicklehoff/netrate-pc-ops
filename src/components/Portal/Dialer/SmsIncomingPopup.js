// SmsIncomingPopup — Floating toast for newly arrived inbound SMS.
// Mirrors IncomingCallPopup's UX: top-right, sender + preview, primary
// "Open thread" action + dismiss. Auto-dismisses via timer in DialerProvider.

'use client';

import Link from 'next/link';
import { useDialer } from './DialerProvider';

export default function SmsIncomingPopup() {
  const { incomingSms, dismissIncomingSms } = useDialer();

  if (!incomingSms) return null;

  const { contactId, contactName, phone, body } = incomingSms;
  const displayName = contactName || phone || 'Unknown';
  const preview = (body || '').slice(0, 140);

  const threadUrl = contactId
    ? `/portal/mlo/messages?contact=${contactId}`
    : `/portal/mlo/messages?phone=${encodeURIComponent(phone)}`;

  return (
    <div className="fixed top-4 right-4 z-[100] animate-in slide-in-from-top-2 duration-300">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-5 w-80">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-brand/10 flex-shrink-0">
            <svg className="w-5 h-5 text-brand" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">New text</p>
            <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
            {contactName && phone && (
              <p className="text-[11px] text-gray-500 truncate">{phone}</p>
            )}
          </div>
          <button
            onClick={dismissIncomingSms}
            className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex-shrink-0"
            title="Dismiss"
            aria-label="Dismiss"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {preview && (
          <p className="text-sm text-gray-700 mb-3 line-clamp-3">
            &ldquo;{preview}&rdquo;
          </p>
        )}

        <div className="flex gap-2">
          <Link
            href={threadUrl}
            onClick={dismissIncomingSms}
            className="flex-1 text-center py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-dark transition-colors"
          >
            Open thread
          </Link>
        </div>
      </div>
    </div>
  );
}
