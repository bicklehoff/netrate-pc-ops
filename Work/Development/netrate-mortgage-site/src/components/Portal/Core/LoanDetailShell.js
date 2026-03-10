// LoanDetailShell — Orchestrator for the new Core loan detail page
// Renders: Sidebar + StatusHeader + active section based on ?section= param
//
// Props:
//   loan         — Full loan object from API (with includes)
//   onRefresh    — () => void — refetch loan data
//   session      — NextAuth session

'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useCallback } from 'react';
import LoanSidebar from './LoanSidebar';
import StatusHeader from './StatusHeader';
import OverviewSection from './sections/OverviewSection';
import LoanInfoSection from './sections/LoanInfoSection';
import BorrowerSection from './sections/BorrowerSection';
import ProcessingSection from './sections/ProcessingSection';
import DocumentsSection from './sections/DocumentsSection';
import NotesActivitySection from './sections/NotesActivitySection';

export default function LoanDetailShell({ loan, onRefresh }) {
  const searchParams = useSearchParams();
  const activeSection = searchParams.get('section') || 'overview';
  const [actionError, setActionError] = useState('');

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
          />
        );
      case 'loan-info':
        return (
          <LoanInfoSection
            loan={loan}
            updateLoanField={updateLoanField}
          />
        );
      case 'borrower':
        return (
          <BorrowerSection
            loan={loan}
            updateLoanField={updateLoanField}
          />
        );
      case 'processing':
        return (
          <ProcessingSection
            loan={loan}
            updateDates={updateDates}
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
      <LoanSidebar loanId={loan.id} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Status header */}
        <StatusHeader
          loan={loan}
          onStatusChange={handleStatusChange}
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
    </div>
  );
}
