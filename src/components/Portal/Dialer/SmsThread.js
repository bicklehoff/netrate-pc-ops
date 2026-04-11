// SmsThread — SMS conversation view for a contact
// Shows message bubbles (inbound left, outbound right) and a compose input.
// Fetches messages from the contact detail and sends via the SMS API.

'use client';

import { useState, useEffect, useRef } from 'react';

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function SmsThread({ contactId, contactPhone, messages: initialMessages }) {
  const [messages, setMessages] = useState(initialMessages || []);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  // Fetch messages from API on mount and poll every 10s
  useEffect(() => {
    if (!contactId) return;
    let active = true;

    async function fetchMessages() {
      try {
        const res = await fetch(`/api/dialer/contacts/${contactId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (active && data.contact?.smsMessages) {
          setMessages(data.contact.smsMessages.reverse());
        }
      } catch {} // eslint-disable-line no-empty
    }

    setLoading(true);
    fetchMessages().finally(() => { if (active) setLoading(false); });
    const interval = setInterval(fetchMessages, 10000);

    return () => { active = false; clearInterval(interval); };
  }, [contactId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !contactPhone) return;

    setSending(true);
    setSendError(null);
    try {
      const res = await fetch('/api/dialer/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: contactPhone,
          body: newMessage.trim(),
          contactId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Send failed (${res.status})`);
      }
      const data = await res.json();

      // Add to local messages immediately
      setMessages((prev) => [...prev, {
        id: data.message.id,
        direction: 'outbound',
        body: newMessage.trim(),
        status: 'queued',
        sentAt: new Date().toISOString(),
      }]);

      setNewMessage('');
    } catch (e) {
      console.error('SMS send failed:', e);
      setSendError(e.message);
    } finally {
      setSending(false);
    }
  };

  // Group messages by date
  const grouped = messages.reduce((acc, msg) => {
    const date = formatDate(msg.sentAt);
    if (!acc[date]) acc[date] = [];
    acc[date].push(msg);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {loading ? (
          <div className="text-center py-8">
            <div className="w-6 h-6 mx-auto border-2 border-gray-300 border-t-brand rounded-full animate-spin mb-2" />
            <p className="text-xs text-gray-400">Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-8 h-8 mx-auto text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-xs text-gray-400">No messages yet</p>
          </div>
        ) : (
          Object.entries(grouped).map(([date, msgs]) => (
            <div key={date}>
              <div className="text-center my-2">
                <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{date}</span>
              </div>
              {msgs.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex mb-1.5 ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                      msg.direction === 'outbound'
                        ? 'bg-brand text-white rounded-br-md'
                        : 'bg-gray-100 text-gray-900 rounded-bl-md'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                    <p className={`text-[10px] mt-0.5 ${
                      msg.direction === 'outbound' ? 'text-white/60' : 'text-gray-400'
                    }`}>
                      {formatTime(msg.sentAt)}
                      {msg.direction === 'outbound' && msg.status === 'delivered' && ' ✓✓'}
                      {msg.direction === 'outbound' && msg.status === 'sent' && ' ✓'}
                      {msg.direction === 'outbound' && msg.status === 'failed' && ' ✗'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Error banner */}
      {sendError && (
        <div className="px-3 py-2 bg-red-50 border-t border-red-100 flex items-center gap-2">
          <p className="text-xs text-red-600 flex-1">{sendError}</p>
          <button onClick={() => setSendError(null)} className="text-red-400 hover:text-red-600 text-xs">dismiss</button>
        </div>
      )}

      {/* Compose area */}
      <div className="border-t border-gray-200 px-3 py-2">
        <div className="flex items-end gap-2">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand max-h-20"
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="p-2 rounded-xl bg-go text-white hover:bg-go-dark disabled:bg-gray-200 disabled:text-gray-400 transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
