// PrequalLetterModal — Modal form for generating pre-qualification letters.
// Pre-fills from loan data, allows MLO overrides, generates PDF + sends to Zoho Sign.

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  if (b?.first_name || b?.last_name) {
    names.push([b.first_name, b.last_name].filter(Boolean).join(' '));
  }
  if (loan.loanBorrowers?.length) {
    for (const lb of loan.loanBorrowers) {
      if (lb.first_name || lb.last_name) {
        names.push([lb.first_name, lb.last_name].filter(Boolean).join(' '));
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
    property_address: '',
    purchase_price: '',
    down_payment: '',
    loan_amount: '',
    ltv: '',
    loan_type: '',
    loan_term: '',
    interest_rate: '',
    letterDate: new Date().toISOString().slice(0, 10),
    expirationDate: defaultExpiration(),
    reference_number: '',
    creditReviewed: true,
    incomeDocumented: true,
    assetsVerified: true,
    ausApproval: false,
    appraisal_waiver: false,
    mlo_name: '',
    mloNmls: '',
    mloPhone: '',
    mloEmail: '',
    mloPhotoUrl: '',
  });

  const [pdfBusy, setPdfBusy] = useState(false);
  const [signBusy, setSignBusy] = useState(false);
  const [saveFolderBusy, setSaveFolderBusy] = useState(false);
  const [error, setError] = useState(null);
  const [signSuccess, setSignSuccess] = useState(false);
  const [saveFolderSuccess, setSaveFolderSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const initialized = useRef(false);
  const saveTimer = useRef(null);

  // Pre-fill: load saved data first, fall back to loan fields
  useEffect(() => {
    if (!loan || initialized.current) return;
    initialized.current = true;

    const saved = loan.prequalLetterData;
    if (saved && typeof saved === 'object') {
      // Restore saved form state
      setForm((prev) => ({ ...prev, ...saved }));
    } else {
      // First time — pre-fill from loan data
      setForm((prev) => ({
        ...prev,
        borrowerNames: buildBorrowerNames(loan),
        property_address: formatAddress(loan.property_address),
        purchase_price: loan.purchase_price || '',
        down_payment: loan.down_payment || '',
        loan_amount: loan.loan_amount || '',
        ltv: computeLTV(loan.loan_amount, loan.purchase_price),
        loan_type: loan.loan_type || '',
        loan_term: loan.loan_term || 30,
        interest_rate: loan.interest_rate || '',
        reference_number: loan.loan_number || loan.id?.slice(0, 8) || '',
        mlo_name: loan.mlo?.first_name
          ? `${loan.mlo.first_name} ${loan.mlo.last_name || ''}`.trim()
          : session?.user?.name || 'David Burson',
        mloNmls: loan.mlo?.nmls || '641790',
        mloPhone: '303-444-5251',
        mloEmail: loan.mlo?.email || session?.user?.email || 'david@netratemortgage.com',
        // Staff headshot. Falls back to David's public asset so the letter
        // always has a face next to the signature. Per-MLO photos can be
        // wired in later via staff.photo_url.
        mloPhotoUrl: loan.mlo?.photo_url || '/david-burson.jpg',
      }));
    }
  }, [loan, session]);

  // Auto-save form to DB (debounced 2s after last change)
  useEffect(() => {
    if (!loan?.id || !initialized.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaving(true);
      try {
        await fetch(`/api/portal/mlo/loans/${loan.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prequalLetterData: form }),
        });
      } finally {
        setSaving(false);
      }
    }, 2000);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [form, loan?.id]);

  const updateField = useCallback((field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      const pp = Number(field === 'purchase_price' ? value : prev.purchase_price) || 0;
      const la = Number(field === 'loan_amount' ? value : prev.loan_amount) || 0;
      const dp = Number(field === 'down_payment' ? value : prev.down_payment) || 0;

      // Interlinked: change one, derive the others
      if (field === 'purchase_price' && pp > 0) {
        if (la > 0) {
          next.down_payment = pp - la;
          next.ltv = computeLTV(la, pp);
        } else if (dp > 0) {
          next.loan_amount = pp - dp;
          next.ltv = computeLTV(pp - dp, pp);
        }
      } else if (field === 'loan_amount' && la > 0) {
        if (pp > 0) {
          next.down_payment = pp - la;
          next.ltv = computeLTV(la, pp);
        }
      } else if (field === 'down_payment' && dp >= 0) {
        if (pp > 0) {
          next.loan_amount = pp - dp;
          next.ltv = computeLTV(pp - dp, pp);
        }
      }

      return next;
    });
  }, []);

  // Build data object for PDF
  const buildPdfData = () => ({
    borrowerNames: form.borrowerNames,
    property_address: form.property_address,
    purchase_price: Number(form.purchase_price) || 0,
    loan_amount: Number(form.loan_amount) || 0,
    ltv: form.ltv,
    loan_type: form.loan_type,
    loan_term: form.loan_term,
    interest_rate: form.interest_rate,
    letterDate: form.letterDate,
    expirationDate: form.expirationDate,
    reference_number: form.reference_number,
    verifications: {
      creditReviewed: form.creditReviewed,
      incomeDocumented: form.incomeDocumented,
      assetsVerified: form.assetsVerified,
      ausApproval: form.ausApproval,
      appraisal_waiver: form.appraisal_waiver,
    },
    mlo_name: form.mlo_name,
    mloNmls: form.mloNmls,
    mloPhone: form.mloPhone,
    mloEmail: form.mloEmail,
  });

  // Generate PDF blob (shared)
  const generatePdfBlob = async () => {
    const [{ pdf }, { default: PrequalLetterPDF }] = await Promise.all([
      import('@react-pdf/renderer'),
      import('./PrequalLetterPDF'),
    ]);
    return pdf(<PrequalLetterPDF data={buildPdfData()} />).toBlob();
  };

  const pdfFileName = () => {
    const safeName = form.borrowerNames.replace(/[^a-zA-Z0-9]/g, '-') || 'Borrower';
    return `NetRate-PreQual-${safeName}-${form.letterDate}.pdf`;
  };

  // Generate and download PDF
  const handleDownload = async () => {
    setPdfBusy(true);
    setError(null);
    try {
      const blob = await generatePdfBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pdfFileName();
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

  // Save PDF to loan's WorkDrive folder
  const handleSaveToFolder = async () => {
    setSaveFolderBusy(true);
    setError(null);
    setSaveFolderSuccess(false);
    try {
      const blob = await generatePdfBlob();
      const formData = new FormData();
      formData.append('file', blob, pdfFileName());
      formData.append('folder', 'SUBMITTED');
      formData.append('docType', 'prequal_letter');

      const res = await fetch(`/api/portal/mlo/loans/${loan.id}/files`, {
        method: 'PUT',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save to folder');
      }

      setSaveFolderSuccess(true);
    } catch (err) {
      console.error('Save to folder failed:', err);
      setError(err.message || 'Failed to save to folder. Does this loan have a WorkDrive folder?');
    } finally {
      setSaveFolderBusy(false);
    }
  };

  // Sign via Zoho Sign — opens signing page in new tab
  const handleSignAndSend = async () => {
    setSignBusy(true);
    setError(null);
    setSignSuccess(false);
    try {
      const blob = await generatePdfBlob();

      // Upload to API for Zoho Sign
      const formData = new FormData();
      formData.append('file', blob, pdfFileName());
      formData.append('mlo_name', form.mlo_name);
      formData.append('mloEmail', form.mloEmail);
      formData.append('borrowerNames', form.borrowerNames);
      if (loan?.id) formData.append('loan_id', loan.id);

      const res = await fetch('/api/portal/mlo/prequal-letter/sign', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to send for signature');
      }

      const result = await res.json();

      // Open signing page directly if available, otherwise fall back to email
      if (result.signUrl) {
        window.open(result.signUrl, '_blank');
      }

      setSignSuccess(true);
    } catch (err) {
      console.error('Sign & Send failed:', err);
      setError(err.message || 'Failed to send for signature');
    } finally {
      setSignBusy(false);
    }
  };


  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
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
                value={form.property_address}
                onChange={(v) => updateField('property_address', v)}
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
                value={form.purchase_price}
                onChange={(v) => updateField('purchase_price', v)}
                type="number"
                prefix="$"
              />
              <Field
                label="Down Payment"
                value={form.down_payment}
                onChange={(v) => updateField('down_payment', v)}
                type="number"
                prefix="$"
              />
              <Field
                label="Max Loan Amount"
                value={form.loan_amount}
                onChange={(v) => updateField('loan_amount', v)}
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
                value={form.loan_type}
                onChange={(v) => updateField('loan_type', v)}
                options={Object.entries(LOAN_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }))}
              />
              <SelectField
                label="Loan Term"
                value={form.loan_term}
                onChange={(v) => updateField('loan_term', v)}
                options={Object.entries(LOAN_TERM_LABELS).map(([k, v]) => ({ value: k, label: v }))}
              />
              <Field
                label="Interest Rate (optional)"
                value={form.interest_rate}
                onChange={(v) => updateField('interest_rate', v)}
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
                value={form.reference_number}
                onChange={(v) => updateField('reference_number', v)}
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
                { key: 'appraisal_waiver', label: 'Appraisal Waiver' },
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
                value={form.mlo_name}
                onChange={(v) => updateField('mlo_name', v)}
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
              Signing request created. Check the new tab to sign, or check your email.
            </div>
          )}
          {saveFolderSuccess && (
            <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
              Pre-qual letter saved to loan folder (Submitted).
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <span className="text-xs text-gray-400">
            {saving ? 'Saving...' : 'Auto-saved'}
          </span>
          <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            Close
          </button>
          <button
            onClick={handleDownload}
            disabled={pdfBusy || !form.borrowerNames}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {pdfBusy ? 'Generating...' : 'Download PDF'}
          </button>
          {loan?.workDriveFolderId && (
            <button
              onClick={handleSaveToFolder}
              disabled={saveFolderBusy || !form.borrowerNames}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {saveFolderBusy ? 'Saving...' : '📁 Save to Folder'}
            </button>
          )}
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
