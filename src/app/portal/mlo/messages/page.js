// MLO Messages — Unified inbox for SMS threads and call history
// Two tabs: Messages (SMS) and Calls
// SMS: thread list left, conversation right
// Calls: full-width call log with contact info and notes

'use client';

import { useState, useEffect, useCallback } from 'react';
import SmsThread from '@/components/Portal/Dialer/SmsThread';

function formatRelativeTime(dateStr) {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHr < 24) return `${diffHr}h`;
  if (diffDay < 7) return `${diffDay}d`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDuration(seconds) {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatDateTime(dateStr) {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// ─── SMS Inbox Tab ─────────────────────────────────────────
function SmsInbox() {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedThread, setSelectedThread] = useState(null);

  const fetchThreads = useCallback(async () => {
    try {
      const params = search ? `?q=${encodeURIComponent(search)}` : '';
      const res = await fetch(`/api/dialer/sms/threads${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setThreads(data.threads || []);
    } catch (e) {
      console.error('Failed to fetch threads:', e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    setLoading(true);
    fetchThreads();
    const interval = setInterval(fetchThreads, 15000);
    return () => clearInterval(interval);
  }, [fetchThreads]);

  return (
    <div className="flex h-full">
      {/* Thread list */}
      <div className="w-80 flex-shrink-0 border-r border-gray-200 flex flex-col bg-white">
        {/* Search */}
        <div className="p-3 border-b border-gray-100">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search messages..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
            />
          </div>
        </div>

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-brand rounded-full animate-spin" />
            </div>
          ) : threads.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">
              No messages yet
            </div>
          ) : (
            threads.map((thread) => (
              <button
                key={thread.contactId || thread.phone}
                onClick={() => setSelectedThread(thread)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                  selectedThread?.contactId === thread.contactId &&
                  selectedThread?.phone === thread.phone
                    ? 'bg-brand/5 border-l-2 border-l-brand'
                    : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {thread.contactName || thread.phone || 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {thread.lastDirection === 'outbound' && (
                        <span className="text-gray-400">You: </span>
                      )}
                      {thread.lastMessage}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-[11px] text-gray-400">
                      {formatRelativeTime(thread.lastMessageAt)}
                    </span>
                    {thread.messageCount > 0 && (
                      <span className="text-[10px] text-gray-400">
                        {thread.messageCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Thread detail */}
      <div className="flex-1 flex flex-col bg-white">
        {selectedThread ? (
          <>
            {/* Thread header */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-semibold text-brand">
                  {(selectedThread.contactName || selectedThread.phone || '?')[0].toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {selectedThread.contactName || 'Unknown Contact'}
                </p>
                <p className="text-xs text-gray-500">{selectedThread.phone}</p>
              </div>
              {selectedThread.contactId && (
                <a
                  href={`/portal/mlo/contacts/${selectedThread.contactId}`}
                  className="ml-auto text-xs text-brand hover:underline"
                >
                  View contact
                </a>
              )}
            </div>
            {/* Reuse SmsThread component */}
            <div className="flex-1 min-h-0">
              <SmsThread
                contactId={selectedThread.contactId}
                contactPhone={selectedThread.phone}
                messages={[]}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-sm">Select a conversation</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Calls Tab ─────────────────────────────────────────────
function CallHistory() {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [dirFilter, setDirFilter] = useState('');
  const limit = 30;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit });
    if (dirFilter) params.set('direction', dirFilter);

    fetch(`/api/dialer/calls?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setCalls(data.calls || []);
        setTotal(data.total || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, dirFilter]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="h-full flex flex-col">
      {/* Filters */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3">
        <div className="flex gap-1">
          {[
            { value: '', label: 'All' },
            { value: 'inbound', label: 'Inbound' },
            { value: 'outbound', label: 'Outbound' },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => { setDirFilter(f.value); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                dirFilter === f.value
                  ? 'bg-brand text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400 ml-auto">{total} calls</span>
      </div>

      {/* Call list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-brand rounded-full animate-spin" />
          </div>
        ) : calls.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">No calls found</div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Contact</th>
                <th className="text-left px-4 py-2 font-medium">Direction</th>
                <th className="text-left px-4 py-2 font-medium">Number</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-left px-4 py-2 font-medium">Duration</th>
                <th className="text-left px-4 py-2 font-medium">When</th>
                <th className="text-left px-4 py-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {calls.map((call) => (
                <tr key={call.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    {call.contact ? (
                      <a
                        href={`/portal/mlo/contacts/${call.contact.id}`}
                        className="text-sm font-medium text-brand hover:underline"
                      >
                        {call.contact.firstName} {call.contact.lastName}
                      </a>
                    ) : (
                      <span className="text-sm text-gray-400">Unknown</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                      call.direction === 'inbound'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-green-50 text-green-700'
                    }`}>
                      {call.direction === 'inbound' ? (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      )}
                      {call.direction}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                    {call.direction === 'inbound' ? call.fromNumber : call.toNumber}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      call.status === 'completed' ? 'bg-green-50 text-green-700' :
                      call.status === 'no-answer' ? 'bg-yellow-50 text-yellow-700' :
                      call.status === 'busy' ? 'bg-red-50 text-red-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {call.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDuration(call.duration)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatDateTime(call.startedAt)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate">
                    {call.notes?.[0]?.content || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="text-sm text-gray-600 hover:text-brand disabled:text-gray-300"
          >
            ← Previous
          </button>
          <span className="text-xs text-gray-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="text-sm text-gray-600 hover:text-brand disabled:text-gray-300"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────
export default function MessagesPage() {
  const [tab, setTab] = useState('sms');

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        {[
          { id: 'sms', label: 'Messages', icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          )},
          { id: 'calls', label: 'Calls', icon: (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          )},
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'text-brand border-brand bg-white'
                : 'text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0">
        {tab === 'sms' ? <SmsInbox /> : <CallHistory />}
      </div>
    </div>
  );
}
