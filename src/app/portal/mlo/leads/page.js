// MLO Leads — Lead Management View
// Auth required (MLO or Admin role via NextAuth)
// Shows all incoming leads with status filters and quick actions.

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import LeadsTable from '@/components/Portal/LeadsTable';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'converted', label: 'Converted' },
  { value: 'closed', label: 'Closed' },
];

export default function MloLeadsPage() {
  const { status: authStatus } = useSession();
  const router = useRouter();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/portal/mlo/login');
    }
  }, [authStatus, router]);

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch('/api/portal/mlo/leads');
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setLeads(data.leads || []);
    } catch {
      setError('Failed to load leads.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === 'authenticated') {
      fetchLeads();
    }
  }, [authStatus, fetchLeads]);

  const filteredLeads = leads.filter((lead) => {
    if (filter === 'all') return true;
    return lead.status === filter;
  });

  const newCount = leads.filter((l) => l.status === 'new').length;

  if (authStatus === 'loading' || loading) {
    return (
      <div className="max-w-5xl mx-auto py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-4 bg-gray-200 rounded w-72" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-gray-500 text-sm mt-1">
            Incoming leads from the website. Click a row to expand details.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/portal/mlo"
            className="text-xs text-gray-400 hover:text-brand transition-colors"
          >
            &larr; Pipeline
          </Link>
          {newCount > 0 && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {newCount} New
            </span>
          )}
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            {leads.length} Total
          </span>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
              filter === f.value
                ? 'bg-brand text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
            {f.value === 'new' && newCount > 0 && (
              <span className="ml-1.5 bg-white/20 rounded-full px-1.5 text-[10px]">
                {newCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {filteredLeads.length === 0 && !error ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-12 text-center">
          <p className="text-gray-400 text-sm">
            {leads.length === 0
              ? 'No leads yet. They will appear here when visitors request a quote from the website.'
              : `No leads matching "${STATUS_FILTERS.find((f) => f.value === filter)?.label}" filter.`}
          </p>
        </div>
      ) : (
        <LeadsTable leads={filteredLeads} onStatusChange={fetchLeads} />
      )}
    </div>
  );
}
