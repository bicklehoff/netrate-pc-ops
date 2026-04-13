// IncomingCallPopup — Floating notification when a call comes in
// Shows caller info with Accept/Decline buttons.
// Plays a ringtone animation and auto-dismisses if the call is canceled.

'use client';

import { useDialer } from './DialerProvider';

export default function IncomingCallPopup() {
  const { callState, callerInfo, acceptCall, rejectCall, INCOMING } = useDialer();

  if (callState !== INCOMING) return null;

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 duration-300">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-5 w-80">
        {/* Pulsing ring indicator */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
              </svg>
            </div>
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500" />
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-green-600 uppercase tracking-wide">Incoming Call</p>
            <p className="font-semibold text-ink truncate">
              {callerInfo?.name || 'Unknown Caller'}
            </p>
            <p className="text-sm text-ink-subtle">{callerInfo?.phone || ''}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={rejectCall}
            className="flex-1 py-2.5 rounded-nr-xl bg-red-50 text-red-600 font-medium text-sm hover:bg-red-100 transition-colors"
          >
            Decline
          </button>
          <button
            onClick={acceptCall}
            className="flex-1 py-2.5 rounded-nr-xl bg-green-500 text-white font-medium text-sm hover:bg-green-600 transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
