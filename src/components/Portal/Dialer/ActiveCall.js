'use client';

import { useState } from 'react';
import { useDialer } from './DialerProvider';

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function NumberInput({ placeholder, onConfirm, onCancel, loading }) {
  const [value, setValue] = useState('');
  return (
    <div className="mt-3 flex flex-col gap-2">
      <input
        type="tel"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/40"
        autoFocus
      />
      <div className="flex gap-2">
        <button
          onClick={() => onConfirm(value)}
          disabled={!value.trim() || loading}
          className="flex-1 py-1.5 text-xs bg-brand text-white rounded-lg disabled:opacity-50 hover:bg-brand-dark"
        >
          {loading ? 'Connecting…' : 'Connect'}
        </button>
        <button
          onClick={onCancel}
          className="flex-1 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function ActiveCall() {
  const {
    callState,
    callerInfo,
    callDuration,
    isMuted,
    isOnHold,
    hangup,
    toggleMute,
    toggleHold,
    startTransfer,
    cancelTransfer,
    executeTransfer,
    startConference,
    cancelConference,
    executeConference,
    transferState,
    conferenceState,
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
    'in-progress': isOnHold ? 'On Hold' : formatDuration(callDuration),
  }[callState];

  const showExtras = callState === IN_PROGRESS;

  return (
    <div className="bg-brand/5 border border-brand/20 rounded-xl p-4">
      {/* Caller info */}
      <div className="text-center mb-3">
        <div className="w-12 h-12 mx-auto bg-brand/10 rounded-full flex items-center justify-center mb-2">
          <svg className="w-6 h-6 text-brand" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
          </svg>
        </div>
        <p className="font-semibold text-gray-900 text-sm">
          {callerInfo?.name || callerInfo?.phone || 'Unknown'}
        </p>
        {callerInfo?.name && callerInfo?.phone && (
          <p className="text-xs text-gray-500">{callerInfo.phone}</p>
        )}
        <p className={`text-sm mt-1 font-mono ${isOnHold ? 'text-amber-500' : callState === IN_PROGRESS ? 'text-green-600' : 'text-amber-600'}`}>
          {statusLabel}
        </p>
      </div>

      {/* Primary controls */}
      <div className="flex items-center justify-center gap-3">
        {/* Mute */}
        <button
          onClick={toggleMute}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
            isMuted ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z" /></svg>
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" /></svg>
          )}
        </button>

        {/* Hold */}
        {showExtras && (
          <button
            onClick={toggleHold}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
              isOnHold ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title={isOnHold ? 'Resume' : 'Hold'}
          >
            {isOnHold ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
            )}
          </button>
        )}

        {/* Dial Pad */}
        <button
          onClick={() => setShowDialPad(!showDialPad)}
          className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
            showDialPad ? 'bg-brand/10 text-brand' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          title="Dial Pad"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 19a2 2 0 100-4 2 2 0 000 4zM6 7a2 2 0 100-4 2 2 0 000 4zm6 0a2 2 0 100-4 2 2 0 000 4zm6 0a2 2 0 100-4 2 2 0 000 4zM6 13a2 2 0 100-4 2 2 0 000 4zm6 0a2 2 0 100-4 2 2 0 000 4zm6 0a2 2 0 100-4 2 2 0 000 4z" /></svg>
        </button>

        {/* Hang up */}
        <button
          onClick={hangup}
          className="w-13 h-13 w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
          title="End Call"
        >
          <svg className="w-6 h-6 text-white rotate-[135deg]" fill="currentColor" viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" /></svg>
        </button>
      </div>

      {/* Transfer / Add Call row */}
      {showExtras && !transferState && !conferenceState && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={startTransfer}
            className="flex-1 py-1.5 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
            Transfer
          </button>
          <button
            onClick={startConference}
            className="flex-1 py-1.5 text-xs text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Call
          </button>
        </div>
      )}

      {/* Transfer input */}
      {transferState === 'selecting' && (
        <NumberInput
          placeholder="Transfer to number..."
          onConfirm={executeTransfer}
          onCancel={cancelTransfer}
          loading={transferState === 'transferring'}
        />
      )}
      {transferState === 'transferring' && (
        <p className="mt-2 text-xs text-center text-amber-600">Transferring...</p>
      )}

      {/* Conference input */}
      {conferenceState === 'selecting' && (
        <NumberInput
          placeholder="Add participant number..."
          onConfirm={executeConference}
          onCancel={cancelConference}
          loading={false}
        />
      )}
      {conferenceState === 'connecting' && (
        <p className="mt-2 text-xs text-center text-amber-600">Connecting participant...</p>
      )}
      {conferenceState === 'active' && (
        <p className="mt-2 text-xs text-center text-green-600">3-way call active</p>
      )}
    </div>
  );
}
