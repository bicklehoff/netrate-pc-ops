'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

export default function ContactsPage() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newContact, setNewContact] = useState({ firstName: '', lastName: '', email: '', phone: '', notes: '' });
  const [error, setError] = useState('');

  const fetchContacts = useCallback(async () => {
    try {
      const params = search ? `?q=${encodeURIComponent(search)}` : '';
      const res = await fetch(`/api/portal/mlo/contacts${params}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setContacts(data.contacts || []);
    } catch {
      setError('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => fetchContacts(), 300);
    return () => clearTimeout(timer);
  }, [fetchContacts]);

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
      if (!res.ok) {
        setError(data.error || 'Failed to create contact');
        return;
      }
      setShowCreate(false);
      setNewContact({ firstName: '', lastName: '', email: '', phone: '', notes: '' });
      fetchContacts();
    } catch {
      setError('Failed to create contact');
    } finally {
      setCreating(false);
    }
  };

  const statusColor = (status) => {
    const colors = {
      prospect: 'bg-blue-100 text-blue-700',
      processing: 'bg-yellow-100 text-yellow-700',
      funded: 'bg-green-100 text-green-700',
      'cond_approved': 'bg-orange-100 text-orange-700',
      denied: 'bg-red-100 text-red-700',
      archived: 'bg-gray-100 text-gray-500',
    };
    return colors[status] || 'bg-gray-100 text-gray-600';
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="text-gray-500 text-sm mt-1">
            {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-dark transition-colors"
        >
          + New Contact
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">New Contact</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">First Name *</label>
              <input
                required
                value={newContact.firstName}
                onChange={(e) => setNewContact({ ...newContact, firstName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Last Name *</label>
              <input
                required
                value={newContact.lastName}
                onChange={(e) => setNewContact({ ...newContact, lastName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input
                type="email"
                value={newContact.email}
                onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
              <input
                value={newContact.phone}
                onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea
              value={newContact.notes}
              onChange={(e) => setNewContact({ ...newContact, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-dark transition-colors disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Contact'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search contacts by name, email, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Contact List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading contacts...</div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {search ? 'No contacts match your search' : 'No contacts yet. Import a loan or create one manually.'}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm divide-y divide-gray-100">
          {contacts.map((contact) => (
            <div key={contact.id} className="px-5 py-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-brand/10 text-brand font-semibold text-sm flex items-center justify-center flex-shrink-0">
                      {contact.firstName?.[0]}{contact.lastName?.[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {contact.firstName} {contact.lastName}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                        {contact.email && <span className="truncate">{contact.email}</span>}
                        {contact.phone && <span>{contact.phone}</span>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Loan history */}
                <div className="flex items-center gap-3 ml-4">
                  {contact.borrower?.loans?.length > 0 && (
                    <div className="flex gap-1.5">
                      {contact.borrower.loans.map((loan) => (
                        <Link
                          key={loan.id}
                          href={`/portal/mlo/loans/${loan.id}`}
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColor(loan.status)}`}
                          title={`${loan.purpose || 'Loan'} — $${loan.loanAmount?.toLocaleString() || '?'} — ${loan.lenderName || 'No lender'}`}
                        >
                          {loan.status}
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Tags */}
                  {contact.tags?.length > 0 && (
                    <div className="flex gap-1">
                      {contact.tags.map((tag) => (
                        <span key={tag} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Source */}
                  <span className="text-[10px] text-gray-400 w-16 text-right">{contact.source}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
