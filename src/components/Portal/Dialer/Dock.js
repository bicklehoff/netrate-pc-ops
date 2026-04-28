// Dock — Floating action panel for SMS + calls.
// Vertical, ~280px wide. Lets the MLO answer/decline calls, dial, and reply
// to texts inline without ever switching to the main portal window.
//
// Architecture: this component runs inside DialerProvider mode="passive".
// All actions (dial / accept / decline / hangup) dispatch via BroadcastChannel
// to the main portal's primary DialerProvider — which owns the Twilio Voice
// Device. Keeps a single source of truth so opening the dock doesn't collide
// with the main portal's call routing.

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
  window.open(url, PORTAL_WINDOW_NAME);
}

// E.164 normalize-ish: strip non-digits, prepend +1 if 10-digit US.
function normalizeForDial(input) {
  const digits = (input || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

export default function Dock() {
  const {
    smsUnreadCount,
    callState,
    activeCall,
    INCOMING,
    IN_PROGRESS,
    callerInfo,
    dial,
    acceptCall,
    rejectCall,
    hangup,
    deviceReady,
  } = useDialer();

  const [threads, setThreads] = useState([]);
  const [calls, setCalls] = useState([]);
  const [loadedAt, setLoadedAt] = useState(null);
  const [expandedReply, setExpandedReply] = useState(null); // contact_id or phone string
  const [replyText, setReplyText] = useState('');
  const [replySending, setReplySending] = useState(false);
  const [replyError, setReplyError] = useState(null);
  const [dialPadOpen, setDialPadOpen] = useState(false);
  const [dialNumber, setDialNumber] = useState('');

  // ─── Auto-focus on incoming call ─────────────────────────
  // When a call rings AND the dock window is open, bring it to front so the
  // user sees the green Accept/Decline banner without having to alt-tab.
  // Browsers won't let JS spawn a window from a background event, but they
  // do allow .focus() on a window the user already opened.
  const prevCallStateRef = useRef(callState);
  useEffect(() => {
    if (callState === INCOMING && prevCallStateRef.current !== INCOMING) {
      try { window.focus(); } catch { /* may be blocked depending on user gesture rules */ }
    }
    prevCallStateRef.current = callState;
  }, [callState, INCOMING]);

  // ─── SMS polling ─────────────────────────────────────────
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

  // ─── Calls polling ───────────────────────────────────────
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

  // ─── Actions ─────────────────────────────────────────────

  const handleOpenSms = useCallback((thread) => {
    const path = thread.contact_id
      ? `/portal/mlo/messages?contact=${thread.contact_id}`
      : `/portal/mlo/messages?phone=${encodeURIComponent(thread.phone)}`;
    openInPortal(path);
  }, []);

  const handleCallContact = useCallback((phone, contactInfo) => {
    const number = normalizeForDial(phone);
    if (!number) return;
    dial(number, contactInfo || { phone: number });
  }, [dial]);

  const handleToggleReply = useCallback((threadKey) => {
    setExpandedReply((cur) => (cur === threadKey ? null : threadKey));
    setReplyText('');
    setReplyError(null);
  }, []);

  const handleSendReply = useCallback(async (thread) => {
    const trimmed = replyText.trim();
    if (!trimmed || replySending) return;
    setReplySending(true);
    setReplyError(null);
    try {
      const res = await fetch('/api/dialer/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: thread.phone,
          body: trimmed,
          contactId: thread.contact_id || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setReplyError(data.error || 'Send failed');
        return;
      }
      // On success: collapse the reply box and refresh threads.
      setExpandedReply(null);
      setReplyText('');
      // Bump threads so the dock immediately shows the outbound message.
      try {
        const refreshRes = await fetch('/api/dialer/sms/threads', { cache: 'no-store' });
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          setThreads(data.threads || []);
        }
      } catch { /* silent */ }
    } catch (e) {
      setReplyError(e.message || 'Send failed');
    } finally {
      setReplySending(false);
    }
  }, [replyText, replySending]);

  const handleDialFromPad = useCallback(() => {
    const number = normalizeForDial(dialNumber);
    if (!number) return;
    dial(number, { phone: number });
    setDialNumber('');
    setDialPadOpen(false);
  }, [dialNumber, dial]);

  const isInCall = callState === IN_PROGRESS && activeCall;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-gray-200 bg-gradient-to-b from-white to-gray-50 flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-brand flex items-center justify-center flex-shrink-0">
          <span className="text-[10px] font-bold text-white">N</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-gray-900 truncate leading-tight">NetRate Dock</p>
          <p className="text-[9px] text-gray-400 leading-tight flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${deviceReady ? 'bg-green-500' : 'bg-gray-300'}`} />
            {deviceReady ? 'Connected' : 'Main portal not open'}
          </p>
        </div>
        <button
          onClick={() => setDialPadOpen((v) => !v)}
          className={`text-[10px] font-medium px-2 py-1 rounded transition-colors ${dialPadOpen ? 'bg-brand text-white' : 'text-brand hover:bg-brand/10'}`}
          title="Open dial pad"
        >
          Dial
        </button>
        <button
          onClick={() => openInPortal('/portal/mlo')}
          className="text-[9px] font-medium text-gray-600 hover:text-gray-900 px-1.5 py-1 rounded hover:bg-gray-100"
          title="Open full portal"
        >
          Portal →
        </button>
      </div>

      {/* Connection warning when primary isn't open */}
      {!deviceReady && (
        <div className="px-3 py-2 bg-amber-50 border-b border-amber-200">
          <p className="text-[10px] text-amber-800 leading-snug">
            Open the main portal to enable calls + SMS sending. The dock can&apos;t make calls on its own.
          </p>
        </div>
      )}

      {/* Dial pad */}
      {dialPadOpen && (
        <div className="px-3 py-2.5 border-b border-gray-200 bg-gray-50">
          <input
            type="tel"
            placeholder="Enter number..."
            value={dialNumber}
            onChange={(e) => setDialNumber(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleDialFromPad(); }}
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 mb-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
            autoFocus
          />
          <button
            onClick={handleDialFromPad}
            disabled={!dialNumber.trim() || !deviceReady}
            className="w-full py-1.5 rounded bg-go text-white text-xs font-semibold hover:bg-go-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {!deviceReady ? 'Main portal required' : 'Call'}
          </button>
        </div>
      )}

      {/* Active call banner — incoming with Accept/Decline */}
      {callState === INCOMING && (
        <div className="px-3 py-3 bg-green-50 border-b-2 border-green-300">
          <p className="text-[9px] uppercase tracking-wide text-green-700 font-bold">Incoming call</p>
          <p className="text-sm font-bold text-gray-900 truncate mb-2">
            {callerInfo?.name || callerInfo?.phone || 'Unknown'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={acceptCall}
              className="flex-1 py-1.5 rounded bg-go text-white text-xs font-bold hover:bg-go-dark transition-colors flex items-center justify-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
              </svg>
              Accept
            </button>
            <button
              onClick={rejectCall}
              className="flex-1 py-1.5 rounded bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-colors"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {/* Active call banner — in progress with Hangup */}
      {isInCall && (
        <div className="px-3 py-2.5 bg-brand/5 border-b border-brand/20 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-brand animate-pulse" />
          <div className="flex-1 min-w-0">
            <p className="text-[9px] uppercase tracking-wide text-brand font-bold">On call</p>
            <p className="text-xs font-semibold text-gray-900 truncate">
              {callerInfo?.name || callerInfo?.phone || 'Unknown'}
            </p>
          </div>
          <button
            onClick={hangup}
            className="px-2.5 py-1 rounded bg-red-500 text-white text-[10px] font-bold hover:bg-red-600"
          >
            Hang up
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
          renderRow={(t) => {
            const threadKey = t.contact_id || t.phone;
            const isReplyOpen = expandedReply === threadKey;
            return (
              <div
                key={`sms-${threadKey}`}
                className={`border-b border-gray-100 ${isReplyOpen ? 'bg-gray-50' : ''}`}
              >
                <div className="px-3 py-2 flex items-start gap-2">
                  <button
                    onClick={() => handleOpenSms(t)}
                    className="w-7 h-7 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0 hover:bg-brand/20"
                    title="Open thread"
                  >
                    <span className="text-[9px] font-semibold text-brand">
                      {(t.contact_name || t.phone || '?').slice(0, 2).toUpperCase()}
                    </span>
                  </button>
                  <button
                    onClick={() => handleOpenSms(t)}
                    className="flex-1 min-w-0 text-left"
                  >
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
                  </button>
                  {t.unread > 0 && (
                    <span className="w-2 h-2 rounded-full bg-brand mt-1.5 flex-shrink-0" title={`${t.unread} unread`} />
                  )}
                </div>
                {/* Action row */}
                <div className="px-3 pb-2 flex gap-1.5 -mt-1">
                  <button
                    onClick={() => handleCallContact(t.phone, t.contact_name ? { name: t.contact_name, phone: t.phone, contactId: t.contact_id } : null)}
                    disabled={!deviceReady}
                    className="flex-1 py-1 rounded bg-go/10 text-go-dark text-[10px] font-semibold hover:bg-go/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                    title={deviceReady ? 'Call' : 'Open main portal to enable calls'}
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                    </svg>
                    Call
                  </button>
                  <button
                    onClick={() => handleToggleReply(threadKey)}
                    className={`flex-1 py-1 rounded text-[10px] font-semibold flex items-center justify-center gap-1 ${isReplyOpen ? 'bg-brand text-white' : 'bg-brand/10 text-brand hover:bg-brand/20'}`}
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                    </svg>
                    {isReplyOpen ? 'Cancel' : 'Reply'}
                  </button>
                </div>
                {/* Inline reply */}
                {isReplyOpen && (
                  <div className="px-3 pb-2.5">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your reply..."
                      rows={2}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendReply(t);
                        }
                      }}
                      className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-brand/30"
                    />
                    <div className="flex items-center gap-2 mt-1.5">
                      <button
                        onClick={() => handleSendReply(t)}
                        disabled={!replyText.trim() || replySending}
                        className="flex-1 py-1.5 rounded bg-brand text-white text-[10px] font-semibold hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {replySending ? 'Sending…' : 'Send'}
                      </button>
                      <span className="text-[9px] text-gray-400">Enter ↵</span>
                    </div>
                    {replyError && (
                      <p className="text-[10px] text-red-600 mt-1">{replyError}</p>
                    )}
                  </div>
                )}
              </div>
            );
          }}
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
            const callbackPhone = c.contact_phone || (isInbound ? c.from_number : c.to_number);
            return (
              <div key={`call-${c.id}`} className="px-3 py-2 border-b border-gray-100 flex items-start gap-2 hover:bg-gray-50">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isMissed ? 'bg-red-50' : isInbound ? 'bg-green-50' : 'bg-gray-100'}`}>
                  <svg
                    className={`w-3.5 h-3.5 ${isMissed ? 'text-red-500' : isInbound ? 'text-green-600' : 'text-gray-500'}`}
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
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
                {callbackPhone && (
                  <button
                    onClick={() => handleCallContact(callbackPhone, c.contact_id ? { name, phone: callbackPhone, contactId: c.contact_id } : null)}
                    disabled={!deviceReady}
                    className="px-2 py-1 rounded bg-go/10 text-go-dark text-[10px] font-semibold hover:bg-go/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 flex-shrink-0"
                    title={deviceReady ? 'Call back' : 'Open main portal to enable calls'}
                  >
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                    </svg>
                  </button>
                )}
              </div>
            );
          }}
        />
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
        <span className="text-[9px] text-gray-400">
          {loadedAt ? `${loadedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : '—'} · auto
        </span>
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
      <header className="px-3 py-1.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between sticky top-0 z-10">
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
