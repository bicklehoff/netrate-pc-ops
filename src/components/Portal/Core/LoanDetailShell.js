// LoanDetailShell — Orchestrator for the new Core loan detail page
// Renders: Sidebar + StatusHeader + active section based on ?section= param
//
// Props:
//   loan         — Full loan object from API (with includes)
//   onRefresh    — () => void — refetch loan data
//   session      — NextAuth session

'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useCallback } from 'react';
import LoanSidebar from './LoanSidebar';
import StatusHeader from './StatusHeader';
import OverviewSection from './sections/OverviewSection';
import LoanInfoSection from './sections/LoanInfoSection';
import BorrowerSection from './sections/BorrowerSection';
import ProcessingSection from './sections/ProcessingSection';
import DocumentsSection from './sections/DocumentsSection';
import NotesActivitySection from './sections/NotesActivitySection';
import PostCloseSection from './sections/PostCloseSection';
import ConditionsSection from './sections/ConditionsSection';
import ApplicationSection from './sections/ApplicationSection';
import PayrollSection from '../PayrollSection';
import CompensationSection from '../CompensationSection';
import PrequalLetterModal from '../PrequalLetter/PrequalLetterModal';

export default function LoanDetailShell({ loan, onRefresh }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeSection = searchParams.get('section') || 'overview';
  const [actionError, setActionError] = useState('');
  const [showPrequal, setShowPrequal] = useState(false);
  const [prequelEverOpened, setPrequalEverOpened] = useState(false);

  // ─── Shared update handler for inline field edits ───
  const updateLoanField = useCallback(async (updates) => {
    setActionError('');
    const res = await fetch(`/api/portal/mlo/loans/${loan.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Update failed');
    }
    onRefresh();
  }, [loan?.id, onRefresh]);

  // ─── Status change handler (with auto-date capture) ───
  const handleStatusChange = useCallback(async (newStatus) => {
    setActionError('');
    try {
      await updateLoanField({ status: newStatus });
    } catch (err) {
      setActionError(err.message || 'Status change failed');
    }
  }, [updateLoanField]);

  // ─── Dates update handler ───
  const updateDates = useCallback(async (dateUpdates) => {
    setActionError('');
    const res = await fetch(`/api/portal/mlo/loans/${loan.id}/dates`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dateUpdates),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Date update failed');
    }
    onRefresh();
  }, [loan?.id, onRefresh]);

  if (!loan) return null;

  const renderSection = () => {
    switch (activeSection) {
      case 'overview':
        return (
          <OverviewSection
            loan={loan}
            onRefresh={onRefresh}
            updateLoanField={updateLoanField}
            updateDates={updateDates}
          />
        );
      case 'loan-info':
        return (
          <LoanInfoSection
            loan={loan}
            updateLoanField={updateLoanField}
            updateDates={updateDates}
          />
        );
      case 'borrower':
        return (
          <BorrowerSection
            loan={loan}
            updateLoanField={updateLoanField}
          />
        );
      case 'application':
        return (
          <ApplicationSection
            loan={loan}
          />
        );
      case 'processing':
        return (
          <ProcessingSection
            loan={loan}
            updateDates={updateDates}
          />
        );
      case 'conditions':
        return (
          <ConditionsSection
            loan={loan}
            onRefresh={onRefresh}
          />
        );
      case 'documents':
        return (
          <DocumentsSection
            loan={loan}
            onRefresh={onRefresh}
          />
        );
      case 'notes':
        return (
          <NotesActivitySection
            loan={loan}
            updateLoanField={updateLoanField}
          />
        );
      case 'payroll':
        return (
          <div className="space-y-4">
            <PayrollSection loan={loan} onRefresh={onRefresh} />
            <CompensationSection loan={loan} />
          </div>
        );
      case 'post-close':
        return (
          <PostCloseSection
            loan={loan}
            onRefresh={onRefresh}
          />
        );
      default:
        return (
          <OverviewSection
            loan={loan}
          />
        );
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full -mx-6 -my-8">
      {/* Sidebar */}
      <LoanSidebar loanId={loan.id} loanStatus={loan.status} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Breadcrumb nav — always visible */}
        <div className="bg-surface-alt border-b border-gray-200 px-6 py-2 flex items-center gap-2 text-sm flex-shrink-0">
          <button
            onClick={() => router.push('/portal/mlo')}
            className="flex items-center gap-1.5 text-brand hover:text-brand-dark font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Pipeline
          </button>
          <svg className="w-3.5 h-3.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-ink-mid font-medium">
            {loan.borrower ? `${loan.borrower.last_name}, ${loan.borrower.first_name}` : 'Loan'}
          </span>
          {loan.loan_number && (
            <span className="text-ink-subtle text-xs">#{loan.loan_number}</span>
          )}
        </div>

        {/* Status header */}
        <StatusHeader
          loan={loan}
          onStatusChange={handleStatusChange}
          onPrequalLetter={() => { setShowPrequal(true); setPrequalEverOpened(true); }}
        />

        {/* Error banner */}
        {actionError && (
          <div className="bg-red-50 border-b border-red-200 px-6 py-2 flex items-center justify-between">
            <p className="text-sm text-red-700">{actionError}</p>
            <button
              onClick={() => setActionError('')}
              className="text-xs text-red-500 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Section content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-4xl">
            {renderSection()}
          </div>
        </div>
      </div>

      {/* Pre-Qual Letter Modal — stays mounted after first open so form data persists */}
      {prequelEverOpened && (
        <div className={showPrequal ? '' : 'hidden'}>
          <PrequalLetterModal
            loan={loan}
            onClose={() => setShowPrequal(false)}
          />
        </div>
      )}
    </div>
  );
}
