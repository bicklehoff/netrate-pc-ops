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
  // Text — normalize whitespace, punctuation, and case for comparison
  const normalize = (s) => String(s).toLowerCase().replace(/[,.\s]+/g, ' ').trim();
  return { cdDisplay, loanDisplay, match: normalize(cdVal) === normalize(loanVal) ? 'yes' : 'no' };
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
  const [relatedLoans, setRelatedLoans] = useState(loan?.relatedLoans || []);
  const [nicknameConfirmed, setNicknameConfirmed] = useState(false);
  const [unmatchedPersons, setUnmatchedPersons] = useState([]); // { firstName, lastName, role, email, phone, saveAsContact }

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

      if (data.relatedLoans?.length > 0) {
        setRelatedLoans(data.relatedLoans);
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
        body: JSON.stringify({
          action: 'approve',
          nicknameConfirmed,
          unmatchedPersons: unmatchedPersons.filter(p => p.role),
        }),
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
  const fullAddress = loan.propertyAddress
    ? `${loan.propertyAddress.street}, ${loan.propertyAddress.city}, ${loan.propertyAddress.state} ${loan.propertyAddress.zipCode}`
    : null;

  const comparisonRows = isExtracted ? [
    { label: 'Loan Amount', ...compareValues(extraction.data.loanAmount, loan.loanAmount, 'currency') },
    { label: 'Interest Rate', ...compareValues(extraction.data.interestRate, loan.interestRate ? Number(loan.interestRate) : null, 'rate') },
    { label: 'Monthly P&I', ...compareValues(extraction.data.monthlyPI, loan.monthlyPayment, 'currency') },
    { label: 'Loan Term', ...compareValues(extraction.data.loanTerm ? `${extraction.data.loanTerm} mo` : null, loan.loanTerm ? `${loan.loanTerm} mo` : null, 'text') },
    { label: 'Broker Compensation', ...compareValues(extraction.data.brokerCompensation, loan.brokerCompensation, 'currency') },
    { label: 'Total Closing Costs', ...compareValues(extraction.data.totalClosingCosts, loan.totalClosingCosts, 'currency') },
    { label: 'Cash to Close', ...compareValues(extraction.data.cashToClose, loan.cashToClose, 'currency') },
    { label: 'Lender Credits', ...compareValues(extraction.data.lenderCredits, loan.lenderCredits, 'currency') },
    { label: 'Lender', ...compareValues(extraction.data.lenderName, loan.lenderName, 'text') },
    { label: 'Loan Number', ...compareValues(extraction.data.loanNumber, loan.loanNumber, 'text') },
    { label: 'Borrower', ...(() => {
      // Handle both array (new) and string (old) format from extraction
      const cdNames = Array.isArray(extraction.data.borrowerNames)
        ? extraction.data.borrowerNames.map(n => `${n.firstName} ${n.lastName}`).join(', ')
        : extraction.data.borrowerNames;
      const onFile = loan.borrower ? `${loan.borrower.firstName} ${loan.borrower.lastName}` : null;
      return compareValues(cdNames, onFile, 'text');
    })() },
    { label: 'Property', ...compareValues(extraction.data.propertyAddress, fullAddress, 'text') },
    { label: 'Closing Date', ...compareValues(extraction.data.closingDate, loan.closingDate?.split('T')[0] || null, 'text') },
    { label: 'Funding Date', ...compareValues(extraction.data.disbursementDate, loan.fundingDate?.split('T')[0] || null, 'text') },
    { label: 'Loan Type', ...compareValues(extraction.data.loanType, loan.loanType, 'text') },
  ] : [];

  // Detect unmatched persons from CD — people on the CD but not on the loan
  const cdPersons = isExtracted && Array.isArray(extraction.data.borrowerNames)
    ? extraction.data.borrowerNames : [];
  const knownNames = new Set();
  if (loan.borrower) {
    const norm = (s) => (s || '').toLowerCase().trim();
    knownNames.add(`${norm(loan.borrower.firstName)}|${norm(loan.borrower.lastName)}`);
    // Also match legal name if set
    if (loan.borrower.legalFirstName) {
      knownNames.add(`${norm(loan.borrower.legalFirstName)}|${norm(loan.borrower.legalLastName || loan.borrower.lastName)}`);
    }
  }
  // TODO: also check existing loanBorrowers for co-borrowers already on file
  const detectedUnmatched = cdPersons.filter(p => {
    const key = `${(p.firstName || '').toLowerCase().trim()}|${(p.lastName || '').toLowerCase().trim()}`;
    return !knownNames.has(key);
  });

  // Initialize unmatched state on first detection
  if (detectedUnmatched.length > 0 && unmatchedPersons.length === 0 && isExtracted && !isApproved) {
    // Use setTimeout to avoid setState during render
    setTimeout(() => {
      setUnmatchedPersons(detectedUnmatched.map(p => ({
        firstName: p.firstName,
        lastName: p.lastName,
        role: '', // 'co_borrower' or 'nbs'
        email: '',
        phone: '',
        saveAsContact: true,
      })));
    }, 0);
  }

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

        {/* Related loans warning */}
        {relatedLoans.length > 0 && (
          <div className="mb-4 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">⚠️</span>
              <p className="text-sm font-semibold text-amber-800">
                {relatedLoans.length} other loan{relatedLoans.length > 1 ? 's' : ''} found for this borrower
              </p>
            </div>
            <div className="space-y-1.5 ml-7">
              {relatedLoans.map((rl) => (
                <div key={rl.id} className="flex items-center gap-2 text-xs text-amber-700">
                  <span className="font-mono">{rl.loanNumber || '—'}</span>
                  <span className="text-amber-400">|</span>
                  <span>{rl.lenderName || 'No lender'}</span>
                  <span className="text-amber-400">|</span>
                  <span className="capitalize">{rl.status}</span>
                  {rl.loanAmount && (
                    <>
                      <span className="text-amber-400">|</span>
                      <span>${Number(rl.loanAmount).toLocaleString()}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-amber-600 mt-2 ml-7">
              Review these files — they may need to be dispositioned or marked as quotes for MCR compliance.
            </p>
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
                  <div className="col-span-3 text-right text-blue-600">From CD</div>
                  <div className="col-span-3 text-right text-gray-400">On File</div>
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

            {/* Borrower name mismatch — nickname prompt */}
            {(() => {
              if (!isExtracted || !loan.borrower) return null;
              const cdNames = Array.isArray(extraction.data.borrowerNames)
                ? extraction.data.borrowerNames
                : null;
              if (!cdNames || cdNames.length === 0) return null;
              const onFileFirst = loan.borrower.firstName?.toLowerCase();
              const onFileLast = loan.borrower.lastName?.toLowerCase();
              const primaryCd = cdNames[0];
              const cdFirst = primaryCd.firstName?.toLowerCase();
              const cdLast = primaryCd.lastName?.toLowerCase();
              // Same last name but different first name = likely nickname
              if (cdLast === onFileLast && cdFirst !== onFileFirst) {
                return (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                    <p className="text-sm font-medium text-blue-800 mb-1">Name mismatch detected</p>
                    <p className="text-xs text-blue-700">
                      CD shows <span className="font-semibold">{primaryCd.firstName} {primaryCd.lastName}</span> but
                      loan has <span className="font-semibold">{loan.borrower.firstName} {loan.borrower.lastName}</span>.
                    </p>
                    <label className="mt-2 flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={nicknameConfirmed}
                        onChange={(e) => setNicknameConfirmed(e.target.checked)}
                        className="rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs text-blue-700">
                        Yes, <span className="font-semibold">{loan.borrower.firstName}</span> is a nickname
                        for <span className="font-semibold">{primaryCd.firstName}</span>
                      </span>
                    </label>
                  </div>
                );
              }
              return null;
            })()}

            {/* Unmatched persons from CD */}
            {unmatchedPersons.length > 0 && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">👤</span>
                  <p className="text-sm font-semibold text-purple-800">
                    {unmatchedPersons.length} additional person{unmatchedPersons.length > 1 ? 's' : ''} on CD
                  </p>
                </div>
                {unmatchedPersons.map((person, idx) => (
                  <div key={idx} className="bg-white rounded-lg border border-purple-100 px-4 py-3 space-y-2">
                    <p className="text-sm font-medium text-gray-900">
                      {person.firstName} {person.lastName}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const updated = [...unmatchedPersons];
                          updated[idx] = { ...person, role: 'co_borrower' };
                          setUnmatchedPersons(updated);
                        }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                          person.role === 'co_borrower'
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'text-purple-700 border-purple-300 hover:bg-purple-50'
                        }`}
                      >
                        Co-Borrower
                      </button>
                      <button
                        onClick={() => {
                          const updated = [...unmatchedPersons];
                          updated[idx] = { ...person, role: 'nbs' };
                          setUnmatchedPersons(updated);
                        }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                          person.role === 'nbs'
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'text-purple-700 border-purple-300 hover:bg-purple-50'
                        }`}
                      >
                        Non-Borrowing Spouse
                      </button>
                    </div>
                    {person.role && (
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={person.saveAsContact}
                            onChange={(e) => {
                              const updated = [...unmatchedPersons];
                              updated[idx] = { ...person, saveAsContact: e.target.checked };
                              setUnmatchedPersons(updated);
                            }}
                            className="rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                          />
                          <span className="text-xs text-purple-700">Save as contact</span>
                        </label>
                        {person.saveAsContact && (
                          <div className="flex gap-2">
                            <input
                              type="email"
                              placeholder="Email (optional)"
                              value={person.email}
                              onChange={(e) => {
                                const updated = [...unmatchedPersons];
                                updated[idx] = { ...person, email: e.target.value };
                                setUnmatchedPersons(updated);
                              }}
                              className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-purple-500 focus:border-purple-500"
                            />
                            <input
                              type="tel"
                              placeholder="Phone (optional)"
                              value={person.phone}
                              onChange={(e) => {
                                const updated = [...unmatchedPersons];
                                updated[idx] = { ...person, phone: e.target.value };
                                setUnmatchedPersons(updated);
                              }}
                              className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-purple-500 focus:border-purple-500"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {unmatchedPersons.some(p => !p.role) && (
                  <p className="text-xs text-purple-500">
                    Select a role for each person before approving.
                  </p>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleApprove}
                disabled={approving || disputing || unmatchedPersons.some(p => !p.role)}
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
