// AudioSettings — Pick which physical audio device handles ring vs. call audio.
// Lets the MLO put incoming ring on desk speakers while taking calls on a
// headset. Selections persist in localStorage and re-apply on reload.

'use client';

import { useEffect } from 'react';
import { useDialer } from './DialerProvider';

export default function AudioSettings({ onClose }) {
  const {
    audioDevices,
    ringtoneDeviceId,
    speakerDeviceId,
    inputDeviceId,
    outputSelectionSupported,
    setRingtoneDevice,
    setSpeakerDevice,
    setInputDevice,
    testRingtone,
    testSpeaker,
    smsPopupEnabled,
    smsSoundEnabled,
    smsBadgeEnabled,
    setSmsPopupEnabled,
    setSmsSoundEnabled,
    setSmsBadgeEnabled,
    testSmsChime,
  } = useDialer();

  // Trigger a permission prompt if labels are empty — without mic permission,
  // enumerateDevices returns devices with blank labels, which makes the
  // dropdowns useless. Asking once on open is the gentlest fix.
  useEffect(() => {
    const needsPermission = audioDevices.outputs.some((d) => !d.label) || audioDevices.inputs.some((d) => !d.label);
    if (needsPermission && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => stream.getTracks().forEach((t) => t.stop()))
        .catch(() => { /* user denied — labels stay blank, fall back to deviceId */ });
    }
  }, [audioDevices]);

  return (
    <div className="px-3 py-3 border-b border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-gray-900">Audio devices</h4>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 p-1"
          title="Close"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {!outputSelectionSupported && (
        <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 mb-2">
          This browser doesn&apos;t support output device selection. Use Chrome or Edge for split ringer/speaker routing.
        </p>
      )}

      {/* Ringtone output (desk speakers) */}
      <div className="mb-3">
        <label className="block text-[10px] font-medium text-gray-600 mb-1">
          Ring on
        </label>
        <div className="flex gap-1">
          <select
            value={ringtoneDeviceId || ''}
            onChange={(e) => setRingtoneDevice(e.target.value)}
            disabled={!outputSelectionSupported}
            className="flex-1 text-xs border border-gray-300 rounded px-2 py-1.5 bg-white disabled:bg-gray-100 disabled:text-gray-400"
          >
            <option value="">Browser default</option>
            {audioDevices.outputs.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Output ${d.deviceId.slice(0, 6)}`}
              </option>
            ))}
          </select>
          <button
            onClick={testRingtone}
            className="text-[10px] px-2 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
            title="Play sample ring"
          >
            Test
          </button>
        </div>
      </div>

      {/* Speaker output (call audio — headset) */}
      <div className="mb-3">
        <label className="block text-[10px] font-medium text-gray-600 mb-1">
          Call audio on
        </label>
        <div className="flex gap-1">
          <select
            value={speakerDeviceId || ''}
            onChange={(e) => setSpeakerDevice(e.target.value)}
            disabled={!outputSelectionSupported}
            className="flex-1 text-xs border border-gray-300 rounded px-2 py-1.5 bg-white disabled:bg-gray-100 disabled:text-gray-400"
          >
            <option value="">Browser default</option>
            {audioDevices.outputs.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Output ${d.deviceId.slice(0, 6)}`}
              </option>
            ))}
          </select>
          <button
            onClick={testSpeaker}
            className="text-[10px] px-2 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
            title="Play sample tone"
          >
            Test
          </button>
        </div>
      </div>

      {/* Microphone input */}
      <div className="mb-4">
        <label className="block text-[10px] font-medium text-gray-600 mb-1">
          Microphone
        </label>
        <select
          value={inputDeviceId || ''}
          onChange={(e) => setInputDevice(e.target.value)}
          className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 bg-white"
        >
          <option value="">Browser default</option>
          {audioDevices.inputs.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Mic ${d.deviceId.slice(0, 6)}`}
            </option>
          ))}
        </select>
      </div>

      {/* Dock launcher */}
      <div className="pt-3 border-t border-gray-200 mb-3">
        <button
          onClick={() => {
            // Pop out the dock as a small floating window. Stable name lets
            // subsequent clicks re-focus the existing dock instead of stacking.
            window.open(
              '/portal/dock',
              'NetRateDock',
              'width=320,height=600,menubar=no,toolbar=no,location=no,status=no,resizable=yes',
            );
          }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-brand/10 text-brand hover:bg-brand/20 text-xs font-medium transition-colors"
          title="Open the floating dock window"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          Open dock window
        </button>
      </div>

      {/* SMS notifications section */}
      <div className="pt-3 border-t border-gray-200">
        <h4 className="text-xs font-semibold text-gray-900 mb-2">SMS notifications</h4>

        <Toggle
          label="Show in-portal popup"
          checked={smsPopupEnabled}
          onChange={(v) => setSmsPopupEnabled(v)}
        />

        <div className="flex items-center gap-2">
          <Toggle
            label="Play sound on new SMS"
            checked={smsSoundEnabled}
            onChange={(v) => setSmsSoundEnabled(v)}
          />
          <button
            onClick={testSmsChime}
            className="text-[10px] px-2 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
            title="Play sample chime"
          >
            Test
          </button>
        </div>

        <Toggle
          label="Show unread count on taskbar (PWA only)"
          checked={smsBadgeEnabled}
          onChange={(v) => setSmsBadgeEnabled(v)}
        />
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5 cursor-pointer">
      <span className="text-xs text-gray-700 flex-1">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-brand' : 'bg-gray-300'}`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`}
        />
      </button>
    </label>
  );
}
