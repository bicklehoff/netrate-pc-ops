// MLO Leads — Lead Management View
// Full-width, with source badges (warm/cold), contact links, search, MLO filter

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import LeadsTable from '@/components/Portal/LeadsTable';
import LeadKanban from '@/components/Portal/LeadKanban';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'quoted', label: 'Quoted' },
  { value: 'converted', label: 'Converted' },
  { value: 'closed', label: 'Closed' },
];

const WARM_SOURCES = ['contact', 'referral', 'past_client', 'realtor_referral'];

export default function MloLeadsPage() {
  const { status: authStatus } = useSession();
  const router = useRouter();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'kanban'

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/portal/mlo/login');
    }
  }, [authStatus, router]);

  const fetchLeads = useCallback(async (q) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      const res = await fetch(`/api/portal/mlo/leads?${params}`);
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
    if (authStatus !== 'authenticated') return;
    fetchLeads(activeSearch);
  }, [authStatus, activeSearch, fetchLeads]);

  const filteredLeads = leads.filter((lead) => {
    if (filter === 'all') return true;
    return lead.status === filter;
  });

  const newCount = leads.filter((l) => l.status === 'new').length;
  const warmCount = leads.filter((l) => WARM_SOURCES.includes(l.source)).length;

  // Enrich leads with warm/cold flag
  const enrichedLeads = filteredLeads.map(l => ({
    ...l,
    isWarm: WARM_SOURCES.includes(l.source) || l.contact?.status === 'past_client',
  }));

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
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Leads</h1>
          <p className="text-gray-500 text-sm mt-1">
            {leads.length} total
            {warmCount > 0 && <span className="text-green-600 ml-2">{warmCount} warm</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {newCount > 0 && (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {newCount} New
            </span>
          )}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                viewMode === 'table' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
              title="Table view"
            >
              ☰
            </button>
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                viewMode === 'kanban' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
              title="Board view"
            >
              ▦
            </button>
          </div>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-3 mb-4">
        {/* Status tabs */}
        <div className="flex gap-1 overflow-x-auto">
          {STATUS_FILTERS.map((f) => {
            const count = f.value === 'all' ? leads.length : leads.filter(l => l.status === f.value).length;
            if (count === 0 && f.value !== 'all' && f.value !== filter) return null;
            return (
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
                {count > 0 && <span className="ml-1 opacity-75">{count}</span>}
              </button>
            );
          })}
        </div>
        {/* Search */}
        <div className="flex-1 max-w-sm ml-auto flex gap-1.5">
          <input
            type="text"
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') setActiveSearch(search); }}
            className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
          />
          <button
            onClick={() => setActiveSearch(search)}
            className="px-3 py-1.5 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition-colors"
          >
            Search
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {enrichedLeads.length === 0 && !error ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-12 text-center">
          <p className="text-gray-400 text-sm">
            {leads.length === 0
              ? 'No leads yet. They will appear here when visitors request a quote from the website.'
              : `No leads matching "${STATUS_FILTERS.find((f) => f.value === filter)?.label}" filter.`}
          </p>
        </div>
      ) : viewMode === 'kanban' ? (
        <LeadKanban leads={enrichedLeads} onStatusChange={fetchLeads} />
      ) : (
        <LeadsTable leads={enrichedLeads} onStatusChange={fetchLeads} />
      )}
    </div>
  );
}
