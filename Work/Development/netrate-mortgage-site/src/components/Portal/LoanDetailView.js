// Loan Detail View — MLO view of a loan file
// Status transitions, borrower info, SSN reveal, document management, notes, timeline, XML export

'use client';

import { useState } from 'react';

const STATUS_LABELS = {
  draft: 'Draft',
  applied: 'Applied',
  processing: 'Processing',
  submitted_uw: 'Submitted to UW',
  cond_approved: 'Conditionally Approved',
  suspended: 'Suspended',
  ctc: 'Clear to Close',
  docs_out: 'Docs Out',
  funded: 'Funded',
  denied: 'Denied',
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
};

const TRANSITIONS = {
  draft: ['applied'],
  applied: ['processing', 'denied'],
  processing: ['submitted_uw', 'suspended', 'denied'],
  submitted_uw: ['cond_approved', 'suspended', 'denied'],
  cond_approved: ['ctc', 'suspended', 'denied'],
  suspended: ['processing', 'submitted_uw', 'denied'],
  ctc: ['docs_out'],
  docs_out: ['funded'],
  funded: [],
  denied: [],
};

const DOC_TYPES = [
  { value: 'pay_stub', label: 'Pay Stub' },
  { value: 'w2', label: 'W-2' },
  { value: 'bank_statement', label: 'Bank Statement' },
  { value: 'tax_return', label: 'Tax Return' },
  { value: 'id', label: 'Photo ID' },
  { value: 'other', label: 'Other' },
];

const DOC_STATUS_COLORS = {
  requested: 'bg-amber-100 text-amber-800',
  uploaded: 'bg-blue-100 text-blue-800',
  reviewed: 'bg-purple-100 text-purple-800',
  accepted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const DOC_STATUS_LABELS = {
  requested: 'Requested',
  uploaded: 'Uploaded',
  reviewed: 'Under Review',
  accepted: 'Accepted',
  rejected: 'Rejected',
};

const EVENT_ICONS = {
  status_change: '🔄',
  doc_requested: '📋',
  doc_uploaded: '📎',
  field_updated: '✏️',
  note_added: '💬',
  ssn_revealed: '🔓',
  xml_export: '📤',
};

function formatCurrency(val) {
  if (!val) return '—';
  return `$${Number(val).toLocaleString('en-US', { minimumFractionDigits: 0 })}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatAddress(addr) {
  if (!addr) return '—';
  const parts = [addr.street, addr.city, addr.state, addr.zip].filter(Boolean);
  return parts.join(', ') || '—';
}

export default function LoanDetailView({ loan, onRefresh }) {
  const [statusLoading, setStatusLoading] = useState(false);
  const [ssnRevealed, setSsnRevealed] = useState(null);
  const [ssnLoading, setSsnLoading] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);
  const [docForm, setDocForm] = useState({ open: false, docType: 'pay_stub', label: '', notes: '' });
  const [docLoading, setDocLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(null);
  const [actionError, setActionError] = useState('');

  if (!loan) return null;

  const nextStatuses = TRANSITIONS[loan.status] || [];

  // ─── Status Change ───
  const handleStatusChange = async (newStatus) => {
    setStatusLoading(true);
    setActionError('');
    try {
      const res = await fetch(`/api/portal/mlo/loans/${loan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        setActionError(data.error || 'Status change failed');
        return;
      }
      onRefresh();
    } catch {
      setActionError('Status change failed');
    } finally {
      setStatusLoading(false);
    }
  };

  // ─── SSN Reveal ───
  const handleSsnReveal = async () => {
    setSsnLoading(true);
    try {
      const res = await fetch(`/api/portal/mlo/loans/${loan.id}/ssn`, {
        method: 'POST',
      });
      if (!res.ok) {
        setActionError('SSN reveal failed');
        return;
      }
      const data = await res.json();
      setSsnRevealed(data.ssn);
      // Auto-hide after 30 seconds
      setTimeout(() => setSsnRevealed(null), 30000);
    } catch {
      setActionError('SSN reveal failed');
    } finally {
      setSsnLoading(false);
    }
  };

  // ─── Add Note ───
  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setNoteLoading(true);
    try {
      const res = await fetch(`/api/portal/mlo/loans/${loan.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteText.trim() }),
      });
      if (!res.ok) {
        setActionError('Failed to add note');
        return;
      }
      setNoteText('');
      onRefresh();
    } catch {
      setActionError('Failed to add note');
    } finally {
      setNoteLoading(false);
    }
  };

  // ─── Request Document ───
  const handleDocRequest = async () => {
    if (!docForm.label.trim()) return;
    setDocLoading(true);
    try {
      const res = await fetch(`/api/portal/mlo/loans/${loan.id}/docs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          docType: docForm.docType,
          label: docForm.label.trim(),
          notes: docForm.notes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        setActionError('Failed to request document');
        return;
      }
      setDocForm({ open: false, docType: 'pay_stub', label: '', notes: '' });
      onRefresh();
    } catch {
      setActionError('Failed to request document');
    } finally {
      setDocLoading(false);
    }
  };

  // ─── Review Document ───
  const handleDocReview = async (documentId, status) => {
    setReviewLoading(documentId);
    try {
      const res = await fetch(`/api/portal/mlo/loans/${loan.id}/docs`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, status }),
      });
      if (!res.ok) {
        setActionError('Failed to update document');
        return;
      }
      onRefresh();
    } catch {
      setActionError('Failed to update document');
    } finally {
      setReviewLoading(null);
    }
  };

  // ─── XML Export ───
  const handleXmlExport = () => {
    window.open(`/api/portal/mlo/loans/${loan.id}/xml`, '_blank');
  };

  return (
    <div className="space-y-6">
      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-700">{actionError}</p>
          <button onClick={() => setActionError('')} className="text-xs text-red-500 hover:underline mt-1">
            Dismiss
          </button>
        </div>
      )}

      {/* ─── Header ─── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {loan.borrower.firstName} {loan.borrower.lastName}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">{loan.borrower.email}</p>
            {loan.borrower.phone && (
              <p className="text-sm text-gray-500">{loan.borrower.phone}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[loan.status]}`}>
              {STATUS_LABELS[loan.status] || loan.status}
            </span>
            {loan.workDriveFolderId && (
              <a
                href={`https://workdrive.zoho.com/folder/${loan.workDriveFolderId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 rounded-lg hover:bg-teal-100 transition-colors border border-teal-200"
                title="Open loan folder in WorkDrive"
              >
                📁 Folder
              </a>
            )}
            <button
              onClick={handleXmlExport}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              title="Export MISMO XML"
            >
              📤 XML
            </button>
          </div>
        </div>

        {/* SSN */}
        <div className="flex items-center gap-3 mb-4 text-sm">
          <span className="text-gray-500">SSN:</span>
          {ssnRevealed ? (
            <span className="font-mono text-gray-900 bg-yellow-50 px-2 py-0.5 rounded">
              {ssnRevealed}
            </span>
          ) : (
            <>
              <span className="text-gray-700">···-··-{loan.borrower.ssnLastFour}</span>
              <button
                onClick={handleSsnReveal}
                disabled={ssnLoading}
                className="text-xs text-brand hover:underline disabled:opacity-50"
              >
                {ssnLoading ? 'Loading...' : '🔓 Reveal (audited)'}
              </button>
            </>
          )}
        </div>

        {/* Status Transitions */}
        {nextStatuses.length > 0 && (
          <div className="border-t border-gray-100 pt-4">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 block">
              Move to:
            </span>
            <div className="flex flex-wrap gap-2">
              {nextStatuses.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  disabled={statusLoading}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                    s === 'denied' || s === 'suspended'
                      ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                      : 'bg-brand/10 text-brand hover:bg-brand/20 border border-brand/20'
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── Loan Summary ─── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Loan Details</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-400 block">Purpose</span>
            <span className="text-gray-800 font-medium capitalize">{loan.purpose || '—'}</span>
          </div>
          <div>
            <span className="text-gray-400 block">Occupancy</span>
            <span className="text-gray-800 font-medium capitalize">{loan.occupancy || '—'}</span>
          </div>
          <div>
            <span className="text-gray-400 block">Property Type</span>
            <span className="text-gray-800 font-medium capitalize">
              {loan.propertyType?.replace('_', ' ') || '—'}
            </span>
          </div>
          <div>
            <span className="text-gray-400 block">Property Address</span>
            <span className="text-gray-800 font-medium">{formatAddress(loan.propertyAddress)}</span>
          </div>
          {loan.purpose === 'purchase' ? (
            <>
              <div>
                <span className="text-gray-400 block">Purchase Price</span>
                <span className="text-gray-800 font-medium">{formatCurrency(loan.purchasePrice)}</span>
              </div>
              <div>
                <span className="text-gray-400 block">Down Payment</span>
                <span className="text-gray-800 font-medium">{formatCurrency(loan.downPayment)}</span>
              </div>
            </>
          ) : (
            <>
              <div>
                <span className="text-gray-400 block">Estimated Value</span>
                <span className="text-gray-800 font-medium">{formatCurrency(loan.estimatedValue)}</span>
              </div>
              <div>
                <span className="text-gray-400 block">Current Balance</span>
                <span className="text-gray-800 font-medium">{formatCurrency(loan.currentBalance)}</span>
              </div>
            </>
          )}
          <div>
            <span className="text-gray-400 block">Employment</span>
            <span className="text-gray-800 font-medium capitalize">
              {loan.employmentStatus?.replace('_', ' ') || '—'}
            </span>
          </div>
          {loan.employerName && (
            <div>
              <span className="text-gray-400 block">Employer</span>
              <span className="text-gray-800 font-medium">{loan.employerName}</span>
            </div>
          )}
          <div>
            <span className="text-gray-400 block">Monthly Income</span>
            <span className="text-gray-800 font-medium">{formatCurrency(loan.monthlyBaseIncome)}</span>
          </div>
          <div>
            <span className="text-gray-400 block">Housing Expense</span>
            <span className="text-gray-800 font-medium">{formatCurrency(loan.presentHousingExpense)}</span>
          </div>
          <div>
            <span className="text-gray-400 block">Marital Status</span>
            <span className="text-gray-800 font-medium capitalize">{loan.maritalStatus || '—'}</span>
          </div>
          <div>
            <span className="text-gray-400 block">Submitted</span>
            <span className="text-gray-800 font-medium">{formatDate(loan.submittedAt)}</span>
          </div>
        </div>
      </div>

      {/* ─── Documents ─── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Documents</h2>
          <button
            onClick={() => setDocForm({ ...docForm, open: !docForm.open })}
            className="text-sm text-brand hover:underline"
          >
            + Request Document
          </button>
        </div>

        {/* Document Request Form */}
        {docForm.open && (
          <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                <select
                  value={docForm.docType}
                  onChange={(e) => setDocForm({ ...docForm, docType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                >
                  {DOC_TYPES.map((dt) => (
                    <option key={dt.value} value={dt.value}>{dt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
                <input
                  type="text"
                  value={docForm.label}
                  onChange={(e) => setDocForm({ ...docForm, label: e.target.value })}
                  placeholder="e.g. Most Recent Pay Stub"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                />
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optional)</label>
              <input
                type="text"
                value={docForm.notes}
                onChange={(e) => setDocForm({ ...docForm, notes: e.target.value })}
                placeholder="Instructions for the borrower"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleDocRequest}
                disabled={docLoading || !docForm.label.trim()}
                className="px-4 py-2 bg-brand text-white text-sm rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-50"
              >
                {docLoading ? 'Requesting...' : 'Send Request'}
              </button>
              <button
                onClick={() => setDocForm({ open: false, docType: 'pay_stub', label: '', notes: '' })}
                className="px-4 py-2 text-gray-600 text-sm hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Document List */}
        {(!loan.documents || loan.documents.length === 0) ? (
          <p className="text-gray-400 text-sm">No documents yet.</p>
        ) : (
          <div className="space-y-2">
            {loan.documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
              >
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-800">{doc.label}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${DOC_STATUS_COLORS[doc.status]}`}>
                      {DOC_STATUS_LABELS[doc.status] || doc.status}
                    </span>
                    {doc.fileName && (
                      <span className="text-xs text-gray-400">{doc.fileName}</span>
                    )}
                    {doc.requestedBy && (
                      <span className="text-xs text-gray-400">
                        by {doc.requestedBy.firstName} {doc.requestedBy.lastName}
                      </span>
                    )}
                  </div>
                  {doc.notes && (
                    <p className="text-xs text-gray-500 mt-0.5">{doc.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {doc.fileUrl && (
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brand hover:underline"
                    >
                      View
                    </a>
                  )}
                  {doc.status === 'uploaded' && (
                    <>
                      <button
                        onClick={() => handleDocReview(doc.id, 'accepted')}
                        disabled={reviewLoading === doc.id}
                        className="px-2.5 py-1 text-xs font-medium bg-green-50 text-green-700 rounded-lg hover:bg-green-100 border border-green-200 disabled:opacity-50"
                      >
                        ✓ Accept
                      </button>
                      <button
                        onClick={() => handleDocReview(doc.id, 'rejected')}
                        disabled={reviewLoading === doc.id}
                        className="px-2.5 py-1 text-xs font-medium bg-red-50 text-red-700 rounded-lg hover:bg-red-100 border border-red-200 disabled:opacity-50"
                      >
                        ✗ Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Notes ─── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Note</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note to this loan file..."
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && noteText.trim()) handleAddNote();
            }}
          />
          <button
            onClick={handleAddNote}
            disabled={noteLoading || !noteText.trim()}
            className="px-4 py-2.5 bg-brand text-white text-sm rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-50"
          >
            {noteLoading ? 'Adding...' : 'Add'}
          </button>
        </div>
      </div>

      {/* ─── Activity Timeline ─── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Activity Timeline</h2>
        {(!loan.events || loan.events.length === 0) ? (
          <p className="text-gray-400 text-sm">No activity yet.</p>
        ) : (
          <div className="space-y-0">
            {loan.events.map((event, index) => (
              <div key={event.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full bg-brand mt-2 shrink-0" />
                  {index < loan.events.length - 1 && (
                    <div className="w-0.5 bg-gray-200 flex-1 min-h-[24px]" />
                  )}
                </div>
                <div className="pb-4">
                  <p className="text-sm text-gray-800">
                    <span className="mr-1">{EVENT_ICONS[event.eventType] || '•'}</span>
                    {formatEventMessage(event)}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDate(event.createdAt)}
                    {event.actorType && (
                      <span> · {event.actorType}</span>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatEventMessage(event) {
  switch (event.eventType) {
    case 'status_change':
      return `Status: ${STATUS_LABELS[event.oldValue] || event.oldValue} → ${STATUS_LABELS[event.newValue] || event.newValue}`;
    case 'doc_requested':
      return `Document requested: ${event.newValue || 'Unknown'}`;
    case 'doc_uploaded':
      return `Document uploaded: ${event.newValue || 'Unknown'}`;
    case 'note_added':
      return `Note: ${event.newValue || ''}`;
    case 'ssn_revealed':
      return 'SSN was revealed (audited)';
    case 'xml_export':
      return 'MISMO XML exported';
    default:
      return event.eventType.replace(/_/g, ' ');
  }
}
