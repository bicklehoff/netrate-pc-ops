// Dev Backlog — Shared ticketing for Website, Portal, CoreBot
// Table view with filtering by product, status, type, priority
// Inline create form + click-through to ticket detail

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const PRODUCTS = [
  { value: 'all', label: 'All Products' },
  { value: 'website', label: 'Website' },
  { value: 'portal', label: 'Portal' },
  { value: 'corebot', label: 'CoreBot' },
];

const STATUSES = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'bug', label: 'Bug' },
  { value: 'feature', label: 'Feature' },
  { value: 'improvement', label: 'Improvement' },
];

// PRIORITIES filter — available for future use in filter bar
// const PRIORITIES = [
//   { value: 'all', label: 'All' }, { value: 'critical', label: 'Critical' },
//   { value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' },
// ];

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

const TYPE_ICONS = {
  bug: '🐛',
  feature: '✨',
  improvement: '🔧',
};

const PRODUCT_COLORS = {
  website: 'bg-teal-50 text-teal-700 border-teal-200',
  portal: 'bg-purple-50 text-purple-700 border-purple-200',
  corebot: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

export default function BacklogPage() {
  const { status: authStatus } = useSession();
  const router = useRouter();

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    product: 'all',
    status: 'open',
    type: 'all',
    priority: 'all',
  });

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTicket, setNewTicket] = useState({
    title: '',
    description: '',
    product: 'portal',
    ticketType: 'improvement',
    priority: 'medium',
  });

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.product !== 'all') params.set('product', filters.product);
    if (filters.status !== 'all') params.set('status', filters.status);
    if (filters.type !== 'all') params.set('type', filters.type);
    if (filters.priority !== 'all') params.set('priority', filters.priority);

    const res = await fetch(`/api/portal/mlo/tickets?${params}`);
    const data = await res.json();
    if (res.ok) {
      setTickets(data.tickets || []);
    } else {
      console.error('Tickets fetch error:', res.status, data);
      setTickets([]);
    }
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    if (authStatus === 'authenticated') fetchTickets();
  }, [authStatus, fetchTickets]);

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.push('/portal/mlo/login');
  }, [authStatus, router]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newTicket.title.trim()) return;
    setCreating(true);

    const res = await fetch('/api/portal/mlo/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTicket),
    });

    if (res.ok) {
      setNewTicket({ title: '', description: '', product: 'portal', ticketType: 'improvement', priority: 'medium' });
      setShowCreate(false);
      fetchTickets();
    }
    setCreating(false);
  };

  const handleQuickStatus = async (ticketId, newStatus) => {
    const res = await fetch(`/api/portal/mlo/tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) fetchTickets();
  };

  if (authStatus === 'loading') {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading...</div>;
  }

  const openCount = tickets.filter(t => t.status === 'open').length;
  const inProgressCount = tickets.filter(t => t.status === 'in_progress').length;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <button
            onClick={() => router.push('/portal/mlo')}
            className="text-xs text-gray-400 hover:text-brand transition-colors mb-1 flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Pipeline
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Dev Backlog</h1>
          <p className="text-sm text-gray-500 mt-1">
            {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
            {openCount > 0 && <span className="ml-2 text-amber-600">{openCount} open</span>}
            {inProgressCount > 0 && <span className="ml-2 text-blue-600">{inProgressCount} in progress</span>}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition-colors"
        >
          <span className="text-lg leading-none">+</span>
          New Ticket
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-5 mb-6 shadow-sm">
          <div className="grid grid-cols-1 gap-4">
            <input
              type="text"
              placeholder="Ticket title..."
              value={newTicket.title}
              onChange={(e) => setNewTicket({ ...newTicket, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
              autoFocus
            />
            <textarea
              placeholder="Description (optional)..."
              value={newTicket.description}
              onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none resize-none"
            />
            <div className="flex items-center gap-3 flex-wrap">
              <select
                value={newTicket.product}
                onChange={(e) => setNewTicket({ ...newTicket, product: e.target.value })}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="website">Website</option>
                <option value="portal">Portal</option>
                <option value="corebot">CoreBot</option>
              </select>
              <select
                value={newTicket.ticketType}
                onChange={(e) => setNewTicket({ ...newTicket, ticketType: e.target.value })}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="bug">🐛 Bug</option>
                <option value="feature">✨ Feature</option>
                <option value="improvement">🔧 Improvement</option>
              </select>
              <select
                value={newTicket.priority}
                onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value })}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="critical">🔴 Critical</option>
                <option value="high">🟠 High</option>
                <option value="medium">🔵 Medium</option>
                <option value="low">⚪ Low</option>
              </select>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || !newTicket.title.trim()}
                className="px-4 py-1.5 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Ticket'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {PRODUCTS.map((p) => (
          <button
            key={p.value}
            onClick={() => setFilters({ ...filters, product: p.value })}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              filters.product === p.value
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p.label}
          </button>
        ))}
        <div className="w-px h-5 bg-gray-200 mx-1" />
        {STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => setFilters({ ...filters, status: s.value })}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              filters.status === s.value
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s.label}
          </button>
        ))}
        <div className="w-px h-5 bg-gray-200 mx-1" />
        {TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setFilters({ ...filters, type: t.value })}
            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
              filters.type === t.value
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wider w-10"></th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Ticket</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wider w-24">Product</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wider w-24">Priority</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wider w-28">Status</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wider w-16 text-center">💬</th>
              <th className="text-left px-4 py-2.5 font-medium text-gray-500 text-xs uppercase tracking-wider w-28">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-400">Loading tickets...</td>
              </tr>
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                  No tickets match your filters.
                  <button onClick={() => setShowCreate(true)} className="text-brand hover:underline ml-1">Create one?</button>
                </td>
              </tr>
            ) : tickets.map((ticket) => (
              <tr
                key={ticket.id}
                className="hover:bg-gray-50/50 cursor-pointer transition-colors"
                onClick={() => router.push(`/portal/mlo/backlog/${ticket.id}`)}
              >
                {/* Type icon */}
                <td className="px-4 py-3 text-center">
                  <span title={ticket.ticketType}>{TYPE_ICONS[ticket.ticketType] || '📝'}</span>
                </td>

                {/* Title + description preview */}
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900 leading-tight">{ticket.title}</div>
                  {ticket.description && (
                    <div className="text-xs text-gray-400 mt-0.5">{ticket.description}</div>
                  )}
                </td>

                {/* Product */}
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded border ${PRODUCT_COLORS[ticket.product] || 'bg-gray-50 text-gray-600'}`}>
                    {ticket.product}
                  </span>
                </td>

                {/* Priority */}
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${PRIORITY_COLORS[ticket.priority] || ''}`}>
                    {ticket.priority}
                  </span>
                </td>

                {/* Status */}
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={ticket.status}
                    onChange={(e) => handleQuickStatus(ticket.id, e.target.value)}
                    className={`text-xs font-medium rounded px-2 py-0.5 border-0 cursor-pointer ${STATUS_COLORS[ticket.status] || ''}`}
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </td>

                {/* Comment count */}
                <td className="px-4 py-3 text-center text-xs text-gray-400">
                  {ticket._count?.entries > 0 ? ticket._count.entries : '—'}
                </td>

                {/* Updated */}
                <td className="px-4 py-3 text-xs text-gray-400">
                  {new Date(ticket.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
