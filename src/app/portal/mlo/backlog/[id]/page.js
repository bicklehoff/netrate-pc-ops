// Ticket Detail — View ticket + comment thread + status controls
// /portal/mlo/backlog/:id

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [posting, setPosting] = useState(false);
  const [editing, setEditing] = useState(false);
  const fileInputRef = useRef(null);
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
    if (!comment.trim() && !imageFile) return;
    setPosting(true);

    const formData = new FormData();
    formData.append('content', comment.trim());
    if (imageFile) formData.append('image', imageFile);

    const res = await fetch(`/api/portal/mlo/tickets/${ticketId}/entries`, {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      setComment('');
      setImageFile(null);
      setImagePreview(null);
      fetchTicket();
    }
    setPosting(false);
  };

  const handleImageSelect = (file) => {
    if (!file) return;
    const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) return;
    if (file.size > 10 * 1024 * 1024) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageSelect(file);
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        handleImageSelect(item.getAsFile());
        return;
      }
    }
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
              <button onClick={handleSaveEdit} className="px-3 py-1.5 bg-go text-white text-sm font-bold rounded-lg hover:bg-go-dark">Save</button>
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
                Created {new Date(ticket.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
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
                  {new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {' '}
                  {new Date(entry.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
              {entry.content && entry.content !== '(screenshot)' && (
                <p className={`text-sm whitespace-pre-wrap ${ENTRY_TYPE_STYLES[entry.entryType] || ''}`}>
                  {entry.content}
                </p>
              )}
              {entry.imageUrl && (
                <a href={entry.imageUrl} target="_blank" rel="noopener noreferrer" className="block mt-2">
                  <img
                    src={entry.imageUrl}
                    alt="Attached screenshot"
                    className="max-w-full max-h-96 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                  />
                </a>
              )}
            </div>
          ))}
        </div>

        {/* Comment input with drag-and-drop */}
        <form
          onSubmit={handlePostComment}
          className="border-t border-gray-200 p-4"
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <div className={`relative rounded-lg border-2 transition-colors ${dragging ? 'border-brand border-dashed bg-brand/5' : 'border-transparent'}`}>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onPaste={handlePaste}
              placeholder="Add a comment... (drop or paste an image)"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none resize-none"
            />
            {dragging && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg pointer-events-none">
                <span className="text-brand font-medium text-sm">Drop image here</span>
              </div>
            )}
          </div>

          {/* Image preview */}
          {imagePreview && (
            <div className="mt-2 relative inline-block">
              <img src={imagePreview} alt="Preview" className="max-h-32 rounded-lg border border-gray-200" />
              <button
                type="button"
                onClick={() => { setImageFile(null); setImagePreview(null); }}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
              >
                &times;
              </button>
            </div>
          )}

          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="hidden"
                onChange={(e) => handleImageSelect(e.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
                title="Attach image"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Attach image
              </button>
            </div>
            <button
              type="submit"
              disabled={posting || (!comment.trim() && !imageFile)}
              className="px-4 py-1.5 bg-go text-white text-sm font-bold rounded-lg hover:bg-go-dark transition-colors disabled:opacity-50"
            >
              {posting ? 'Posting...' : 'Comment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
