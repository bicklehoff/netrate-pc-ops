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
    propertyType: DEFAULT_SCENARIO.propertyType,
    propertyValue: DEFAULT_SCENARIO.propertyValue,
    downPaymentPct: DEFAULT_SCENARIO.downPaymentPct,
    currentPayoff: DEFAULT_SCENARIO.currentPayoff,
    currentRate: DEFAULT_SCENARIO.currentRate,
    fico: DEFAULT_SCENARIO.fico,
    loanAmount: 0,
    ltv: 0,
    state: initialState,
    thirdPartyCosts: getThirdPartyCosts(initialState),
  });

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
      <div className="bg-brand text-white px-6 py-5 rounded-t-lg">
        <div className="flex justify-between items-start flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{LO_CONFIG.company}</h1>
            <p className="text-cyan-100 text-sm mt-1">{LO_CONFIG.name} | NMLS {LO_CONFIG.nmls}</p>
            <p className="text-cyan-200/70 text-sm">{LO_CONFIG.phone} | {LO_CONFIG.email}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-cyan-200/70 uppercase tracking-widest">Today&apos;s Rates</p>
            <p className="text-sm text-cyan-100">Effective {rateData.lender.effectiveDate}</p>
            <p className="text-xs text-cyan-200/50">Updated {rateData.lender.effectiveTime}</p>
          </div>
        </div>
      </div>

      {/* Rate Tool Body */}
      <div className="px-1">
        <ScenarioForm scenario={scenario} onChange={handleScenarioChange} />
        <RateResults
          scenario={scenario}
          rateData={rateData}
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
