// PushNotificationButton — enable/disable Web Push for this device,
// with a "Send test push" action for validation.
// Mounted in MloHeader so staff can toggle it from any portal page.

'use client';

import { useEffect, useState } from 'react';
import {
  pushCapabilityState,
  enablePushNotifications,
  disablePushNotifications,
  isSubscribedOnThisDevice,
  sendTestPush,
} from '@/lib/push-client';

export default function PushNotificationButton() {
  const [state, setState] = useState({ supported: false, permission: 'default', subscribed: false });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let active = true;
    async function init() {
      const cap = pushCapabilityState();
      if (!cap.supported) {
        if (active) setState({ supported: false, permission: 'default', subscribed: false, reason: cap.reason });
        return;
      }
      const subscribed = await isSubscribedOnThisDevice();
      if (active) setState({ supported: true, permission: cap.permission, subscribed });
    }
    init();
    return () => { active = false; };
  }, []);

  async function handleEnable() {
    setBusy(true);
    setMessage(null);
    const result = await enablePushNotifications();
    if (result.ok) {
      setState((s) => ({ ...s, permission: 'granted', subscribed: true }));
      setMessage({ kind: 'success', text: 'Notifications enabled on this device.' });
    } else {
      const msg = {
        'permission-denied': 'Notification permission was denied. Enable in iOS Settings → NetRate Mortgage → Notifications.',
        'no-sw': 'Service worker not available — try refreshing.',
        'no-push-manager': 'This browser does not support push notifications.',
        'no-notifications': 'This browser does not support notifications.',
        'no-vapid-key': 'Server misconfiguration (VAPID keys not set).',
        'no-registration': 'Service worker not yet registered — refresh and try again.',
        'server-save-failed': 'Subscription saved in browser but server rejected it.',
      }[result.reason] || `Failed: ${result.reason}`;
      setMessage({ kind: 'error', text: msg });
    }
    setBusy(false);
  }

  async function handleDisable() {
    setBusy(true);
    setMessage(null);
    await disablePushNotifications();
    setState((s) => ({ ...s, subscribed: false }));
    setMessage({ kind: 'success', text: 'Notifications disabled on this device.' });
    setBusy(false);
  }

  async function handleTest() {
    setBusy(true);
    setMessage(null);
    const result = await sendTestPush();
    if (result.ok) {
      setMessage({
        kind: 'success',
        text: `Test push sent. (${result.sent} delivered, ${result.failed} failed, ${result.pruned} pruned)`,
      });
    } else {
      setMessage({ kind: 'error', text: `Test failed: ${result.reason}` });
    }
    setBusy(false);
  }

  if (!state.supported) {
    // Render nothing when the browser doesn't support push — avoids noise on desktop Safari pre-install.
    return null;
  }

  const statusColor = state.subscribed ? 'bg-go' : state.permission === 'denied' ? 'bg-red-500' : 'bg-gray-300';
  const statusLabel = state.subscribed ? 'On' : state.permission === 'denied' ? 'Blocked' : 'Off';

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border border-gray-200 hover:bg-gray-50 transition-colors"
        title="Push notifications"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.4-1.4A2 2 0 0118 14V11a6 6 0 10-12 0v3a2 2 0 01-.6 1.6L4 17h5m6 0a3 3 0 11-6 0m6 0H9" />
        </svg>
        <span className="hidden sm:inline">Notifications</span>
        <span className={`w-2 h-2 rounded-full ${statusColor}`} title={statusLabel} />
      </button>

      {expanded && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 z-50">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-sm font-semibold text-gray-900">Push Notifications</p>
              <p className="text-xs text-gray-500">This device — {statusLabel}</p>
            </div>
            <button onClick={() => setExpanded(false)} className="text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {state.permission === 'denied' && (
            <p className="text-xs text-red-600 mb-3">
              Notifications blocked. Enable in iOS Settings → NetRate Mortgage → Notifications (or browser settings).
            </p>
          )}

          {message && (
            <p className={`text-xs mb-3 ${message.kind === 'success' ? 'text-go-dark' : 'text-red-600'}`}>
              {message.text}
            </p>
          )}

          <div className="space-y-2">
            {!state.subscribed ? (
              <button
                onClick={handleEnable}
                disabled={busy || state.permission === 'denied'}
                className="w-full py-2 rounded-lg bg-go text-white font-medium text-sm hover:bg-go-dark disabled:opacity-50 transition-colors"
              >
                {busy ? '...' : 'Enable on this device'}
              </button>
            ) : (
              <>
                <button
                  onClick={handleTest}
                  disabled={busy}
                  className="w-full py-2 rounded-lg bg-brand text-white font-medium text-sm hover:bg-brand-dark disabled:opacity-50 transition-colors"
                >
                  {busy ? '...' : 'Send test push'}
                </button>
                <button
                  onClick={handleDisable}
                  disabled={busy}
                  className="w-full py-2 rounded-lg bg-gray-100 text-gray-700 font-medium text-sm hover:bg-gray-200 disabled:opacity-50 transition-colors"
                >
                  Disable on this device
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
