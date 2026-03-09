// Payroll Section — CD Upload + Send to Payroll
// Shows on funded loans only. Three phases:
// 1. No CD: Upload prompt (prominent, with clear note about final CD)
// 2. CD uploaded: File info + "Send to Payroll" button
// 3. Sent: Confirmation with timestamp

'use client';

import { useState, useRef } from 'react';

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function PayrollSection({ loan, onRefresh }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  if (!loan || loan.status !== 'funded') return null;

  const hasCD = !!loan.cdWorkDriveFileId;
  const isSent = !!loan.payrollSentAt;

  // ─── Upload CD ───────────────────────────────────────────
  const handleUpload = async (file) => {
    if (!file) return;
    setError('');

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Closing Disclosure must be a PDF file.');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setError('File too large (max 25 MB).');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/portal/mlo/loans/${loan.id}/payroll`, {
        method: 'PUT',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      onRefresh();
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleFileInput = (e) => {
    handleUpload(e.target.files?.[0]);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files[0]);
  };

  // ─── Send to Payroll ──────────────────────────────────────
  const handleSend = async () => {
    if (!hasCD) return;
    setError('');
    setSending(true);

    try {
      const res = await fetch(`/api/portal/mlo/loans/${loan.id}/payroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send to payroll');
      }

      onRefresh();
    } catch (err) {
      setError(err.message || 'Failed to send to payroll');
    } finally {
      setSending(false);
    }
  };

  // ─── Download CD ──────────────────────────────────────────
  const handleDownloadCD = () => {
    if (!loan.cdWorkDriveFileId) return;
    window.open(`/api/portal/mlo/loans/${loan.id}/files?download=${loan.cdWorkDriveFileId}`, '_blank');
  };

  return (
    <div className="bg-white rounded-xl border-2 border-green-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-green-50 px-6 py-4 border-b border-green-200">
        <div className="flex items-center gap-3">
          <span className="text-2xl">💰</span>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Payroll</h2>
            <p className="text-xs text-gray-500">
              {!hasCD && 'Upload the final Closing Disclosure to send to payroll'}
              {hasCD && !isSent && 'CD uploaded — ready to send to payroll'}
              {isSent && `Sent to payroll on ${formatDate(loan.payrollSentAt)}`}
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 py-5">
        {/* Error */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={() => setError('')} className="text-xs text-red-500 hover:underline ml-3">
              Dismiss
            </button>
          </div>
        )}

        {/* ── Phase 1: Upload CD ── */}
        {!hasCD && (
          <div>
            <div
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                dragOver
                  ? 'border-green-400 bg-green-50'
                  : 'border-gray-300 hover:border-green-400 hover:bg-green-50/50'
              } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileInput}
              />
              {uploading ? (
                <div className="space-y-2">
                  <div className="w-8 h-8 border-3 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-sm text-gray-500">Uploading CD...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-4xl">📋</div>
                  <p className="text-sm font-medium text-gray-700">
                    Upload Final Closing Disclosure
                  </p>
                  <p className="text-xs text-gray-400">
                    Drop a PDF here, or click to browse
                  </p>
                </div>
              )}
            </div>
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
              <p className="text-xs text-amber-800">
                <span className="font-semibold">Important:</span> This must be the{' '}
                <span className="font-semibold">final</span> Closing Disclosure — not an initial estimate or revised version.
                This document will be sent to payroll for commission processing.
              </p>
            </div>
          </div>
        )}

        {/* ── Phase 2: CD uploaded, ready to send ── */}
        {hasCD && !isSent && (
          <div className="space-y-4">
            {/* CD file info */}
            <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-3">
              <span className="text-xl">📕</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{loan.cdFileName}</p>
                <p className="text-xs text-green-600 font-medium">Final Closing Disclosure</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadCD}
                  className="px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand/10 rounded-lg transition-colors"
                >
                  Download
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Replace
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </div>
            </div>

            {/* Loan summary (what gets sent) */}
            <div className="bg-gray-50 rounded-lg px-4 py-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Loan data sent with CD
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Borrower</span>
                  <span className="text-gray-800 font-medium">
                    {loan.borrower?.firstName} {loan.borrower?.lastName}
                  </span>
                </div>
                {loan.loanNumber && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Loan #</span>
                    <span className="text-gray-800 font-medium">{loan.loanNumber}</span>
                  </div>
                )}
                {loan.lenderName && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Lender</span>
                    <span className="text-gray-800 font-medium">{loan.lenderName}</span>
                  </div>
                )}
                {loan.loanAmount && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Amount</span>
                    <span className="text-gray-800 font-medium">
                      ${Number(loan.loanAmount).toLocaleString()}
                    </span>
                  </div>
                )}
                {loan.interestRate && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Rate</span>
                    <span className="text-gray-800 font-medium">{Number(loan.interestRate)}%</span>
                  </div>
                )}
                {loan.mlo && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">LO</span>
                    <span className="text-gray-800 font-medium">
                      {loan.mlo.firstName} {loan.mlo.lastName}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={sending}
              className="w-full bg-green-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {sending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <span>📤</span>
                  Send to Payroll
                </>
              )}
            </button>
          </div>
        )}

        {/* ── Phase 3: Sent ── */}
        {isSent && (
          <div className="space-y-4">
            {/* Confirmation */}
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-4 text-center">
              <div className="text-3xl mb-2">✅</div>
              <p className="text-sm font-semibold text-green-800">Sent to Payroll</p>
              <p className="text-xs text-green-600 mt-1">{formatDate(loan.payrollSentAt)}</p>
            </div>

            {/* CD file info */}
            <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-3">
              <span className="text-xl">📕</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{loan.cdFileName}</p>
                <p className="text-xs text-green-600 font-medium">Final Closing Disclosure</p>
              </div>
              <button
                onClick={handleDownloadCD}
                className="px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand/10 rounded-lg transition-colors"
              >
                Download
              </button>
            </div>

            {/* Re-send option */}
            <p className="text-xs text-gray-400 text-center">
              Need to re-send? Upload a new CD to reset and send again.
            </p>
            <div className="text-center">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 cursor-pointer hover:bg-gray-100 rounded-lg transition-colors">
                Upload new CD
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleFileInput}
                />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
