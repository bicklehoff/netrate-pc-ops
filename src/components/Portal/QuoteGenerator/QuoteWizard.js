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

export default function QuoteWizard({ prefill }) {
  const [step, setStep] = useState(0);
  const [scenario, setScenario] = useState({
    borrowerName: prefill?.borrowerName || '',
    borrowerEmail: prefill?.borrowerEmail || '',
    borrowerPhone: prefill?.borrowerPhone || '',
    contactId: prefill?.contactId || null,
    leadId: prefill?.leadId || null,
    loanId: prefill?.loanId || null,
    purpose: prefill?.purpose || 'purchase',
    loanType: prefill?.loanType || 'conventional',
    propertyValue: prefill?.propertyValue || '',
    loanAmount: prefill?.loanAmount || '',
    downPaymentPct: prefill?.downPaymentPct || 25,
    fico: prefill?.fico || 780,
    state: prefill?.state || 'CO',
    county: prefill?.county || '',
    term: prefill?.term || 30,
    lockDays: prefill?.lockDays || 30,
    productType: prefill?.productType || 'fixed',
    ltv: prefill?.ltv || 75,
    // Refi fields
    currentRate: prefill?.currentRate || '',
    currentBalance: prefill?.currentBalance || '',
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

      // Pre-select the auto-picked scenarios
      if (data.quote?.scenarios) {
        setSelectedRates(data.quote.scenarios);
      }

      setStep(1);
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

  return (
    <div className="max-w-6xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {STEPS.map((s, i) => (
          <button
            key={s.key}
            onClick={() => i <= step ? setStep(i) : null}
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
            onNext={() => setStep(2)}
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
          loading={loading}
        />
      )}
    </div>
  );
}
