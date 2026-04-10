// StatusHeader — Compact top bar for loan detail
// Shows: borrower name, status badge + dropdown, ball-in-court, XML export, WorkDrive link

'use client';

import { useState } from 'react';

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

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-700',
  applied: 'bg-blue-100 text-blue-800',
  processing: 'bg-yellow-100 text-yellow-800',
  submitted_uw: 'bg-purple-100 text-purple-800',
  cond_approved: 'bg-orange-100 text-orange-800',
  suspended: 'bg-red-50 text-red-700',
  ctc: 'bg-green-100 text-green-800',
  docs_out: 'bg-green-100 text-green-800',
  funded: 'bg-green-200 text-green-900',
  denied: 'bg-red-100 text-red-800',
  archived: 'bg-gray-200 text-gray-500',
};

const ALL_STATUSES = [
  'draft', 'applied', 'processing', 'submitted_uw',
  'cond_approved', 'ctc', 'docs_out', 'funded',
  'suspended', 'denied', 'archived',
];

const BIC_LABELS = {
  borrower: { label: 'Borrower', color: 'text-blue-600 bg-blue-50' },
  mlo: { label: 'MLO', color: 'text-teal-600 bg-teal-50' },
  lender: { label: 'Lender', color: 'text-purple-600 bg-purple-50' },
  none: { label: '—', color: 'text-gray-400 bg-gray-50' },
};

export default function StatusHeader({ loan, onStatusChange, onPrequalLetter }) {
  const [statusDropdown, setStatusDropdown] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  if (!loan) return null;

  const borrowerName = loan.borrower
    ? `${loan.borrower.first_name} ${loan.borrower.last_name}`
    : 'Unknown Borrower';

  const bic = BIC_LABELS[loan.ball_in_court] || BIC_LABELS.none;

  const handleStatusChange = async (newStatus) => {
    if (newStatus === loan.status) {
      setStatusDropdown(false);
      return;
    }
    setStatusLoading(true);
    try {
      await onStatusChange(newStatus);
      setStatusDropdown(false);
    } catch {
      // Error handling done by parent
    } finally {
      setStatusLoading(false);
    }
  };

  const handleXmlExport = () => {
    window.open(`/api/portal/mlo/loans/${loan.id}/xml`, '_blank');
  };

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
      {/* Left: Borrower name + metadata */}
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900 leading-tight">{borrowerName}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            {loan.loan_number && (
              <span className="text-xs text-gray-400">#{loan.loan_number}</span>
            )}
            {loan.lender_name && (
              <span className="text-xs text-gray-400">· {loan.lender_name}</span>
            )}
            {loan.mlo && (
              <span className="text-xs text-gray-400">
                · LO: {loan.mlo.first_name} {loan.mlo.last_name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right: Status + BIC + Actions */}
      <div className="flex items-center gap-3">
        {/* Ball-in-court */}
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${bic.color}`}>
          🏀 {bic.label}
        </span>

        {/* Status dropdown */}
        <div className="relative">
          <button
            onClick={() => setStatusDropdown(!statusDropdown)}
            disabled={statusLoading}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              STATUS_COLORS[loan.status] || 'bg-gray-100 text-gray-700'
            } ${statusLoading ? 'opacity-50' : 'hover:opacity-80 cursor-pointer'}`}
          >
            {STATUS_LABELS[loan.status] || loan.status}
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {statusDropdown && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setStatusDropdown(false)} />
              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 max-h-64 overflow-y-auto">
                {ALL_STATUSES.filter((s) => s !== loan.status).map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50 flex items-center gap-2"
                  >
                    <span className={`inline-block w-2 h-2 rounded-full ${
                      STATUS_COLORS[s]?.split(' ')[0] || 'bg-gray-200'
                    }`} />
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* WorkDrive link */}
        {loan.workDriveFolderId && (
          <a
            href={`https://workdrive.zoho.com/folder/${loan.workDriveFolderId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-teal-700 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors border border-teal-200"
            title="Open loan folder in WorkDrive"
          >
            📁 Folder
          </a>
        )}

        {/* Pre-Qual Letter */}
        <button
          onClick={onPrequalLetter}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-brand bg-brand/10 rounded-lg hover:bg-brand/20 transition-colors border border-brand/20"
          title="Generate Pre-Qualification Letter"
        >
          📄 Pre-Qual
        </button>

        {/* XML export */}
        <button
          onClick={handleXmlExport}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          title="Export MISMO XML"
        >
          📤 XML
        </button>
      </div>
    </div>
  );
}
