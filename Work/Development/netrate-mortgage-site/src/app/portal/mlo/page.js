// MLO Dashboard — Pipeline View
// Auth required (MLO or Admin role via NextAuth)
// Shows all loans assigned to the current MLO in a sortable table.

'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PipelineTable from '@/components/Portal/PipelineTable';

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'applied', label: 'Applied' },
  { value: 'processing', label: 'Processing' },
  { value: 'submitted_uw', label: 'In UW' },
  { value: 'cond_approved', label: 'Cond. Approved' },
  { value: 'ctc', label: 'CTC' },
  { value: 'funded', label: 'Funded' },
  { value: 'denied', label: 'Denied' },
];

const TERMINAL_STATUSES = ['funded', 'denied'];

export default function MloDashboardPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('active');

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/portal/mlo/login');
    }
  }, [authStatus, router]);

  useEffect(() => {
    async function fetchPipeline() {
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
    }

    if (authStatus === 'authenticated') {
      fetchPipeline();
    }
  }, [authStatus]);

  // Filter loans
  const filteredLoans = loans.filter((loan) => {
    if (filter === 'all') return true;
    if (filter === 'active') return !TERMINAL_STATUSES.includes(loan.status);
    return loan.status === filter;
  });

  const activeCount = loans.filter((l) => !TERMINAL_STATUSES.includes(l.status)).length;

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
          <h1 className="text-2xl font-bold text-gray-900">Loan Pipeline</h1>
          <p className="text-gray-500 text-sm mt-1">
            Welcome back, {session?.user?.name || 'there'}. Manage your active applications.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/portal/mlo/tools/hecm-optimizer"
            className="text-xs text-cyan-600 hover:text-cyan-700 font-medium transition-colors"
          >
            HECM Optimizer &rarr;
          </Link>
          {session?.user?.role === 'admin' && (
            <>
              <Link
                href="/portal/mlo/marketing"
                className="text-xs text-gray-400 hover:text-brand transition-colors"
              >
                Marketing Playbook &rarr;
              </Link>
              <Link
                href="/portal/mlo/gbp-checklist"
                className="text-xs text-gray-400 hover:text-brand transition-colors"
              >
                GBP Rename &rarr;
              </Link>
            </>
          )}
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-brand/10 text-brand">
            {activeCount} Active
          </span>
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            {loans.length} Total
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
          </button>
        ))}
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
              : `No loans matching "${STATUS_FILTERS.find((f) => f.value === filter)?.label}" filter.`}
          </p>
        </div>
      ) : (
        <PipelineTable loans={filteredLoans} />
      )}
    </div>
  );
}
