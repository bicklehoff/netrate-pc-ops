// MLO Loan Detail Page
// Shows full loan info, borrower details, status controls, documents, and timeline.

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import LoanDetailView from '@/components/Portal/LoanDetailView';

export default function MloLoanDetailPage() {
  const { data: session, status: authStatus } = useSession();
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
      <div className="max-w-4xl mx-auto py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-32" />
          <div className="h-48 bg-gray-200 rounded" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
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
    <div className="max-w-4xl mx-auto">
      <button
        onClick={() => router.push('/portal/mlo')}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-flex items-center gap-1"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Pipeline
      </button>

      <LoanDetailView loan={loan} session={session} onRefresh={fetchLoan} />
    </div>
  );
}
