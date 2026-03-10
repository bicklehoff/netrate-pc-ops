// MLO Loan Detail Page — Core UI Redesign
// Renders the new sidebar-based LoanDetailShell.
// Replaces the old single-page LoanDetailView.

'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import LoanDetailShell from '@/components/Portal/Core/LoanDetailShell';

function LoanDetailContent() {
  const { status: authStatus } = useSession();
  const params = useParams();
  const router = useRouter();
  const [loan, setLoan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLoan = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/mlo/loans/${params.id}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError('Loan not found.');
        } else if (res.status === 401 || res.status === 403) {
          router.push('/portal/mlo/login');
          return;
        } else {
          setError('Failed to load loan.');
        }
        return;
      }
      const data = await res.json();
      setLoan(data.loan);
    } catch {
      setError('Failed to load loan details.');
    } finally {
      setLoading(false);
    }
  }, [params.id, router]);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/portal/mlo/login');
    }
  }, [authStatus, router]);

  useEffect(() => {
    if (authStatus === 'authenticated') {
      fetchLoan();
    }
  }, [authStatus, fetchLoan]);

  if (authStatus === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse space-y-4 w-full max-w-4xl px-6">
          <div className="h-6 bg-gray-200 rounded w-48" />
          <div className="h-12 bg-gray-200 rounded" />
          <div className="grid grid-cols-3 gap-4">
            <div className="h-32 bg-gray-200 rounded" />
            <div className="h-32 bg-gray-200 rounded" />
            <div className="h-32 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center max-w-md">
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={() => router.push('/portal/mlo')}
            className="text-sm text-brand hover:underline"
          >
            ← Back to Pipeline
          </button>
        </div>
      </div>
    );
  }

  return (
    <LoanDetailShell
      loan={loan}
      onRefresh={fetchLoan}
    />
  );
}

// Wrap in Suspense for useSearchParams in LoanSidebar
export default function MloLoanDetailPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse h-6 bg-gray-200 rounded w-48" />
      </div>
    }>
      <LoanDetailContent />
    </Suspense>
  );
}
