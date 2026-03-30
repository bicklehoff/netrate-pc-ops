// Payroll Section — CD Upload + Extraction Review + Approval + Send to Payroll
// Shows on funded loans only. Phases:
// 1. No CD: Upload prompt
// 2. Uploading/extracting: Spinner
// 3. Extraction failed: Error + retry
// 4. Extracted, not approved: Review table with approve/dispute
// 5. Approved, not sent: Send to Payroll button
// 6. Sent: Confirmation

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

function formatCurrency(val) {
  if (val == null) return '--';
  return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatRate(val) {
  if (val == null) return '--';
  return Number(val).toFixed(3) + '%';
}

// Compare extracted CD value to existing loan value
function compareValues(cdVal, loanVal, type = 'currency') {
  const fmt = type === 'rate' ? formatRate : type === 'text' ? (v) => v || '--' : formatCurrency;
  const cdDisplay = fmt(cdVal);
  const loanDisplay = fmt(loanVal);

  if (cdVal == null) return { cdDisplay, loanDisplay, match: 'none' };
  if (loanVal == null) return { cdDisplay, loanDisplay, match: 'new' };

  // For numbers, compare with tolerance
  if (type === 'currency') {
    return { cdDisplay, loanDisplay, match: Math.abs(Number(cdVal) - Number(loanVal)) < 1 ? 'yes' : 'no' };
  }
  if (type === 'rate') {
    return { cdDisplay, loanDisplay, match: Math.abs(Number(cdVal) - Number(loanVal)) < 0.001 ? 'yes' : 'no' };
  }
  // Text
  return { cdDisplay, loanDisplay, match: String(cdVal).toLowerCase() === String(loanVal).toLowerCase() ? 'yes' : 'no' };
}

function MatchBadge({ match }) {
  if (match === 'yes') return <span className="text-green-600 text-xs font-medium">Match</span>;
  if (match === 'new') return <span className="inline-block bg-amber-100 text-amber-700 text-xs font-medium px-1.5 py-0.5 rounded">New</span>;
  if (match === 'no') return <span className="inline-block bg-red-100 text-red-700 text-xs font-medium px-1.5 py-0.5 rounded">Mismatch</span>;
  return <span className="text-gray-400 text-xs">--</span>;
}

export default function PayrollSection({ loan, onRefresh }) {
  const fileInputRef = useRef(null);
  const retryInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  if (!loan || loan.status !== 'funded') return null;

  const hasCD = !!loan.cdWorkDriveFileId;
  const extraction = loan.cdExtractedData;
  const isExtracted = extraction?.status === 'success';
  const extractionFailed = extraction?.status === 'error';
  const isApproved = !!loan.cdApprovedAt;
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

  // ─── Approve ──────────────────────────────────────────────
  const handleApprove = async () => {
    setError('');
    setApproving(true);
    try {
      const res = await fetch(`/api/portal/mlo/loans/${loan.id}/payroll`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Approval failed');
      onRefresh();
    } catch (err) {
      setError(err.message || 'Approval failed');
    } finally {
      setApproving(false);
    }
  };

  // ─── Dispute ──────────────────────────────────────────────
  const handleDispute = async () => {
    setError('');
    setDisputing(true);
    try {
      const res = await fetch(`/api/portal/mlo/loans/${loan.id}/payroll`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'dispute' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Dispute failed');
      onRefresh();
    } catch (err) {
      setError(err.message || 'Dispute failed');
    } finally {
      setDisputing(false);
    }
  };

  // ─── Send to Payroll ──────────────────────────────────────
  const handleSend = async () => {
    if (!isApproved) return;
    setError('');
    setSending(true);
    try {
      const res = await fetch(`/api/portal/mlo/loans/${loan.id}/payroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send to payroll');
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

  // ─── Header subtitle ─────────────────────────────────────
  const subtitle = !hasCD
    ? 'Upload the final Closing Disclosure'
    : uploading
    ? 'Uploading and extracting CD data...'
    : extractionFailed
    ? 'CD extraction failed — retry or upload a different file'
    : isExtracted && !isApproved
    ? 'Review extracted CD data'
    : isApproved && !isSent
    ? 'CD verified — ready to send to payroll'
    : isSent
    ? `Sent to payroll on ${formatDate(loan.payrollSentAt)}`
    : 'Processing...';

  // ─── Build comparison rows for review phase ───────────────
  const comparisonRows = isExtracted ? [
    { label: 'Loan Amount', ...compareValues(extraction.data.loanAmount, loan.loanAmount, 'currency') },
    { label: 'Interest Rate', ...compareValues(extraction.data.interestRate, loan.interestRate ? Number(loan.interestRate) : null, 'rate') },
    { label: 'Monthly P&I', ...compareValues(extraction.data.monthlyPI, null, 'currency') },
    { label: 'Loan Term', ...compareValues(extraction.data.loanTerm ? `${extraction.data.loanTerm} mo` : null, loan.loanTerm ? `${loan.loanTerm} mo` : null, 'text') },
    { label: 'Broker Compensation', ...compareValues(extraction.data.brokerCompensation, null, 'currency') },
    { label: 'Total Closing Costs', ...compareValues(extraction.data.totalClosingCosts, null, 'currency') },
    { label: 'Cash to Close', ...compareValues(extraction.data.cashToClose, null, 'currency') },
    { label: 'Lender Credits', ...compareValues(extraction.data.lenderCredits, null, 'currency') },
    { label: 'Loan Number', ...compareValues(extraction.data.loanNumber, loan.loanNumber, 'text') },
    { label: 'Borrower', ...compareValues(extraction.data.borrowerNames, loan.borrower ? `${loan.borrower.firstName} ${loan.borrower.lastName}` : null, 'text') },
    { label: 'Property', ...compareValues(extraction.data.propertyAddress, loan.propertyAddress ? `${loan.propertyAddress.street}, ${loan.propertyAddress.city}` : null, 'text') },
    { label: 'Closing Date', ...compareValues(extraction.data.closingDate, null, 'text') },
    { label: 'Loan Type', ...compareValues(extraction.data.loanType, loan.loanType, 'text') },
  ] : [];

  return (
    <div className="bg-white rounded-xl border-2 border-green-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-green-50 px-6 py-4 border-b border-green-200">
        <div className="flex items-center gap-3">
          <span className="text-2xl">💰</span>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Payroll</h2>
            <p className="text-xs text-gray-500">{subtitle}</p>
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
        {!hasCD && !uploading && (
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
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileInput}
              />
              <div className="space-y-2">
                <div className="text-4xl">📋</div>
                <p className="text-sm font-medium text-gray-700">
                  Upload Final Closing Disclosure
                </p>
                <p className="text-xs text-gray-400">
                  Drop a PDF here, or click to browse
                </p>
              </div>
            </div>
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
              <p className="text-xs text-amber-800">
                <span className="font-semibold">Important:</span> This must be the{' '}
                <span className="font-semibold">final</span> Closing Disclosure — not an initial estimate or revised version.
              </p>
            </div>
          </div>
        )}

        {/* ── Phase 2: Uploading + Extracting ── */}
        {uploading && (
          <div className="py-8 text-center space-y-3">
            <div className="w-10 h-10 border-3 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-medium text-gray-700">Uploading & extracting CD data...</p>
            <p className="text-xs text-gray-400">This may take 10-15 seconds</p>
          </div>
        )}

        {/* ── Phase 3: Extraction failed ── */}
        {hasCD && extractionFailed && !uploading && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-4 text-center">
              <div className="text-3xl mb-2">⚠️</div>
              <p className="text-sm font-semibold text-red-800">CD Extraction Failed</p>
              <p className="text-xs text-red-600 mt-1">{extraction.error}</p>
            </div>

            <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-3">
              <span className="text-xl">📕</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{loan.cdFileName}</p>
              </div>
              <button
                onClick={handleDownloadCD}
                className="px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand/10 rounded-lg transition-colors"
              >
                Download
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => retryInputRef.current?.click()}
                disabled={uploading}
                className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Upload Different CD
              </button>
              <input
                ref={retryInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileInput}
              />
            </div>
          </div>
        )}

        {/* ── Phase 4: Review extracted data ── */}
        {hasCD && isExtracted && !isApproved && !isSent && !uploading && (
          <div className="space-y-4">
            {/* CD file info */}
            <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-3">
              <span className="text-xl">📕</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{loan.cdFileName}</p>
                <p className="text-xs text-green-600 font-medium">Data extracted — review below</p>
              </div>
              <button
                onClick={handleDownloadCD}
                className="px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand/10 rounded-lg transition-colors"
              >
                Download
              </button>
            </div>

            {/* Comparison table */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <div className="col-span-4">Field</div>
                  <div className="col-span-3 text-right">From CD</div>
                  <div className="col-span-3 text-right">On File</div>
                  <div className="col-span-2 text-center">Status</div>
                </div>
              </div>
              <div className="divide-y divide-gray-100">
                {comparisonRows.map((row) => (
                  <div key={row.label} className={`grid grid-cols-12 gap-2 px-4 py-2 text-xs items-center ${row.match === 'no' ? 'bg-red-50/50' : ''}`}>
                    <div className="col-span-4 font-medium text-gray-700">{row.label}</div>
                    <div className="col-span-3 text-right text-gray-900 font-mono">{row.cdDisplay}</div>
                    <div className="col-span-3 text-right text-gray-500 font-mono">{row.loanDisplay}</div>
                    <div className="col-span-2 text-center"><MatchBadge match={row.match} /></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleApprove}
                disabled={approving || disputing}
                className="flex-1 bg-green-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {approving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Approving...
                  </>
                ) : (
                  'Approve CD Data'
                )}
              </button>
              <button
                onClick={handleDispute}
                disabled={approving || disputing}
                className="px-5 py-3 rounded-xl text-sm font-medium border border-red-300 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {disputing ? 'Clearing...' : 'Dispute'}
              </button>
            </div>

            <p className="text-xs text-gray-400 text-center">
              Disputing will clear the CD — you{"'"}ll need to upload a corrected version.
            </p>
          </div>
        )}

        {/* ── Phase 5: Approved, ready to send ── */}
        {hasCD && isApproved && !isSent && !uploading && (
          <div className="space-y-4">
            {/* Approved badge */}
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center gap-3">
              <span className="text-xl">✅</span>
              <div>
                <p className="text-sm font-semibold text-green-800">CD Data Approved</p>
                <p className="text-xs text-green-600">{formatDate(loan.cdApprovedAt)}</p>
              </div>
            </div>

            {/* CD file info */}
            <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-3">
              <span className="text-xl">📕</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{loan.cdFileName}</p>
                <p className="text-xs text-green-600 font-medium">Verified Closing Disclosure</p>
              </div>
              <button
                onClick={handleDownloadCD}
                className="px-3 py-1.5 text-xs font-medium text-brand hover:bg-brand/10 rounded-lg transition-colors"
              >
                Download
              </button>
            </div>

            {/* Key extracted values summary */}
            {isExtracted && (
              <div className="bg-gray-50 rounded-lg px-4 py-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Verified CD Data
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  {extraction.data.loanAmount != null && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Loan Amount</span>
                      <span className="text-gray-800 font-medium">{formatCurrency(extraction.data.loanAmount)}</span>
                    </div>
                  )}
                  {extraction.data.interestRate != null && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Rate</span>
                      <span className="text-gray-800 font-medium">{formatRate(extraction.data.interestRate)}</span>
                    </div>
                  )}
                  {extraction.data.brokerCompensation != null && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Broker Comp</span>
                      <span className="text-gray-800 font-medium">{formatCurrency(extraction.data.brokerCompensation)}</span>
                    </div>
                  )}
                  {extraction.data.monthlyPI != null && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Monthly P&I</span>
                      <span className="text-gray-800 font-medium">{formatCurrency(extraction.data.monthlyPI)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

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
                'Send to Payroll'
              )}
            </button>

            {/* Re-upload option */}
            <div className="text-center">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 cursor-pointer hover:bg-gray-100 rounded-lg transition-colors">
                Upload new CD (resets approval)
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

        {/* ── Phase 6: Sent ── */}
        {isSent && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-4 text-center">
              <div className="text-3xl mb-2">✅</div>
              <p className="text-sm font-semibold text-green-800">Sent to Payroll</p>
              <p className="text-xs text-green-600 mt-1">{formatDate(loan.payrollSentAt)}</p>
            </div>

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
