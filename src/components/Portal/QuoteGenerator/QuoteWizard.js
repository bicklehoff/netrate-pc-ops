'use client';

import { useState, useCallback } from 'react';
import QuoteScenarioForm from './QuoteScenarioForm';
import QuoteRateResults from './QuoteRateResults';
import EligibilityPanel from './EligibilityPanel';
import QuoteFeeEditor from './QuoteFeeEditor';

const STEPS = [
  { key: 'scenario', label: 'Scenario' },
  { key: 'rates', label: 'Rate Selection' },
  { key: 'fees', label: 'Fees & Preview' },
];

// Default closing date: 4 business days before the last business day of the month
function defaultClosingDate() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (let offset = 0; offset <= 1; offset++) {
    const y = now.getFullYear();
    const m = now.getMonth() + offset;
    // Last calendar day of target month
    const lastDay = new Date(y, m + 1, 0);
    // Walk backward to last business day
    while (lastDay.getDay() === 0 || lastDay.getDay() === 6) lastDay.setDate(lastDay.getDate() - 1);
    // Walk back 4 business days
    const closing = new Date(lastDay);
    let count = 0;
    while (count < 4) {
      closing.setDate(closing.getDate() - 1);
      if (closing.getDay() !== 0 && closing.getDay() !== 6) count++;
    }
    if (closing >= today) {
      return `${closing.getFullYear()}-${String(closing.getMonth() + 1).padStart(2, '0')}-${String(closing.getDate()).padStart(2, '0')}`;
    }
  }
  return `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}-15`;
}

// Add N business days (skips Sat/Sun) to a date string
function addBusinessDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Derive default funding date from closing date, state, and purpose.
 *   CO, TX purchase → same day as closing
 *   CA, OR purchase → closing + 3 business days
 *   All refinances  → closing + 3 business days (rescission period)
 */
function defaultFundingDate(closingStr, state, purpose) {
  if (!closingStr) return '';
  const isRefi = purpose === 'refinance' || purpose === 'cashout';
  const needsDelay = isRefi || state === 'CA' || state === 'OR';
  return needsDelay ? addBusinessDays(closingStr, 3) : closingStr;
}

function firstPaymentFromClosing(closingStr) {
  if (!closingStr) return '';
  const [y, m] = closingStr.split('-').map(Number); // m is 1-indexed
  const fp = new Date(y, m + 1, 1); // 1st of 2nd month after closing
  return `${fp.getFullYear()}-${String(fp.getMonth() + 1).padStart(2, '0')}-01`;
}

export default function QuoteWizard({ prefill }) {
  const [step, setStep] = useState(0);

  const initClosing = prefill?.closing_date || defaultClosingDate();
  const initState   = prefill?.state    || 'CO';
  const initPurpose = prefill?.purpose  || 'purchase';
  const [scenario, setScenario] = useState({
    borrower_name: prefill?.borrower_name || '',
    borrower_email: prefill?.borrower_email || '',
    borrower_phone: prefill?.borrower_phone || '',
    contact_id: prefill?.contact_id || null,
    leadId: prefill?.leadId || null,
    loan_id: prefill?.loan_id || null,
    purpose: initPurpose,
    loan_type: prefill?.loan_type || 'conventional',
    property_value: prefill?.property_value || '',
    loan_amount: prefill?.loan_amount || '',
    downPaymentPct: prefill?.downPaymentPct || 25,
    fico: prefill?.fico || 780,
    state: initState,
    county: prefill?.county || '',
    zipCode: prefill?.zipCode || '',
    term: prefill?.term || 30,
    lockDays: prefill?.lockDays || 30,
    productType: prefill?.productType || 'fixed',
    ltv: prefill?.ltv || 75,
    // Date defaults
    closing_date: initClosing,
    first_payment_date: prefill?.first_payment_date || firstPaymentFromClosing(initClosing),
    funding_date: prefill?.funding_date || defaultFundingDate(initClosing, initState, initPurpose),
    // Escrow
    escrowsWaived: prefill?.escrowsWaived || false,
    borrowerPaid: prefill?.borrowerPaid || false,
    // Refi fields
    current_rate: prefill?.current_rate || '',
    current_balance: prefill?.current_balance || '',
    currentPayment: prefill?.currentPayment || '',
    currentLender: prefill?.currentLender || '',
  });
  const [loading, setLoading] = useState(false);
  const [pricingResult, setPricingResult] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [fees, setFees] = useState(null);
  const [selectedRates, setSelectedRates] = useState([]);
  const [quoteId, setQuoteId] = useState(null);
  const [error, setError] = useState(null);

  const handlePrice = useCallback(async (computedScenario) => {
    // Merge computed values (loanAmount, ltv from form calc) into scenario
    const payload = { ...scenario, ...computedScenario };
    setScenario(payload);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/portal/mlo/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || 'Pricing failed');

      setPricingResult(data.pricing);
      setEligibility(data.eligibility);
      setFees(data.fees);
      setQuoteId(data.quote?.id);

      // Don't auto-select — let MLO choose rates
      setSelectedRates([]);

      setStep(1);
      window.scrollTo(0, 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [scenario]);

  const handleReprice = useCallback(async () => {
    if (!quoteId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/mlo/quotes/${quoteId}/price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lockDays: scenario.lockDays }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Re-price failed');

      setPricingResult(data.pricing);
      setEligibility(data.eligibility);
      setFees(data.fees);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [quoteId, scenario.lockDays]);

  const handleSaveDraft = useCallback(async () => {
    if (!quoteId) return;
    setLoading(true);
    try {
      await fetch(`/api/portal/mlo/quotes/${quoteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenarios: selectedRates,
          feeBreakdown: fees,
        }),
      });
    } finally {
      setLoading(false);
    }
  }, [quoteId, selectedRates, fees]);

  const [sendResult, setSendResult] = useState(null);

  const handleSendToBorrower = useCallback(async () => {
    if (!quoteId) return;
    if (!scenario.borrower_email) {
      setError('Add borrower email before sending');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(scenario.borrower_email)) {
      setError('Enter a valid email address');
      return;
    }
    if (selectedRates.length === 0) {
      setError('Select at least one rate before sending');
      return;
    }

    // Save latest selections first
    await handleSaveDraft();

    setLoading(true);
    setError(null);
    setSendResult(null);
    try {
      const res = await fetch(`/api/portal/mlo/quotes/${quoteId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || 'Send failed');

      setSendResult({
        success: true,
        quoteLink: data.quoteLink,
        pdfUrl: data.pdfUrl,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [quoteId, scenario.borrower_email, handleSaveDraft]);

  const handlePreviewPDF = useCallback(async () => {
    if (selectedRates.length === 0) return;
    try {
      const [{ pdf }, { default: QuotePDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./QuotePDF'),
      ]);

      const blob = await pdf(
        QuotePDF({
          quote: {
            borrower_name: scenario.borrower_name || 'Borrower',
            purpose: scenario.purpose,
            loan_amount: scenario.loan_amount,
            property_value: scenario.property_value,
            ltv: scenario.ltv,
            fico: scenario.fico,
            loan_type: scenario.loan_type,
            state: scenario.state,
            county: scenario.county,
            term: scenario.term,
            current_balance: scenario.current_balance,
          },
          scenarios: selectedRates,
          fees,
          closing_date: scenario.closing_date || null,
          funding_date: scenario.funding_date || null,
          first_payment_date: scenario.first_payment_date || null,
        })
      ).toBlob();

      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      setError('PDF preview failed: ' + err.message);
    }
  }, [selectedRates, scenario, fees]);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            onClick={() => { if (i <= step) { setStep(i); window.scrollTo(0, 0); } }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              i === step
                ? 'bg-cyan-600 text-white'
                : i < step
                  ? 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100 cursor-pointer'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
            disabled={i > step}
          >
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">
              {i < step ? '\u2713' : i + 1}
            </span>
            {s.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {sendResult?.success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="text-green-800 font-medium text-sm">Quote sent to {scenario.borrower_email}</div>
          <div className="text-green-600 text-xs mt-1">
            PDF attached + portal link included. Borrower can view at the link in their email.
          </div>
          {sendResult.quoteLink && (
            <div className="mt-2 text-xs">
              <span className="text-gray-500">Quote link: </span>
              <a href={sendResult.quoteLink} target="_blank" rel="noopener noreferrer" className="text-cyan-600 hover:underline break-all">
                {sendResult.quoteLink}
              </a>
            </div>
          )}
        </div>
      )}

      {/* Step 1: Scenario */}
      {step === 0 && (
        <QuoteScenarioForm
          scenario={scenario}
          onChange={setScenario}
          onSubmit={handlePrice}
          loading={loading}
        />
      )}

      {/* Step 2: Rate Selection */}
      {step === 1 && (
        <div className="space-y-4">
          {eligibility && <EligibilityPanel eligibility={eligibility} />}
          <QuoteRateResults
            pricing={pricingResult}
            selectedRates={selectedRates}
            onSelectRates={setSelectedRates}
            onReprice={handleReprice}
            loading={loading}
            onNext={() => { setStep(2); window.scrollTo(0, 0); }}
            borrowerPaid={scenario.borrowerPaid}
            escrowsWaived={scenario.escrowsWaived}
            onEscrowsWaivedChange={(v) => setScenario(prev => ({ ...prev, escrowsWaived: v }))}
            scenario={scenario}
          />
        </div>
      )}

      {/* Step 3: Fees & Preview */}
      {step === 2 && (
        <QuoteFeeEditor
          fees={fees}
          onFeesChange={setFees}
          selectedRates={selectedRates}
          scenario={scenario}
          quoteId={quoteId}
          onSaveDraft={handleSaveDraft}
          onSendToBorrower={handleSendToBorrower}
          onPreviewPDF={handlePreviewPDF}
          loading={loading}
          escrowsWaived={scenario.escrowsWaived}
        />
      )}
    </div>
  );
}
