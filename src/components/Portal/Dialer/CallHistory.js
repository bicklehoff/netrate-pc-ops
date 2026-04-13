// CallHistory — Recent calls list in the dialer sidebar
// Shows recent inbound/outbound calls with status, duration, contact info.

'use client';

import { useState, useEffect } from 'react';
import { useDialer } from './DialerProvider';

function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function CallHistory({ onSelectContact }) {
  const { callState, IDLE } = useDialer();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCalls = async () => {
    try {
      const res = await fetch('/api/dialer/calls?limit=20');
      if (!res.ok) return;
      const data = await res.json();
      setCalls(data.calls || []);
    } catch (e) {
      console.error('Failed to fetch calls:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls();
  }, []);

  // Refresh when a call ends
  useEffect(() => {
    if (callState === IDLE) {
      fetchCalls();
    }
  }, [callState, IDLE]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse flex gap-3 p-2">
            <div className="w-8 h-8 bg-gray-200 rounded-full" />
            <div className="flex-1 space-y-1">
              <div className="h-3 bg-gray-200 rounded w-24" />
              <div className="h-2 bg-gray-200 rounded w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <div className="text-center py-6">
        <svg className="w-8 h-8 mx-auto text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
        <p className="text-xs text-ink-subtle">No recent calls</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {calls.map((call) => {
        const isInbound = call.direction === 'inbound';
        const isMissed = ['missed', 'no-answer', 'busy'].includes(call.status);
        const contactName = call.contact
          ? `${call.contact.first_name} ${call.contact.last_name}`
          : (isInbound ? call.from_number : call.to_number);

        return (
          <button
            key={call.id}
            onClick={() => {
              if (call.contact && onSelectContact) {
                onSelectContact(call.contact);
              }
            }}
            className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-surface-alt transition-colors text-left"
          >
            {/* Direction arrow */}
            <div className={`flex-shrink-0 ${isMissed ? 'text-red-500' : isInbound ? 'text-blue-500' : 'text-green-500'}`}>
              {isInbound ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${isMissed ? 'text-red-600' : 'text-ink'}`}>
                {contactName}
              </p>
              <p className="text-xs text-ink-subtle">
                {timeAgo(call.started_at)}
                {call.duration ? ` · ${formatDuration(call.duration)}` : ''}
                {call.notes?.[0]?.disposition && (
                  <span className="ml-1 text-ink-subtle">· {call.notes[0].disposition.replace('_', ' ')}</span>
                )}
              </p>
            </div>

            {/* Quick redial indicator */}
            <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
