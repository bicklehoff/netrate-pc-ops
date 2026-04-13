// DialPad — Numeric keypad for manual dialing or DTMF tones
// Used in two modes:
// 1. Idle: User types a number and hits Call
// 2. In-call: Sends DTMF digits (for IVR menus, etc.)

'use client';

import { useState } from 'react';
import { useDialer } from './DialerProvider';

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

const LETTERS = {
  '2': 'ABC', '3': 'DEF', '4': 'GHI', '5': 'JKL',
  '6': 'MNO', '7': 'PQRS', '8': 'TUV', '9': 'WXYZ',
};

export default function DialPad({ onDial }) {
  const { callState, IN_PROGRESS, sendDigits } = useDialer();
  const [number, setNumber] = useState('');

  const handleKey = (key) => {
    if (callState === IN_PROGRESS) {
      // Send DTMF during active call
      sendDigits(key);
    } else {
      setNumber((prev) => prev + key);
    }
  };

  const handleBackspace = () => {
    setNumber((prev) => prev.slice(0, -1));
  };

  const handleCall = () => {
    if (!number.trim()) return;
    // Normalize: add +1 if just 10 digits
    let formatted = number.replace(/\D/g, '');
    if (formatted.length === 10) formatted = `+1${formatted}`;
    else if (formatted.length === 11 && formatted.startsWith('1')) formatted = `+${formatted}`;
    else if (!formatted.startsWith('+')) formatted = `+${formatted}`;

    if (onDial) {
      onDial(formatted);
    }
    setNumber('');
  };

  const inCall = callState === IN_PROGRESS;

  return (
    <div className="flex flex-col items-center">
      {/* Number display (only when not in a call) */}
      {!inCall && (
        <div className="w-full mb-3">
          <div className="flex items-center bg-surface-alt rounded-lg border border-gray-200 px-3 py-2">
            <input
              type="tel"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="Enter number..."
              className="flex-1 bg-transparent text-lg font-mono text-ink outline-none placeholder-gray-400"
              onKeyDown={(e) => e.key === 'Enter' && handleCall()}
            />
            {number && (
              <button
                onClick={handleBackspace}
                className="text-ink-subtle hover:text-ink-mid ml-2"
                title="Backspace"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414-6.414A2 2 0 0110.828 5H21a1 1 0 011 1v12a1 1 0 01-1 1H10.828a2 2 0 01-1.414-.586L3 12z" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Keypad grid */}
      <div className="grid grid-cols-3 gap-2 w-full max-w-[220px]">
        {KEYS.map((row) =>
          row.map((key) => (
            <button
              key={key}
              onClick={() => handleKey(key)}
              className="flex flex-col items-center justify-center h-14 rounded-nr-xl bg-surface-alt hover:bg-gray-100 active:bg-gray-200 transition-colors border border-gray-200"
            >
              <span className="text-xl font-semibold text-ink">{key}</span>
              {LETTERS[key] && (
                <span className="text-[9px] text-ink-subtle tracking-widest">{LETTERS[key]}</span>
              )}
            </button>
          ))
        )}
      </div>

      {/* Call button (only when idle) */}
      {!inCall && (
        <button
          onClick={handleCall}
          disabled={!number.trim()}
          className="mt-3 w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 disabled:bg-gray-200 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
        >
          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
          </svg>
        </button>
      )}
    </div>
  );
}
