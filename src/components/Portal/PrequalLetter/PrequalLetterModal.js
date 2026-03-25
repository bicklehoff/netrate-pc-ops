// PrequalLetterModal — Modal form for generating pre-qualification letters.
// Pre-fills from loan data, allows MLO overrides, generates PDF + sends to Zoho Sign.

'use client';

import { useState, useEffect, useCallback } from 'react';
import { LOAN_TYPE_LABELS, LOAN_TERM_LABELS } from '@/lib/constants/loan-types';

// Format address JSON to string
function formatAddress(addr) {
  if (!addr) return '';
  if (typeof addr === 'string') return addr;
  const parts = [addr.street, addr.city, addr.state, addr.zip].filter(Boolean);
  return parts.join(', ');
}

// Build borrower name string from loan data
function buildBorrowerNames(loan) {
  const names = [];
  const b = loan.borrower;
  if (b?.firstName || b?.lastName) {
    names.push([b.firstName, b.lastName].filter(Boolean).join(' '));
  }
  if (loan.loanBorrowers?.length) {
    for (const lb of loan.loanBorrowers) {
      if (lb.firstName || lb.lastName) {
        names.push([lb.firstName, lb.lastName].filter(Boolean).join(' '));
      }
    }
  }
  return names.join(' & ');
}

// Compute LTV
function computeLTV(loanAmount, purchasePrice) {
  if (!loanAmount || !purchasePrice || purchasePrice <= 0) return '';
  return ((loanAmount / purchasePrice) * 100).toFixed(1);
}

// Default expiration: 90 days from today
function defaultExpiration() {
  const d = new Date();
  d.setDate(d.getDate() + 90);
  return d.toISOString().slice(0, 10);
}

export default function PrequalLetterModal({ loan, session, onClose }) {
  const [form, setForm] = useState({
    borrowerNames: '',
    propertyAddress: '',
    purchasePrice: '',
    loanAmount: '',
    ltv: '',
    loanType: '',
    loanTerm: '',
    interestRate: '',
    letterDate: new Date().toISOString().slice(0, 10),
    expirationDate: defaultExpiration(),
    referenceNumber: '',
    creditReviewed: true,
    incomeDocumented: true,
    assetsVerified: true,
    ausApproval: false,
    appraisalWaiver: false,
    mloName: '',
    mloNmls: '',
    mloPhone: '',
    mloEmail: '',
  });

  const [pdfBusy, setPdfBusy] = useState(false);
  const [signBusy, setSignBusy] = useState(false);
  const [error, setError] = useState(null);
  const [signSuccess, setSignSuccess] = useState(false);

  // Pre-fill from loan data on mount
  useEffect(() => {
    if (!loan) return;
    setForm((prev) => ({
      ...prev,
      borrowerNames: buildBorrowerNames(loan),
      propertyAddress: formatAddress(loan.propertyAddress),
      purchasePrice: loan.purchasePrice || '',
      loanAmount: loan.loanAmount || '',
      ltv: computeLTV(loan.loanAmount, loan.purchasePrice),
      loanType: loan.loanType || '',
      loanTerm: loan.loanTerm || 360,
      interestRate: loan.interestRate || '',
      referenceNumber: loan.loanNumber || loan.id?.slice(0, 8) || '',
      mloName: loan.mlo?.firstName
        ? `${loan.mlo.firstName} ${loan.mlo.lastName || ''}`.trim()
        : session?.user?.name || 'David Burson',
      mloNmls: loan.mlo?.nmls || '641790',
      mloPhone: '303-444-5251',
      mloEmail: loan.mlo?.email || session?.user?.email || 'david@netratemortgage.com',
    }));
  }, [loan, session]);

  const updateField = useCallback((field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // Auto-calc LTV when purchase price or loan amount changes
      if (field === 'loanAmount' || field === 'purchasePrice') {
        next.ltv = computeLTV(
          field === 'loanAmount' ? value : prev.loanAmount,
          field === 'purchasePrice' ? value : prev.purchasePrice
        );
      }
      return next;
    });
  }, []);

  // Build data object for PDF
  const buildPdfData = () => ({
    borrowerNames: form.borrowerNames,
    propertyAddress: form.propertyAddress,
    purchasePrice: Number(form.purchasePrice) || 0,
    loanAmount: Number(form.loanAmount) || 0,
    ltv: form.ltv,
    loanType: form.loanType,
    loanTerm: form.loanTerm,
    interestRate: form.interestRate,
    letterDate: form.letterDate,
    expirationDate: form.expirationDate,
    referenceNumber: form.referenceNumber,
    verifications: {
      creditReviewed: form.creditReviewed,
      incomeDocumented: form.incomeDocumented,
      assetsVerified: form.assetsVerified,
      ausApproval: form.ausApproval,
      appraisalWaiver: form.appraisalWaiver,
    },
    mloName: form.mloName,
    mloNmls: form.mloNmls,
    mloPhone: form.mloPhone,
    mloEmail: form.mloEmail,
  });

  // Generate and download PDF
  const handleDownload = async () => {
    setPdfBusy(true);
    setError(null);
    try {
      const [{ pdf }, { default: PrequalLetterPDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./PrequalLetterPDF'),
      ]);
      const blob = await pdf(<PrequalLetterPDF data={buildPdfData()} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = form.borrowerNames.replace(/[^a-zA-Z0-9]/g, '-') || 'Borrower';
      a.download = `NetRate-PreQual-${safeName}-${form.letterDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF generation failed:', err);
      setError('Failed to generate PDF. Please try again.');
    } finally {
      setPdfBusy(false);
    }
  };

  // Sign via Zoho Sign and send
  const handleSignAndSend = async () => {
    setSignBusy(true);
    setError(null);
    setSignSuccess(false);
    try {
      const [{ pdf }, { default: PrequalLetterPDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./PrequalLetterPDF'),
      ]);
      const blob = await pdf(<PrequalLetterPDF data={buildPdfData()} />).toBlob();

      // Upload to API for Zoho Sign
      const formData = new FormData();
      const safeName = form.borrowerNames.replace(/[^a-zA-Z0-9]/g, '-') || 'Borrower';
      formData.append('file', blob, `NetRate-PreQual-${safeName}.pdf`);
      formData.append('mloName', form.mloName);
      formData.append('mloEmail', form.mloEmail);
      formData.append('borrowerNames', form.borrowerNames);
      if (loan?.id) formData.append('loanId', loan.id);

      const res = await fetch('/api/portal/mlo/prequal-letter/sign', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to send for signature');
      }

      setSignSuccess(true);
    } catch (err) {
      console.error('Sign & Send failed:', err);
      setError(err.message || 'Failed to send for signature');
    } finally {
      setSignBusy(false);
    }
  };

  // Escape to close
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Pre-Qualification Letter
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-5">
          {/* Borrower Info */}
          <fieldset>
            <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Borrower Information
            </legend>
            <div className="grid grid-cols-1 gap-3">
              <Field
                label="Borrower Name(s)"
                value={form.borrowerNames}
                onChange={(v) => updateField('borrowerNames', v)}
                placeholder="John Smith & Jane Smith"
              />
              <Field
                label="Subject Property Address"
                value={form.propertyAddress}
                onChange={(v) => updateField('propertyAddress', v)}
                placeholder="123 Main St, Louisville, CO 80027"
              />
            </div>
          </fieldset>

          {/* Loan Terms */}
          <fieldset>
            <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Loan Terms
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Purchase Price"
                value={form.purchasePrice}
                onChange={(v) => updateField('purchasePrice', v)}
                type="number"
                prefix="$"
              />
              <Field
                label="Max Loan Amount"
                value={form.loanAmount}
                onChange={(v) => updateField('loanAmount', v)}
                type="number"
                prefix="$"
              />
              <Field
                label="LTV"
                value={form.ltv}
                readOnly
                suffix="%"
              />
              <SelectField
                label="Loan Type"
                value={form.loanType}
                onChange={(v) => updateField('loanType', v)}
                options={Object.entries(LOAN_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }))}
              />
              <SelectField
                label="Loan Term"
                value={form.loanTerm}
                onChange={(v) => updateField('loanTerm', v)}
                options={Object.entries(LOAN_TERM_LABELS).map(([k, v]) => ({ value: k, label: v }))}
              />
              <Field
                label="Interest Rate (optional)"
                value={form.interestRate}
                onChange={(v) => updateField('interestRate', v)}
                type="number"
                suffix="%"
                step="0.125"
              />
            </div>
          </fieldset>

          {/* Letter Details */}
          <fieldset>
            <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Letter Details
            </legend>
            <div className="grid grid-cols-3 gap-3">
              <Field
                label="Letter Date"
                value={form.letterDate}
                onChange={(v) => updateField('letterDate', v)}
                type="date"
              />
              <Field
                label="Expiration Date"
                value={form.expirationDate}
                onChange={(v) => updateField('expirationDate', v)}
                type="date"
              />
              <Field
                label="Reference #"
                value={form.referenceNumber}
                onChange={(v) => updateField('referenceNumber', v)}
              />
            </div>
          </fieldset>

          {/* Verification Checklist */}
          <fieldset>
            <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Verification Checklist
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'creditReviewed', label: 'Credit Reviewed' },
                { key: 'incomeDocumented', label: 'Income Documented' },
                { key: 'assetsVerified', label: 'Assets Verified' },
                { key: 'ausApproval', label: 'AUS Approval' },
                { key: 'appraisalWaiver', label: 'Appraisal Waiver' },
              ].map((item) => (
                <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form[item.key]}
                    onChange={(e) => updateField(item.key, e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand"
                  />
                  <span className="text-sm text-gray-700">{item.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* MLO Info */}
          <fieldset>
            <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Loan Officer
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Name"
                value={form.mloName}
                onChange={(v) => updateField('mloName', v)}
              />
              <Field
                label="NMLS #"
                value={form.mloNmls}
                onChange={(v) => updateField('mloNmls', v)}
              />
              <Field
                label="Phone"
                value={form.mloPhone}
                onChange={(v) => updateField('mloPhone', v)}
              />
              <Field
                label="Email"
                value={form.mloEmail}
                onChange={(v) => updateField('mloEmail', v)}
              />
            </div>
          </fieldset>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Success */}
          {signSuccess && (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
              Sent to Zoho Sign for e-signature. Check your email to sign the letter.
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={pdfBusy || !form.borrowerNames}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {pdfBusy ? 'Generating...' : 'Download PDF'}
          </button>
          <button
            onClick={handleSignAndSend}
            disabled={signBusy || !form.borrowerNames}
            className="px-4 py-2 text-sm font-medium text-white bg-brand rounded-lg hover:bg-brand-dark disabled:opacity-50"
          >
            {signBusy ? 'Sending...' : 'Sign & Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Field Components ----------

function Field({ label, value, onChange, type = 'text', prefix, suffix, readOnly, placeholder, step }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
            {prefix}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          readOnly={readOnly}
          placeholder={placeholder}
          step={step}
          className={`w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand focus:border-brand ${
            prefix ? 'pl-7' : ''
          } ${suffix ? 'pr-8' : ''} ${readOnly ? 'bg-gray-50 text-gray-500' : ''}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand focus:border-brand"
      >
        <option value="">Select...</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
