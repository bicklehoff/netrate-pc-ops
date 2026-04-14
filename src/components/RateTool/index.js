'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ScenarioForm from './ScenarioForm';
import RateResults from './RateResults';
import RateEducation from './RateEducation';
import LeadCapture from './LeadCapture';
import SaveScenarioModal from './SaveScenarioModal';
import { LO_CONFIG } from '@/lib/rates/config';
import { DEFAULT_SCENARIO } from '@/lib/rates/defaults';
import { useApiPricing } from './useApiPricing';
import { trackRateToolInteraction, startEngagementTimer } from '@/lib/analytics';
import { getThirdPartyCosts } from '@/lib/rates/closing-costs';

export default function RateTool({ defaultState, prefill, brpToken }) {
  const initialState = prefill?.state || defaultState || 'CO';

  // 30-second engagement timer
  useEffect(() => {
    const cleanup = startEngagementTimer();
    return cleanup;
  }, []);

  // Debounced rate_tool_interaction event
  const interactionTimer = useRef(null);
  const handleScenarioChange = useCallback((newScenario) => {
    setScenario(newScenario);
    if (interactionTimer.current) clearTimeout(interactionTimer.current);
    interactionTimer.current = setTimeout(() => {
      trackRateToolInteraction(newScenario);
    }, 1500);
  }, []);

  const [scenario, setScenario] = useState({
    purpose: prefill?.purpose || DEFAULT_SCENARIO.loanPurpose,
    loanType: prefill?.loanType || 'conventional',
    propertyType: prefill?.propertyType || DEFAULT_SCENARIO.propertyType,
    propertyValue: prefill?.propertyValue || DEFAULT_SCENARIO.propertyValue,
    downPaymentPct: prefill?.downPaymentPct || DEFAULT_SCENARIO.downPaymentPct,
    currentPayoff: prefill?.currentPayoff || DEFAULT_SCENARIO.currentPayoff,
    newLoanAmount: prefill?.currentPayoff || DEFAULT_SCENARIO.currentPayoff,
    currentRate: prefill?.currentRate || DEFAULT_SCENARIO.currentRate,
    fico: prefill?.fico || DEFAULT_SCENARIO.fico,
    term: prefill?.term || 30,
    productType: 'fixed',
    vaFundingFeeExempt: false,
    vaSubsequentUse: false,
    loanAmount: prefill?.loanAmount || 0,
    ltv: 0,
    state: initialState,
    county: prefill?.county || (initialState === 'CO' ? 'Denver' : initialState === 'CA' ? 'Los Angeles' : initialState === 'TX' ? 'Dallas' : initialState === 'OR' ? 'Multnomah' : ''),
    thirdPartyCosts: getThirdPartyCosts(initialState),
  });

  const { results: apiResults, loading: apiLoading, fetchRates, effectiveDate: apiDate } = useApiPricing(scenario);

  const [showSaveModal, setShowSaveModal] = useState(false);

  return (
    <div>
      {/* Rate Tool Header */}
      <div className="bg-brand text-white px-5 py-2 rounded-t-xl flex justify-between items-center flex-wrap gap-2">
        <p className="text-cyan-100 text-sm">{LO_CONFIG.name} | NMLS {LO_CONFIG.nmls} | {LO_CONFIG.phone}</p>
        <p className="text-sm text-cyan-100">Rates effective {apiDate || 'today'}</p>
      </div>

      {/* Layout shifts: centered form → two-column after rates load */}
      {!apiResults?.length && !apiLoading ? (
        /* ── Pre-rates: centered single-column form ── */
        <div className="max-w-3xl mx-auto p-4 sm:p-6">
          <ScenarioForm scenario={scenario} onChange={handleScenarioChange} onSubmit={fetchRates} loading={apiLoading} />
        </div>
      ) : (
        /* ── Post-rates: two-column (form left, results right) ── */
        <div className="flex flex-col lg:flex-row gap-6 p-4 sm:p-6">
          <div className="w-full lg:w-[400px] lg:shrink-0">
            <div className="lg:sticky lg:top-4">
              <ScenarioForm scenario={scenario} onChange={handleScenarioChange} onSubmit={fetchRates} loading={apiLoading} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <RateResults
              scenario={scenario}
              apiResults={apiResults}
              loading={apiLoading}
              onSaveScenario={() => setShowSaveModal(true)}
              brpToken={brpToken}
            />
            <RateEducation />
            <LeadCapture scenario={scenario} />
          </div>
        </div>
      )}

      {/* Save Scenario Modal */}
      {showSaveModal && (
        <SaveScenarioModal
          scenario={scenario}
          onClose={() => setShowSaveModal(false)}
          brpToken={brpToken}
          allRates={apiResults}
        />
      )}

      {/* Disclaimer */}
      <div className="text-xs text-ink-subtle px-5 py-4 border-t border-gray-100 leading-relaxed">
        <p>Rates shown are approximate based on today&apos;s wholesale pricing and standard loan-level adjustments. Actual rates depend on full credit review, property appraisal, and underwriting. Not a commitment to lend. {LO_CONFIG.company} | NMLS {LO_CONFIG.nmls} | {LO_CONFIG.address}</p>
      </div>
    </div>
  );
}
