// MLO Scenario Alerts — Review queue for saved scenario rate alerts
// Cron re-prices scenarios daily → queued here → MLO approves before email sends

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import ScenarioAlertTable from '@/components/Portal/ScenarioAlertTable';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending Review' },
  { value: 'sent', label: 'Sent' },
  { value: 'declined', label: 'Declined' },
];

export default function ScenarioAlertsPage() {
  const { status: authStatus } = useSession();
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/portal/mlo/login');
    }
  }, [authStatus, router]);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('status', filter);
      if (activeSearch) params.set('q', activeSearch);
      const res = await fetch(`/api/portal/mlo/scenario-alerts?${params}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setItems(data.items || []);
    } catch {
      setError('Failed to load alerts.');
    } finally {
      setLoading(false);
    }
  }, [filter, activeSearch]);

  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    fetchItems();
  }, [authStatus, fetchItems]);

  const handleAction = async (action, ids, mloNotes) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/portal/mlo/scenario-alerts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, action, mloNotes }),
      });
      if (!res.ok) throw new Error('Action failed');
      setSelectedIds([]);
      await fetchItems();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const pendingCount = items.filter(i => i.status === 'pending').length;

  if (authStatus === 'loading' || loading) {
    return (
      <div className="w-full py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">Rate Alerts</h1>
          {pendingCount > 0 && (
            <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-1 rounded-full">
              {pendingCount} pending
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search borrower..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setActiveSearch(search)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-48 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/20"
          />
          <button
            onClick={() => setActiveSearch(search)}
            className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Search
          </button>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-1 mb-4">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => { setFilter(f.value); setSelectedIds([]); }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              filter === f.value
                ? 'bg-brand text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>
      )}

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white rounded-xl shadow-2xl px-6 py-3 flex items-center gap-4">
          <span className="text-sm font-medium">{selectedIds.length} selected</span>
          <button
            onClick={() => handleAction('approve', selectedIds)}
            disabled={actionLoading}
            className="bg-green-600 hover:bg-green-700 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {actionLoading ? 'Sending...' : 'Approve & Send'}
          </button>
          <button
            onClick={() => handleAction('decline', selectedIds)}
            disabled={actionLoading}
            className="bg-red-600 hover:bg-red-700 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            Decline
          </button>
          <button
            onClick={() => setSelectedIds([])}
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      <ScenarioAlertTable
        items={items}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onAction={handleAction}
        actionLoading={actionLoading}
      />
    </div>
  );
}
