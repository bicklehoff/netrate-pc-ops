// MISMO XML Import Modal
// Two-phase flow: Upload → Preview → Confirm Import
// Phase 1: User drops/selects XML file → POST to preview endpoint → shows parsed data
// Phase 2: User confirms → PUT to commit endpoint → loan created → redirect to detail

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'applied', label: 'Applied' },
  { value: 'processing', label: 'Processing' },
  { value: 'submitted_uw', label: 'Submitted to UW' },
  { value: 'cond_approved', label: 'Cond. Approved' },
  { value: 'ctc', label: 'Clear to Close' },
  { value: 'docs_out', label: 'Docs Out' },
  { value: 'funded', label: 'Funded' },
];

export default function XmlImportModal({ open, onClose }) {
  const router = useRouter();
  const fileInputRef = useRef(null);

  // Flow state
  const [phase, setPhase] = useState('upload'); // 'upload' | 'preview' | 'importing' | 'done'
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // File
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  // Preview data (from POST)
  const [preview, setPreview] = useState(null);

  // Import options
  const [status, setStatus] = useState('processing');
  const [mloId, setMloId] = useState('');
  const [mloList, setMloList] = useState([]);

  // Import result
  const [result, setResult] = useState(null);

  // Fetch MLO list when modal opens
  useEffect(() => {
    if (!open) return;
    fetch('/api/portal/mlo/list')
      .then((res) => res.json())
      .then((data) => {
        setMloList(data.mlos || []);
        // Default to first MLO if available
        if (data.mlos?.length > 0 && !mloId) {
          setMloId(data.mlos[0].id);
        }
      })
      .catch(() => {});
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = useCallback(() => {
    setPhase('upload');
    setError('');
    setLoading(false);
    setFile(null);
    setDragOver(false);
    setPreview(null);
    setStatus('processing');
    setMloId(mloList[0]?.id || '');
    setResult(null);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  // ─── File Selection ──────────────────────────────────────

  const handleFile = useCallback(async (selectedFile) => {
    setError('');

    if (!selectedFile) return;
    if (!selectedFile.name.toLowerCase().endsWith('.xml')) {
      setError('Please select a .xml file');
      return;
    }
    if (selectedFile.size > 25 * 1024 * 1024) {
      setError('File too large (max 25 MB)');
      return;
    }

    setFile(selectedFile);
    setLoading(true);

    try {
      // Preview: parse without saving
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch('/api/portal/mlo/loans/import', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to parse XML');
      }

      setPreview(data);
      setPhase('preview');
    } catch (err) {
      setError(err.message || 'Failed to parse XML file');
      setFile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    handleFile(droppedFile);
  }, [handleFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  // ─── Import Commit ───────────────────────────────────────

  const handleImport = async () => {
    if (!file) return;

    setPhase('importing');
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('status', status);
      if (mloId) formData.append('mloId', mloId);

      const res = await fetch('/api/portal/mlo/loans/import', {
        method: 'PUT',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Import failed');
      }

      setResult(data);
      setPhase('done');
    } catch (err) {
      setError(err.message || 'Import failed');
      setPhase('preview'); // Back to preview so they can retry
    }
  };

  const handleViewLoan = () => {
    if (result?.loanId) {
      router.push(`/portal/mlo/loans/${result.loanId}`);
    }
    handleClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Import MISMO XML</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {phase === 'upload' && 'Upload a Fannie Mae MISMO 3.4 XML file'}
              {phase === 'preview' && 'Review extracted data before importing'}
              {phase === 'importing' && 'Creating loan record...'}
              {phase === 'done' && 'Import complete'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Phase 1: Upload */}
          {phase === 'upload' && (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                dragOver
                  ? 'border-brand bg-brand/5'
                  : 'border-gray-300 hover:border-gray-400'
              } ${loading ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xml"
                className="hidden"
                onChange={(e) => handleFile(e.target.files[0])}
              />
              {loading ? (
                <div className="space-y-3">
                  <div className="w-10 h-10 border-3 border-brand border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-sm text-gray-500">Parsing XML...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-4xl">📄</div>
                  <p className="text-sm font-medium text-gray-700">
                    Drop a MISMO XML file here, or click to browse
                  </p>
                  <p className="text-xs text-gray-400">
                    Supports Fannie Mae MISMO 3.4 format (.xml, max 25 MB)
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Phase 2: Preview */}
          {phase === 'preview' && preview && (
            <div className="space-y-5">
              {/* File info */}
              <div className="flex items-center gap-3 bg-gray-50 rounded-lg px-4 py-3">
                <span className="text-xl">📄</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{file?.name}</p>
                  <p className="text-xs text-gray-500">
                    {(file?.size / 1024).toFixed(1)} KB · {preview.stats.borrowerCount} borrower{preview.stats.borrowerCount !== 1 ? 's' : ''} found
                  </p>
                </div>
                <button
                  onClick={reset}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Change file
                </button>
              </div>

              {/* Loan Summary */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Loan Details</h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                  <Field label="Loan #" value={preview.loan.loanNumber} />
                  <Field label="Lender" value={preview.loan.lenderName} />
                  <Field label="Purpose" value={preview.loan.purpose} />
                  <Field label="Loan Type" value={preview.loan.loanType} />
                  <Field label="Amount" value={preview.loan.loanAmount ? `$${Number(preview.loan.loanAmount).toLocaleString()}` : null} />
                  <Field label="Rate" value={preview.loan.interestRate ? `${preview.loan.interestRate}%` : null} />
                  <Field label="Term" value={preview.loan.loanTerm ? `${preview.loan.loanTerm} months` : null} />
                  <Field label="Occupancy" value={preview.loan.occupancy} />
                  <Field label="Property Type" value={preview.loan.propertyType} />
                  <Field label="Purchase Price" value={preview.loan.purchasePrice ? `$${Number(preview.loan.purchasePrice).toLocaleString()}` : null} />
                </div>
              </div>

              {/* Property Address */}
              {preview.property?.address && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Subject Property</h3>
                  <p className="text-sm text-gray-700">
                    {[
                      preview.property.address.street,
                      preview.property.address.city,
                      preview.property.address.state,
                      preview.property.address.zip,
                    ].filter(Boolean).join(', ')}
                  </p>
                </div>
              )}

              {/* Borrowers */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Borrowers</h3>
                <div className="space-y-2">
                  {preview.borrowers.map((b, i) => (
                    <div key={i} className="bg-gray-50 rounded-lg px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {b.firstName} {b.lastName}
                            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                              {b.borrowerType === 'primary' ? 'Primary' : 'Co-Borrower'}
                            </span>
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {[b.email, b.phone, b.ssn].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                      </div>
                      {(b.employerName || b.monthlyBaseIncome) && (
                        <p className="text-xs text-gray-500 mt-1">
                          {[
                            b.employerName,
                            b.monthlyBaseIncome ? `$${Number(b.monthlyBaseIncome).toLocaleString()}/mo` : null,
                          ].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Import Options */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Import Options</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Initial Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Assign to LO</label>
                    <select
                      value={mloId}
                      onChange={(e) => setMloId(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none"
                    >
                      <option value="">Unassigned</option>
                      {mloList.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={handleClose}
                  className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  className="bg-brand text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-dark transition-colors"
                >
                  Import Loan
                </button>
              </div>
            </div>
          )}

          {/* Phase 3: Importing */}
          {phase === 'importing' && (
            <div className="py-12 text-center space-y-3">
              <div className="w-10 h-10 border-3 border-brand border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-gray-500">Creating loan record and WorkDrive folder...</p>
            </div>
          )}

          {/* Phase 4: Done */}
          {phase === 'done' && result && (
            <div className="py-8 text-center space-y-4">
              <div className="text-5xl">✅</div>
              <div>
                <p className="text-lg font-semibold text-gray-900">Loan Imported</p>
                <p className="text-sm text-gray-500 mt-1">
                  {result.borrowerName}
                  {result.loanNumber ? ` · #${result.loanNumber}` : ''}
                </p>
              </div>
              <div className="flex justify-center gap-3 pt-2">
                <button
                  onClick={() => { reset(); }}
                  className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Import Another
                </button>
                <button
                  onClick={handleViewLoan}
                  className="bg-brand text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-brand-dark transition-colors"
                >
                  View Loan &rarr;
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Field display helper ─────────────────────────────────

function Field({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={`font-medium ${value ? 'text-gray-900' : 'text-gray-300'}`}>
        {value || '—'}
      </span>
    </div>
  );
}
