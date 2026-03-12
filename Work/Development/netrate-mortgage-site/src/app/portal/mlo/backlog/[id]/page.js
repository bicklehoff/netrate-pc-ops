// Ticket Detail — View ticket + comment thread + status controls
// /portal/mlo/backlog/:id

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';

const PRIORITY_COLORS = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-blue-100 text-blue-800',
  low: 'bg-gray-100 text-gray-600',
};

const STATUS_COLORS = {
  open: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-blue-100 text-blue-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-200 text-gray-500',
};

const PRODUCT_COLORS = {
  website: 'bg-teal-50 text-teal-700 border-teal-200',
  portal: 'bg-purple-50 text-purple-700 border-purple-200',
  corebot: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

const TYPE_ICONS = { bug: '🐛', feature: '✨', improvement: '🔧' };
const TYPE_LABELS = { bug: 'Bug', feature: 'Feature', improvement: 'Improvement' };

const ENTRY_TYPE_STYLES = {
  comment: '',
  status_change: 'italic text-gray-500',
  assignment: 'italic text-gray-500',
};

export default function TicketDetailPage() {
  const { status: authStatus } = useSession();
  const router = useRouter();
  const params = useParams();
  const ticketId = params.id;

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const fetchTicket = useCallback(async () => {
    const res = await fetch(`/api/portal/mlo/tickets/${ticketId}`);
    if (res.ok) {
      const data = await res.json();
      setTicket(data.ticket);
    } else {
      setTicket(null);
    }
    setLoading(false);
  }, [ticketId]);

  useEffect(() => {
    if (authStatus === 'authenticated' && ticketId) fetchTicket();
  }, [authStatus, ticketId, fetchTicket]);

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.push('/portal/mlo/login');
  }, [authStatus, router]);

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setPosting(true);

    const res = await fetch(`/api/portal/mlo/tickets/${ticketId}/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: comment.trim() }),
    });

    if (res.ok) {
      setComment('');
      fetchTicket();
    }
    setPosting(false);
  };

  const handleStatusChange = async (newStatus) => {
    const res = await fetch(`/api/portal/mlo/tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) fetchTicket();
  };

  const handlePriorityChange = async (newPriority) => {
    const res = await fetch(`/api/portal/mlo/tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priority: newPriority }),
    });
    if (res.ok) fetchTicket();
  };

  const handleSaveEdit = async () => {
    const res = await fetch(`/api/portal/mlo/tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: editTitle, description: editDescription }),
    });
    if (res.ok) {
      setEditing(false);
      fetchTicket();
    }
  };

  const startEditing = () => {
    setEditTitle(ticket.title);
    setEditDescription(ticket.description || '');
    setEditing(true);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;
  }

  if (!ticket) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <p className="text-gray-500">Ticket not found</p>
        <button onClick={() => router.push('/portal/mlo/backlog')} className="text-brand hover:underline mt-2 text-sm">
          ← Back to backlog
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm mb-6">
        <button
          onClick={() => router.push('/portal/mlo/backlog')}
          className="flex items-center gap-1.5 text-brand hover:text-brand-dark font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Backlog
        </button>
        <svg className="w-3.5 h-3.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-gray-500 truncate">{ticket.title}</span>
      </div>

      {/* Ticket header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-4">
        {editing ? (
          <div className="space-y-3">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-lg font-bold focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
            />
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none resize-none"
              placeholder="Description..."
            />
            <div className="flex gap-2">
              <button onClick={handleSaveEdit} className="px-3 py-1.5 bg-brand text-white text-sm rounded-lg hover:bg-brand-dark">Save</button>
              <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-gray-500 text-sm hover:text-gray-700">Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span>{TYPE_ICONS[ticket.ticketType]}</span>
                  <span className="text-xs text-gray-400 uppercase">{TYPE_LABELS[ticket.ticketType]}</span>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded border ${PRODUCT_COLORS[ticket.product]}`}>
                    {ticket.product}
                  </span>
                </div>
                <h1 className="text-xl font-bold text-gray-900">{ticket.title}</h1>
                {ticket.description && (
                  <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{ticket.description}</p>
                )}
              </div>
              <button
                onClick={startEditing}
                className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100 flex-shrink-0"
              >
                Edit
              </button>
            </div>

            {/* Controls row */}
            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Status:</span>
                <select
                  value={ticket.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className={`text-xs font-medium rounded px-2 py-1 border-0 cursor-pointer ${STATUS_COLORS[ticket.status]}`}
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              <div className="w-px h-4 bg-gray-200" />

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Priority:</span>
                <select
                  value={ticket.priority}
                  onChange={(e) => handlePriorityChange(e.target.value)}
                  className={`text-xs font-medium rounded px-2 py-1 border-0 cursor-pointer ${PRIORITY_COLORS[ticket.priority]}`}
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div className="flex-1" />

              <span className="text-xs text-gray-400">
                Created {new Date(ticket.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Activity thread */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-sm font-medium text-gray-700">
            Activity
            {ticket.entries?.length > 0 && (
              <span className="text-gray-400 font-normal ml-1">({ticket.entries.length})</span>
            )}
          </h2>
        </div>

        {/* Entries */}
        <div className="divide-y divide-gray-50">
          {(!ticket.entries || ticket.entries.length === 0) && (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              No activity yet. Add a comment to get started.
            </div>
          )}
          {ticket.entries?.map((entry) => (
            <div key={entry.id} className="px-5 py-3">
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <span className="text-xs font-medium text-gray-700">
                  {entry.authorLabel || entry.authorId}
                </span>
                <span className="text-[11px] text-gray-400">
                  {new Date(entry.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {' '}
                  {new Date(entry.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
              <p className={`text-sm whitespace-pre-wrap ${ENTRY_TYPE_STYLES[entry.entryType] || ''}`}>
                {entry.content}
              </p>
            </div>
          ))}
        </div>

        {/* Comment input */}
        <form onSubmit={handlePostComment} className="border-t border-gray-200 p-4">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a comment..."
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none resize-none mb-2"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={posting || !comment.trim()}
              className="px-4 py-1.5 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-50"
            >
              {posting ? 'Posting...' : 'Comment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
