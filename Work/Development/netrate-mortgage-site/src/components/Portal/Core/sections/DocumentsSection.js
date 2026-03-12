// DocumentsSection — Migrated from LoanDetailView
// Documents list + request form + WorkDrive panel + Payroll section

'use client';

import { useState } from 'react';
import SectionCard from '../SectionCard';
import WorkDrivePanel from '../../WorkDrivePanel';
import PayrollSection from '../../PayrollSection';

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

export default function DocumentsSection({ loan, onRefresh }) {
  const [docForm, setDocForm] = useState({ open: false, docType: 'pay_stub', label: '', notes: '' });
  const [docLoading, setDocLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(null);
  const [actionError, setActionError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [processReport, setProcessReport] = useState(null);

  // Request document
  const handleDocRequest = async () => {
    if (!docForm.label.trim()) return;
    setDocLoading(true);
    setActionError('');
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

  // Review document
  const handleDocReview = async (documentId, status) => {
    setReviewLoading(documentId);
    setActionError('');
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

  // Process Docs via CoreBot
  const handleProcessDocs = async () => {
    setProcessing(true);
    setProcessReport(null);
    setActionError('');
    try {
      const res = await fetch('/api/corebot/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loanId: loan.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.error || 'Processing failed');
        return;
      }
      setProcessReport(data.report);
      onRefresh();
    } catch {
      setActionError('CoreBot processing failed');
    } finally {
      setProcessing(false);
    }
  };

  const documents = loan.documents || [];

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

      {/* ─── Documents ─── */}
      <SectionCard
        title="Documents"
        icon="📄"
        badge={documents.length > 0 ? `${documents.length}` : null}
        defaultOpen={true}
        actions={
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDocForm({ ...docForm, open: !docForm.open });
            }}
            className="text-xs text-brand hover:underline"
          >
            + Request
          </button>
        }
      >
        {/* Request form */}
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

        {/* Document list */}
        {documents.length === 0 ? (
          <p className="text-gray-400 text-sm">No documents yet.</p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
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
      </SectionCard>

      {/* ─── CoreBot Process Docs ─── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">CoreBot</h3>
            <p className="text-xs text-gray-500">AI document processing — identify, rename, and organize</p>
          </div>
          <button
            onClick={handleProcessDocs}
            disabled={processing}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              processing
                ? 'bg-gray-100 text-gray-400 cursor-wait'
                : 'bg-brand text-white hover:bg-brand-dark'
            }`}
          >
            {processing ? 'Processing...' : 'Process Docs'}
          </button>
        </div>

        {/* Processing report */}
        {processReport && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="flex items-center gap-4 mb-3">
              <div className="text-center">
                <div className="text-lg font-bold text-gray-900">{processReport.processed}</div>
                <div className="text-xs text-gray-500">Processed</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-green-600">{processReport.renamed}</div>
                <div className="text-xs text-gray-500">Renamed</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold text-blue-600">{processReport.conditionsUpdated}</div>
                <div className="text-xs text-gray-500">Conditions</div>
              </div>
              {processReport.errors?.length > 0 && (
                <div className="text-center">
                  <div className="text-lg font-bold text-amber-600">{processReport.errors.length}</div>
                  <div className="text-xs text-gray-500">Errors</div>
                </div>
              )}
            </div>

            {/* Document results */}
            {processReport.documents?.length > 0 && (
              <div className="space-y-1.5">
                {processReport.documents.map((doc, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
                      doc.action === 'renamed' ? 'bg-green-500' :
                      doc.action === 'suggest' ? 'bg-blue-500' :
                      doc.action === 'flagged' ? 'bg-amber-500' : 'bg-red-500'
                    }`} />
                    <span className="text-gray-500 truncate flex-1">{doc.originalName}</span>
                    {doc.newFileName && (
                      <>
                        <span className="text-gray-400">→</span>
                        <span className="font-medium text-gray-800 truncate">{doc.newFileName}</span>
                      </>
                    )}
                    <span className="text-gray-400 flex-shrink-0">
                      {Math.round((doc.confidence || 0) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Checklist status */}
            {processReport.checklistStatus && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-700">
                    Submission Checklist: {processReport.checklistStatus.received}/{processReport.checklistStatus.total} required items
                  </span>
                </div>
                {processReport.checklistStatus.missing?.length > 0 && (
                  <div className="text-xs text-amber-700">
                    Missing: {processReport.checklistStatus.missing.join(', ')}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => setProcessReport(null)}
              className="mt-3 text-xs text-gray-400 hover:text-gray-600"
            >
              Dismiss report
            </button>
          </div>
        )}
      </div>

      {/* ─── WorkDrive ─── */}
      <WorkDrivePanel loanId={loan.id} />

      {/* ─── Payroll (funded loans only) ─── */}
      <PayrollSection loan={loan} onRefresh={onRefresh} />
    </div>
  );
}
