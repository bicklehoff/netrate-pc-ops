// MLO Contacts — CRM Hub
// Full-width, filterable, sortable contact list with status badges

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'past_client', label: 'Past Client' },
  { value: 'subscriber', label: 'Subscriber' },
  { value: 'lead', label: 'Lead' },
  { value: 'applicant', label: 'Applicant' },
  { value: 'in_process', label: 'In Process' },
  { value: 'funded', label: 'Funded' },
  { value: 'archived', label: 'Archived' },
];

const STATUS_COLORS = {
  past_client: 'bg-green-100 text-green-800',
  subscriber: 'bg-gray-100 text-gray-700',
  lead: 'bg-blue-100 text-blue-800',
  applicant: 'bg-amber-100 text-amber-800',
  in_process: 'bg-purple-100 text-purple-800',
  funded: 'bg-green-200 text-green-900',
  partner: 'bg-cyan-100 text-cyan-800',
  archived: 'bg-red-100 text-red-700',
};

function timeAgo(date) {
  if (!date) return '—';
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

export default function ContactsPage() {
  const { status: authStatus } = useSession();
  const router = useRouter();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [statusCounts, setStatusCounts] = useState({});
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [sort, setSort] = useState('updated_at');
  const [order, setOrder] = useState('desc');
  const [error, setError] = useState('');

  // Create contact modal
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newContact, setNewContact] = useState({ first_name: '', last_name: '', email: '', phone: '', notes: '' });

  // Create lead modal
  const [leadModal, setLeadModal] = useState(null);
  const [leadForm, setLeadForm] = useState({ loan_purpose: '', property_state: '', notes: '' });
  const [creatingLead, setCreatingLead] = useState(false);

  useEffect(() => {
    if (authStatus === 'unauthenticated') router.push('/portal/mlo/login');
  }, [authStatus, router]);

  const fetchContacts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (statusFilter) params.set('status', statusFilter);
      params.set('sort', sort);
      params.set('order', order);
      params.set('page', pagination.page.toString());
      params.set('limit', '50');

      const res = await fetch(`/api/portal/mlo/contacts?${params}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setContacts(data.contacts || []);
      setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
      if (data.statusCounts) setStatusCounts(data.statusCounts);
    } catch {
      setError('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, sort, order, pagination.page]);

  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    setLoading(true);
    const timer = setTimeout(() => fetchContacts(), 300);
    return () => clearTimeout(timer);
  }, [authStatus, fetchContacts]);

  const handleSort = (field) => {
    if (sort === field) {
      setOrder(order === 'desc' ? 'asc' : 'desc');
    } else {
      setSort(field);
      setOrder('desc');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const res = await fetch('/api/portal/mlo/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newContact),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed'); return; }
      setShowCreate(false);
      setNewContact({ first_name: '', last_name: '', email: '', phone: '', notes: '' });
      fetchContacts();
    } catch { setError('Failed to create contact'); }
    finally { setCreating(false); }
  };

  const handleCreateLead = async (e) => {
    e.preventDefault();
    setCreatingLead(true);
    setError('');
    try {
      const res = await fetch(`/api/portal/mlo/contacts/${leadModal.id}/create-lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadForm),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed'); return; }
      setLeadModal(null);
      setLeadForm({ loan_purpose: '', property_state: '', notes: '' });
      router.push('/portal/mlo/leads');
    } catch { setError('Failed to create lead'); }
    finally { setCreatingLead(false); }
  };

  const totalAll = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const SortIcon = ({ field }) => {
    if (sort !== field) return null;
    return <span className="text-brand ml-0.5">{order === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Contacts</h1>
          <p className="text-gray-500 text-sm">{pagination.total} total</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-go text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-go-dark transition-colors"
        >
          + New Contact
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-xl p-5 mb-4 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-3">New Contact</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">First Name *</label>
              <input required value={newContact.first_name} onChange={(e) => setNewContact({ ...newContact, first_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Last Name *</label>
              <input required value={newContact.last_name} onChange={(e) => setNewContact({ ...newContact, last_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input type="email" value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
              <input value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={creating} className="bg-go text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-go-dark disabled:opacity-50">
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">Cancel</button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        {/* Status filter tabs */}
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => { setStatusFilter(''); setPagination(p => ({ ...p, page: 1 })); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!statusFilter ? 'bg-brand text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            All {totalAll > 0 && <span className="ml-1 opacity-75">{totalAll}</span>}
          </button>
          {STATUS_OPTIONS.filter(s => s.value).map(s => {
            const count = statusCounts[s.value] || 0;
            if (count === 0 && s.value !== statusFilter) return null;
            return (
              <button
                key={s.value}
                onClick={() => { setStatusFilter(s.value); setPagination(p => ({ ...p, page: 1 })); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s.value ? 'bg-brand text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {s.label} {count > 0 && <span className="ml-1 opacity-75">{count}</span>}
              </button>
            );
          })}
        </div>
        {/* Search */}
        <div className="flex-1 max-w-sm ml-auto">
          <input
            type="text"
            placeholder="Search name, email, phone..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 font-medium">×</button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading contacts...</div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {search || statusFilter ? 'No contacts match your filters' : 'No contacts yet'}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                <th className="text-left px-4 py-3 cursor-pointer hover:text-gray-700" onClick={() => handleSort('name')}>
                  Name <SortIcon field="name" />
                </th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Phone</th>
                <th className="text-left px-4 py-3 cursor-pointer hover:text-gray-700" onClick={() => handleSort('status')}>
                  Status <SortIcon field="status" />
                </th>
                <th className="text-left px-4 py-3">MLO</th>
                <th className="text-left px-4 py-3 cursor-pointer hover:text-gray-700" onClick={() => handleSort('last_contacted_at')}>
                  Last Contact <SortIcon field="last_contacted_at" />
                </th>
                <th className="text-left px-4 py-3">Loans</th>
                <th className="text-right px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contacts.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/portal/mlo/contacts/${c.id}`)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-brand/10 text-brand font-semibold text-xs flex items-center justify-center flex-shrink-0">
                        {c.first_name?.[0]}{c.last_name?.[0]}
                      </div>
                      <span className="font-medium text-gray-900">{c.first_name} {c.last_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 truncate max-w-[200px]">{c.email || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] || 'bg-gray-100'}`}>
                      {c.status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {c.assignedMlo ? `${c.assignedMlo.first_name} ${c.assignedMlo.last_name?.[0]}.` : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{timeAgo(c.last_contacted_at)}</td>
                  <td className="px-4 py-3">
                    {c.borrower?.loans?.length > 0 && (
                      <span className="text-xs text-gray-500">{c.borrower.loans.length}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => { setLeadModal(c); }}
                      className="text-xs font-medium text-brand hover:text-brand-dark border border-brand/30 hover:border-brand px-2 py-1 rounded transition-colors"
                    >
                      + Lead
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50 text-sm">
              <span className="text-gray-500">
                Page {pagination.page} of {pagination.pages} ({pagination.total} contacts)
              </span>
              <div className="flex gap-1">
                <button
                  disabled={pagination.page <= 1}
                  onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                  className="px-3 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                >
                  Prev
                </button>
                <button
                  disabled={pagination.page >= pagination.pages}
                  onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                  className="px-3 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Lead Modal */}
      {leadModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setLeadModal(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 text-lg mb-1">Create Lead</h3>
            <p className="text-sm text-gray-500 mb-4">
              {leadModal.first_name} {leadModal.last_name}
              {leadModal.status === 'past_client' && (
                <span className="ml-2 inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Returning Client</span>
              )}
            </p>
            <form onSubmit={handleCreateLead}>
              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Loan Purpose</label>
                  <select value={leadForm.loan_purpose} onChange={(e) => setLeadForm({ ...leadForm, loan_purpose: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none">
                    <option value="">Select...</option>
                    <option value="purchase">Purchase</option>
                    <option value="refinance">Refinance</option>
                    <option value="cashout">Cash-Out Refinance</option>
                    <option value="heloc">HELOC</option>
                    <option value="reverse">Reverse Mortgage</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
                  <select value={leadForm.property_state} onChange={(e) => setLeadForm({ ...leadForm, property_state: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none">
                    <option value="">Select...</option>
                    <option value="CO">Colorado</option>
                    <option value="CA">California</option>
                    <option value="TX">Texas</option>
                    <option value="OR">Oregon</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                  <textarea value={leadForm.notes} onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
                    rows={2} placeholder="Context..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none" />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={creatingLead} className="flex-1 bg-go text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-go-dark disabled:opacity-50">
                  {creatingLead ? 'Creating...' : 'Create Lead'}
                </button>
                <button type="button" onClick={() => setLeadModal(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
