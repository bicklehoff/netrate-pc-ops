'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import staticSunwestData from '@/data/rates/sunwest.json';
import ScenarioForm from './ScenarioForm';
import RateResults from './RateResults';
import RateEducation from './RateEducation';
import LeadCapture from './LeadCapture';
import ComparisonReport from './ComparisonReport';
import { LO_CONFIG } from '@/lib/rates/config';
import { DEFAULT_SCENARIO } from '@/lib/rates/defaults';
import { useApiPricing } from './useApiPricing';
import { trackRateToolInteraction, startEngagementTimer } from '@/lib/analytics';
import { getThirdPartyCosts } from '@/lib/rates/closing-costs';

export default function RateTool({ initialRateData, defaultState }) {
  // Use GCS data if available, fall back to static bundled data
  const rateData = initialRateData?.lenders?.[0] || staticSunwestData;

  const initialState = defaultState || 'CO';

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
    purpose: DEFAULT_SCENARIO.loanPurpose,
    loanType: 'conventional',
    propertyType: DEFAULT_SCENARIO.propertyType,
    propertyValue: DEFAULT_SCENARIO.propertyValue,
    downPaymentPct: DEFAULT_SCENARIO.downPaymentPct,
    currentPayoff: DEFAULT_SCENARIO.currentPayoff,
    newLoanAmount: DEFAULT_SCENARIO.currentPayoff,
    currentRate: DEFAULT_SCENARIO.currentRate,
    fico: DEFAULT_SCENARIO.fico,
    term: 30,
    productType: 'fixed',
    vaFundingFeeExempt: false,
    vaSubsequentUse: false,
    loanAmount: 0,
    ltv: 0,
    state: initialState,
    county: initialState === 'CO' ? 'Denver' : initialState === 'CA' ? 'Los Angeles' : initialState === 'TX' ? 'Dallas' : initialState === 'OR' ? 'Multnomah' : '',
    thirdPartyCosts: getThirdPartyCosts(initialState),
  });

  const { results: apiResults, loading: apiLoading, fetchRates, effectiveDate: apiDate } = useApiPricing(scenario);

  const [compareRates, setCompareRates] = useState([]);
  const [showReport, setShowReport] = useState(false);

  const handleToggleCompare = (rate) => {
    setCompareRates(prev => {
      const exists = prev.find(r => r.rate === rate.rate);
      if (exists) return prev.filter(r => r.rate !== rate.rate);
      if (prev.length >= 3) return prev;
      return [...prev, rate];
    });
  };

  return (
    <div>
      {/* Rate Tool Header */}
      <div className="bg-brand text-white px-5 py-2 rounded-t-lg flex justify-between items-center flex-wrap gap-2">
        <p className="text-cyan-100 text-sm">{LO_CONFIG.name} | NMLS {LO_CONFIG.nmls} | {LO_CONFIG.phone}</p>
        <p className="text-sm text-cyan-100">Rates effective {apiDate || rateData?.lender?.effectiveDate || 'today'}</p>
      </div>

      {/* Rate Tool Body */}
      <div className="px-1">
        <ScenarioForm scenario={scenario} onChange={handleScenarioChange} onSubmit={fetchRates} loading={apiLoading} />
        <RateResults
          scenario={scenario}
          rateData={rateData}
          apiResults={apiResults}
          loading={apiLoading}
          compareRates={compareRates}
          onToggleCompare={handleToggleCompare}
          onViewReport={() => setShowReport(true)}
        />
        <RateEducation />
        <LeadCapture scenario={scenario} />
      </div>

      {/* Comparison Report Modal */}
      {showReport && (
        <ComparisonReport
          compareRates={compareRates}
          scenario={scenario}
          rateData={rateData}
          onClose={() => setShowReport(false)}
        />
      )}

      {/* Disclaimer */}
      <div className="text-xs text-gray-400 px-5 py-4 border-t border-gray-100 leading-relaxed">
        <p>Rates shown are approximate based on today&apos;s wholesale pricing and standard loan-level adjustments. Actual rates depend on full credit review, property appraisal, and underwriting. Not a commitment to lend. {LO_CONFIG.company} | NMLS {LO_CONFIG.nmls} | {LO_CONFIG.address}</p>
      </div>
    </div>
  );
}
