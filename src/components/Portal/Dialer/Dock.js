// Dock — Compact floating panel showing recent SMS + recent calls.
// Vertical, ~280px wide, designed to be pinned to a screen edge.
//
// Data sources:
//   - SMS: /api/dialer/sms/threads (already polled by DialerProvider every 10s;
//          we re-poll here as well for fresher data when the main portal isn't open)
//   - Calls: /api/dialer/calls?limit=20 (polled every 30s — slower-moving than SMS)
//
// Click row → opens the full thread / call detail in the main portal window.
// Uses window.open with a stable name ('NetRatePortal') so subsequent clicks
// re-focus the same window instead of stacking tabs.

'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useDialer } from './DialerProvider';

const CALLS_POLL_INTERVAL_MS = 30_000;
const SMS_POLL_INTERVAL_MS = 10_000;
const PORTAL_WINDOW_NAME = 'NetRatePortal';
const ROLLING_WINDOW_HOURS = 24;

function timeAgo(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'just now';
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const d = Math.floor(hr / 24);
  return `${d}d`;
}

function withinRollingWindow(iso) {
  if (!iso) return false;
  return Date.now() - new Date(iso).getTime() <= ROLLING_WINDOW_HOURS * 60 * 60 * 1000;
}

function openInPortal(path) {
  const url = path.startsWith('/') ? path : `/${path}`;
  // Stable window name = re-focus the existing portal window if it's open,
  // otherwise open a new one.
  window.open(url, PORTAL_WINDOW_NAME);
}

export default function Dock() {
  const { smsUnreadCount, callState, INCOMING, callerInfo } = useDialer();

  const [threads, setThreads] = useState([]);
  const [calls, setCalls] = useState([]);
  const [loadedAt, setLoadedAt] = useState(null);

  // SMS poll — independent of DialerProvider's poll so the dock has its own
  // refresh cadence even when only the dock window is open.
  useEffect(() => {
    let cancelled = false;
    const fetchThreads = async () => {
      try {
        const res = await fetch('/api/dialer/sms/threads', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setThreads(data.threads || []);
          setLoadedAt(new Date());
        }
      } catch { /* silent */ }
    };
    fetchThreads();
    const id = setInterval(fetchThreads, SMS_POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Calls poll — slower cadence (calls are more event-driven than SMS).
  useEffect(() => {
    let cancelled = false;
    const fetchCalls = async () => {
      try {
        const res = await fetch('/api/dialer/calls?limit=20', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setCalls(data.calls || []);
      } catch { /* silent */ }
    };
    fetchCalls();
    const id = setInterval(fetchCalls, CALLS_POLL_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const recentSms = threads
    .filter((t) => t.last_direction === 'inbound' && withinRollingWindow(t.last_message_at))
    .slice(0, 8);

  const recentCalls = calls
    .filter((c) => withinRollingWindow(c.started_at))
    .slice(0, 8);

  const handleOpenSms = useCallback((thread) => {
    const path = thread.contact_id
      ? `/portal/mlo/messages?contact=${thread.contact_id}`
      : `/portal/mlo/messages?phone=${encodeURIComponent(thread.phone)}`;
    openInPortal(path);
  }, []);

  const handleOpenCall = useCallback((call) => {
    const path = call.contact_id
      ? `/portal/mlo/contacts/${call.contact_id}`
      : '/portal/mlo';
    openInPortal(path);
  }, []);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-gray-200 bg-gradient-to-b from-white to-gray-50 flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-brand flex items-center justify-center flex-shrink-0">
          <span className="text-[10px] font-bold text-white">N</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-gray-900 truncate leading-tight">NetRate Dock</p>
          <p className="text-[9px] text-gray-400 leading-tight">
            {loadedAt ? `Updated ${loadedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Loading…'}
          </p>
        </div>
        <button
          onClick={() => openInPortal('/portal/mlo')}
          className="text-[9px] font-medium text-brand hover:text-brand-dark px-2 py-1 rounded hover:bg-brand/5"
          title="Open full portal"
        >
          Open portal
        </button>
      </div>

      {/* Active call banner — when a call is incoming on the main portal */}
      {callState === INCOMING && (
        <div className="px-3 py-2 bg-green-50 border-b border-green-200">
          <p className="text-[9px] uppercase tracking-wide text-green-700 font-semibold">Incoming call</p>
          <p className="text-xs font-semibold text-gray-900 truncate">
            {callerInfo?.name || callerInfo?.phone || 'Unknown'}
          </p>
          <button
            onClick={() => openInPortal('/portal/mlo')}
            className="mt-1 text-[10px] font-medium text-green-700 underline"
          >
            Answer in portal
          </button>
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* SMS section */}
        <Section
          title="Texts"
          subtitle={smsUnreadCount > 0 ? `${smsUnreadCount} unread` : null}
          empty="No texts in last 24 hours"
          showOlderHref="/portal/mlo/messages"
          rows={recentSms}
          renderRow={(t) => (
            <button
              key={`sms-${t.contact_id || t.phone}`}
              onClick={() => handleOpenSms(t)}
              className="w-full text-left px-3 py-2 border-b border-gray-100 hover:bg-gray-50 flex items-start gap-2"
            >
              <div className="w-7 h-7 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
                <span className="text-[9px] font-semibold text-brand">
                  {(t.contact_name || t.phone || '?').slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-semibold text-gray-900 truncate">
                    {t.contact_name || t.phone}
                  </p>
                  <span className="text-[9px] text-gray-400 flex-shrink-0">
                    {timeAgo(t.last_message_at)}
                  </span>
                </div>
                <p className="text-[11px] text-gray-600 truncate leading-tight">
                  {t.last_message || ''}
                </p>
              </div>
              {t.unread > 0 && (
                <span className="w-2 h-2 rounded-full bg-brand mt-1.5 flex-shrink-0" title={`${t.unread} unread`} />
              )}
            </button>
          )}
        />

        {/* Calls section */}
        <Section
          title="Calls"
          subtitle={null}
          empty="No calls in last 24 hours"
          showOlderHref="/portal/mlo"
          rows={recentCalls}
          renderRow={(c) => {
            const isInbound = c.direction === 'inbound';
            const isMissed = isInbound && (c.status === 'no-answer' || c.status === 'missed' || c.duration === 0);
            const name =
              (c.contact_first_name || c.contact_last_name)
                ? `${c.contact_first_name || ''} ${c.contact_last_name || ''}`.trim()
                : c.from_number || c.to_number || 'Unknown';
            return (
              <button
                key={`call-${c.id}`}
                onClick={() => handleOpenCall(c)}
                className="w-full text-left px-3 py-2 border-b border-gray-100 hover:bg-gray-50 flex items-start gap-2"
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isMissed ? 'bg-red-50' : isInbound ? 'bg-green-50' : 'bg-gray-100'}`}>
                  <svg
                    className={`w-3.5 h-3.5 ${isMissed ? 'text-red-500' : isInbound ? 'text-green-600' : 'text-gray-500'}`}
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    {isMissed ? (
                      // Missed: phone with X-ish slant
                      <path d="M21 15.46l-5.27-.61-2.52 2.52a15.04 15.04 0 01-6.59-6.58L9.14 8.27 8.54 3H3.03C2.45 13.18 10.82 21.55 21 20.97v-5.51z" />
                    ) : isInbound ? (
                      // Inbound: arrow into phone
                      <path d="M20 15.5c-1.25 0-2.45-.2-3.57-.57a1.02 1.02 0 00-1.02.24l-2.2 2.2a15.045 15.045 0 01-6.59-6.59l2.2-2.21a.96.96 0 00.25-1A11.36 11.36 0 018.5 4c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.5c0-.55-.45-1-1-1zM19 12h2c0-4.97-4.03-9-9-9v2c3.87 0 7 3.13 7 7zm-4 0h2c0-2.76-2.24-5-5-5v2c1.66 0 3 1.34 3 3z" />
                    ) : (
                      // Outbound: phone outline
                      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                    )}
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className={`text-xs font-semibold truncate ${isMissed ? 'text-red-600' : 'text-gray-900'}`}>
                      {name}
                    </p>
                    <span className="text-[9px] text-gray-400 flex-shrink-0">
                      {timeAgo(c.started_at)}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 truncate leading-tight">
                    {isMissed ? 'Missed' : isInbound ? 'Inbound' : 'Outbound'}
                    {c.duration ? ` · ${Math.floor(c.duration / 60)}:${String(c.duration % 60).padStart(2, '0')}` : ''}
                  </p>
                </div>
              </button>
            );
          }}
        />
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
        <span className="text-[9px] text-gray-400">Last 24h · auto-refresh</span>
        <Link
          href="/portal/mlo"
          target={PORTAL_WINDOW_NAME}
          className="text-[9px] text-brand hover:text-brand-dark font-medium"
        >
          Open portal →
        </Link>
      </div>
    </div>
  );
}

function Section({ title, subtitle, empty, rows, renderRow, showOlderHref }) {
  return (
    <section>
      <header className="px-3 py-1.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between sticky top-0">
        <h3 className="text-[10px] uppercase tracking-wide font-semibold text-gray-500">{title}</h3>
        {subtitle && <span className="text-[9px] text-brand font-medium">{subtitle}</span>}
      </header>
      {rows.length === 0 ? (
        <p className="px-3 py-3 text-[11px] text-gray-400 italic">{empty}</p>
      ) : (
        <div>{rows.map(renderRow)}</div>
      )}
      <div className="px-3 py-1.5 border-b border-gray-200 bg-white">
        <Link
          href={showOlderHref}
          target={PORTAL_WINDOW_NAME}
          className="text-[10px] text-brand hover:text-brand-dark font-medium"
        >
          Show older →
        </Link>
      </div>
    </section>
  );
}
