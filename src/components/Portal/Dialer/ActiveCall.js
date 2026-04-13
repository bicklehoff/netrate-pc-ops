// ActiveCall — Shows during an active call with controls
// Displays: caller info, duration timer, mute/hangup buttons, notes input

'use client';

import { useState } from 'react';
import { useDialer } from './DialerProvider';

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function ActiveCall() {
  const {
    callState,
    callerInfo,
    callDuration,
    isMuted,
    hangup,
    toggleMute,
    CONNECTING,
    RINGING,
    IN_PROGRESS,
  } = useDialer();

  const [showDialPad, setShowDialPad] = useState(false);

  const isActive = [CONNECTING, RINGING, IN_PROGRESS].includes(callState);
  if (!isActive) return null;

  const statusLabel = {
    connecting: 'Connecting...',
    ringing: 'Ringing...',
    'in-progress': formatDuration(callDuration),
  }[callState];

  return (
    <div className="bg-brand/5 border border-brand/20 rounded-nr-xl p-4">
      {/* Caller info */}
      <div className="text-center mb-3">
        <div className="w-12 h-12 mx-auto bg-brand/10 rounded-full flex items-center justify-center mb-2">
          <svg className="w-6 h-6 text-brand" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        </div>
        <p className="font-semibold text-ink text-sm">
          {callerInfo?.name || callerInfo?.phone || 'Unknown'}
        </p>
        {callerInfo?.name && callerInfo?.phone && (
          <p className="text-xs text-ink-subtle">{callerInfo.phone}</p>
        )}
        <p className={`text-sm mt-1 font-mono ${callState === IN_PROGRESS ? 'text-green-600' : 'text-amber-600'}`}>
          {statusLabel}
        </p>
      </div>

      {/* Call controls */}
      <div className="flex items-center justify-center gap-4">
        {/* Mute */}
        <button
          onClick={toggleMute}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
            isMuted
              ? 'bg-red-100 text-red-600'
              : 'bg-gray-100 text-ink-mid hover:bg-gray-200'
          }`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
            </svg>
          )}
        </button>

        {/* Dial Pad Toggle */}
        <button
          onClick={() => setShowDialPad(!showDialPad)}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
            showDialPad
              ? 'bg-brand/10 text-brand'
              : 'bg-gray-100 text-ink-mid hover:bg-gray-200'
          }`}
          title="Dial Pad"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 19a2 2 0 100-4 2 2 0 000 4zM6 7a2 2 0 100-4 2 2 0 000 4zm6 0a2 2 0 100-4 2 2 0 000 4zm6 0a2 2 0 100-4 2 2 0 000 4zM6 13a2 2 0 100-4 2 2 0 000 4zm6 0a2 2 0 100-4 2 2 0 000 4zm6 0a2 2 0 100-4 2 2 0 000 4z" />
          </svg>
        </button>

        {/* Hang up */}
        <button
          onClick={hangup}
          className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
          title="End Call"
        >
          <svg className="w-6 h-6 text-white rotate-[135deg]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
