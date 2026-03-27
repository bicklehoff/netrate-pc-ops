// MLO Dashboard — Pipeline View
// Auth required (MLO or Admin role via NextAuth)
// Shows all loans assigned to the current MLO in a sortable table.
// Supports inline editing (status, LO, lender, loan #) and bulk updates.

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PipelineTable from '@/components/Portal/PipelineTable';
import XmlImportModal from '@/components/Portal/XmlImportModal';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Prospect' },
  { value: 'applied', label: 'Applied' },
  { value: 'processing', label: 'Processing' },
  { value: 'submitted_uw', label: 'In UW' },
  { value: 'cond_approved', label: 'Cond. Approved' },
  { value: 'ctc', label: 'CTC' },
  { value: 'funded', label: 'Funded' },
  { value: 'denied', label: 'Denied' },
  { value: 'archived', label: 'Archived' },
];

const TERMINAL_STATUSES = ['funded', 'denied', 'archived'];

const STATUS_LABELS = {
  draft: 'Prospect',
  applied: 'Applied',
  processing: 'Processing',
  submitted_uw: 'In UW',
  cond_approved: 'Cond. Approved',
  suspended: 'Suspended',
  ctc: 'Clear to Close',
  docs_out: 'Docs Out',
  funded: 'Funded',
  denied: 'Denied',
  archived: 'Archived',
};

const ALL_STATUSES = [
  'draft', 'applied', 'processing', 'submitted_uw',
  'cond_approved', 'ctc', 'docs_out', 'funded',
  'suspended', 'denied', 'archived',
];

// ─── Bulk Action Bar ──────────────────────────────────────────
// Floating bar at the bottom when 1+ loans are selected.
// Offers "Change Status" and "Assign LO" dropdowns, plus Clear.

function BulkActionBar({ count, mloList, onBulkUpdate, onBulkDelete, onClear }) {
  const [activeAction, setActiveAction] = useState(null); // 'status' | 'mlo' | null
  const [applying, setApplying] = useState(false);
  const barRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (barRef.current && !barRef.current.contains(e.target)) {
        setActiveAction(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const applyUpdate = async (updates) => {
    setApplying(true);
    try {
      await onBulkUpdate(updates);
      setActiveAction(null);
    } catch (err) {
      console.error('Bulk update failed:', err);
      alert(`Bulk update failed: ${err.message}`);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div
        ref={barRef}
        className="flex items-center gap-3 px-5 py-3 bg-gray-900 text-white rounded-xl shadow-2xl border border-gray-700"
      >
        <span className="text-sm font-medium whitespace-nowrap">
          {count} loan{count !== 1 ? 's' : ''} selected
        </span>

        <div className="w-px h-5 bg-gray-600" />

        {/* Change Status */}
        <div className="relative">
          <button
            onClick={() => setActiveAction(activeAction === 'status' ? null : 'status')}
            disabled={applying}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
          >
            Change Status
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {activeAction === 'status' && (
            <div className="absolute bottom-full mb-2 left-0 bg-white text-gray-900 rounded-lg shadow-xl border border-gray-200 py-1 min-w-[160px] max-h-64 overflow-y-auto">
              {ALL_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => applyUpdate({ status: s })}
                  className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 transition-colors"
                >
                  {STATUS_LABELS[s] || s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Assign LO */}
        <div className="relative">
          <button
            onClick={() => setActiveAction(activeAction === 'mlo' ? null : 'mlo')}
            disabled={applying}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
          >
            Assign LO
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {activeAction === 'mlo' && (
            <div className="absolute bottom-full mb-2 left-0 bg-white text-gray-900 rounded-lg shadow-xl border border-gray-200 py-1 min-w-[180px] max-h-64 overflow-y-auto">
              <button
                onClick={() => applyUpdate({ mloId: null })}
                className="block w-full text-left px-3 py-1.5 text-sm text-gray-400 hover:bg-gray-100 transition-colors"
              >
                Unassigned
              </button>
              {mloList.map((m) => (
                <button
                  key={m.id}
                  onClick={() => applyUpdate({ mloId: m.id })}
                  className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 transition-colors"
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Archive */}
        <button
          onClick={() => applyUpdate({ status: 'archived' })}
          disabled={applying}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          Archive
        </button>

        {/* Delete */}
        <button
          onClick={async () => {
            if (confirm(`Delete ${count} loan${count !== 1 ? 's' : ''} permanently? This cannot be undone.`)) {
              setApplying(true);
              try {
                await onBulkDelete();
              } catch (err) {
                console.error('Bulk delete failed:', err);
                alert(`Delete failed: ${err.message}`);
              } finally {
                setApplying(false);
              }
            }
          }}
          disabled={applying}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-900/60 hover:bg-red-800 rounded-lg transition-colors disabled:opacity-50"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete
        </button>

        <div className="w-px h-5 bg-gray-600" />

        {/* Clear selection */}
        <button
          onClick={onClear}
          className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:text-white transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

// ─── Pipeline Page ────────────────────────────────────────────

export default function MloDashboardPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [loans, setLoans] = useState([]);
  const [mloList, setMloList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('active');
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(0);
  const [mloFilter, setMloFilter] = useState('all');
  const [importOpen, setImportOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/portal/mlo/login');
    }
  }, [authStatus, router]);

  // Fetch pipeline + MLO list on mount
  const fetchPipeline = useCallback(async () => {
    try {
      const res = await fetch('/api/portal/mlo/pipeline');
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setLoans(data.loans || []);
    } catch {
      setError('Failed to load pipeline.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === 'authenticated') {
      fetchPipeline();

      // Fetch MLO list for LO assignment dropdown
      fetch('/api/portal/mlo/list')
        .then((res) => res.json())
        .then((data) => setMloList(data.mlos || []))
        .catch(() => {}); // Non-critical — LO column just won't have dropdown options
    }
  }, [authStatus, fetchPipeline]);

  // ─── Inline edit handler (single loan) ────────────────────
  const handleLoanUpdate = useCallback(async (loanId, updates) => {
    const res = await fetch(`/api/portal/mlo/loans/${loanId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Update failed');
    }

    // Optimistic-ish: refresh pipeline to get clean data
    const pipelineRes = await fetch('/api/portal/mlo/pipeline');
    if (pipelineRes.ok) {
      const data = await pipelineRes.json();
      setLoans(data.loans || []);
    }
  }, []);

  // ─── Bulk update handler ──────────────────────────────────
  const handleBulkUpdate = useCallback(async (updates) => {
    const ids = Array.from(selectedIds);
    const res = await fetch('/api/portal/mlo/pipeline', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loanIds: ids, updates }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Bulk update failed');
    }

    // Refresh pipeline and clear selection
    const pipelineRes = await fetch('/api/portal/mlo/pipeline');
    if (pipelineRes.ok) {
      const data = await pipelineRes.json();
      setLoans(data.loans || []);
    }
    setSelectedIds(new Set());
  }, [selectedIds]);

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    const res = await fetch('/api/portal/mlo/pipeline', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loanIds: ids }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Delete failed');
    }

    // Refresh pipeline and clear selection
    const pipelineRes = await fetch('/api/portal/mlo/pipeline');
    if (pipelineRes.ok) {
      const data = await pipelineRes.json();
      setLoans(data.loans || []);
    }
    setSelectedIds(new Set());
  }, [selectedIds]);

  // Filter loans by status + LO + search
  const filteredLoans = loans.filter((loan) => {
    // Status filter
    if (filter === 'active' && TERMINAL_STATUSES.includes(loan.status)) return false;
    if (filter !== 'all' && filter !== 'active' && loan.status !== filter) return false;

    // LO filter
    if (mloFilter === 'unassigned' && loan.mloId) return false;
    if (mloFilter !== 'all' && mloFilter !== 'unassigned' && loan.mloId !== mloFilter) return false;

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      const fields = [loan.borrowerName, loan.loanNumber, loan.lenderName, loan.propertyStreet, loan.borrowerEmail, loan.mloName].filter(Boolean);
      return fields.some(f => f.toLowerCase().includes(q));
    }
    return true;
  });

  // Clear selection and reset page when filter/search changes
  useEffect(() => {
    setSelectedIds(new Set());
    setPage(0);
  }, [filter, search]);

  const activeCount = loans.filter((l) => !TERMINAL_STATUSES.includes(l.status)).length;

  if (authStatus === 'loading' || loading) {
    return (
      <div className="py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-4 bg-gray-200 rounded w-72" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Loan Pipeline</h1>
          <p className="text-gray-500 text-sm mt-1">
            Welcome back, {session?.user?.name || 'there'}. Manage your active applications.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setImportOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-brand rounded-lg hover:bg-brand-dark transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import XML
          </button>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-brand/10 text-brand">
            {activeCount} Active
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            {loans.length} Total
          </span>
        </div>
      </div>



      {/* Status Filter + Search */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex gap-1 overflow-x-auto pb-1 flex-1">
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
            </button>
          ))}
        </div>
        <select
          value={mloFilter}
          onChange={(e) => setMloFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
        >
          <option value="all">All LOs</option>
          <option value="unassigned">Unassigned</option>
          {mloList.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Search borrower, lender, address..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {filteredLoans.length === 0 && !error ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-12 text-center">
          <p className="text-gray-400 text-sm">
            {loans.length === 0
              ? 'No loan applications yet. They will appear here when borrowers apply.'
              : search
                ? `No loans matching "${search}".`
                : `No loans matching "${STATUS_FILTERS.find((f) => f.value === filter)?.label}" filter.`}
          </p>
        </div>
      ) : (
        <>
          <PipelineTable
            loans={filteredLoans.slice(page * pageSize, (page + 1) * pageSize)}
            mloList={mloList}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            onLoanUpdate={handleLoanUpdate}
          />
          {/* Pagination controls */}
          <div className="flex items-center justify-between mt-3 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
                className="border border-gray-300 rounded px-2 py-1 text-sm"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span>of {filteredLoans.length} loans</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-2 py-1 rounded border border-gray-300 disabled:opacity-30 hover:bg-gray-100"
              >
                &larr; Prev
              </button>
              <span>Page {page + 1} of {Math.max(1, Math.ceil(filteredLoans.length / pageSize))}</span>
              <button
                onClick={() => setPage(p => Math.min(Math.ceil(filteredLoans.length / pageSize) - 1, p + 1))}
                disabled={(page + 1) * pageSize >= filteredLoans.length}
                className="px-2 py-1 rounded border border-gray-300 disabled:opacity-30 hover:bg-gray-100"
              >
                Next &rarr;
              </button>
            </div>
          </div>
        </>
      )}

      {/* Bulk Action Bar — appears when loans are selected */}
      {selectedIds.size > 0 && (
        <BulkActionBar
          count={selectedIds.size}
          mloList={mloList}
          onBulkUpdate={handleBulkUpdate}
          onBulkDelete={handleBulkDelete}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      {/* MISMO XML Import Modal */}
      <XmlImportModal
        open={importOpen}
        onClose={() => {
          setImportOpen(false);
          // Refresh pipeline after import
          fetchPipeline();
        }}
      />
    </div>
  );
}
