// IncomingCallPopup — Floating notification for inbound calls
// Two modes:
//   RINGING — callState === INCOMING: Accept/Decline buttons, pulsing indicator
//   STICKY  — after cell pickup or caller hangup: persists recent call info
//             with "Open contact" + "Dismiss". Auto-clears after 2 min.

'use client';

import Link from 'next/link';
import { useDialer } from './DialerProvider';

export default function IncomingCallPopup() {
  const {
    callState,
    callerInfo,
    recentInboundCall,
    acceptCall,
    rejectCall,
    dismissRecentInboundCall,
    INCOMING,
  } = useDialer();

  const isRinging = callState === INCOMING;
  const sticky = !isRinging && recentInboundCall;

  if (!isRinging && !sticky) return null;

  const info = isRinging ? callerInfo : recentInboundCall;
  const displayName = info?.name || 'Unknown Caller';
  const displayPhone = info?.phone || '';
  const contactId = info?.contactId || null;

  return (
    <div className="fixed top-4 right-4 z-[100] animate-in slide-in-from-top-2 duration-300">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-5 w-80">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isRinging ? 'bg-green-100' : 'bg-gray-100'}`}>
              <svg className={`w-6 h-6 ${isRinging ? 'text-green-600' : 'text-gray-600'}`} fill="currentColor" viewBox="0 0 24 24">
                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
              </svg>
            </div>
            {isRinging && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500" />
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className={`text-xs font-medium uppercase tracking-wide ${isRinging ? 'text-green-600' : 'text-gray-500'}`}>
              {isRinging ? 'Incoming Call' : 'Recent Call'}
            </p>
            <p className="font-semibold text-gray-900 truncate">{displayName}</p>
            <p className="text-sm text-gray-500">{displayPhone}</p>
          </div>
        </div>

        {isRinging ? (
          <div className="flex gap-3">
            <button
              onClick={rejectCall}
              className="flex-1 py-2.5 rounded-xl bg-red-50 text-red-600 font-medium text-sm hover:bg-red-100 transition-colors"
            >
              Decline
            </button>
            <button
              onClick={acceptCall}
              className="flex-1 py-2.5 rounded-xl bg-green-500 text-white font-medium text-sm hover:bg-green-600 transition-colors"
            >
              Accept
            </button>
          </div>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={dismissRecentInboundCall}
              className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-medium text-sm hover:bg-gray-200 transition-colors"
            >
              Dismiss
            </button>
            {contactId ? (
              <Link
                href={`/portal/mlo/contacts/${contactId}`}
                onClick={dismissRecentInboundCall}
                className="flex-1 py-2.5 rounded-xl bg-brand text-white font-medium text-sm hover:bg-brand-dark transition-colors text-center"
              >
                Open contact
              </Link>
            ) : (
              <button
                disabled
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-400 font-medium text-sm cursor-not-allowed"
                title="No contact record on file for this number"
              >
                No contact
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
