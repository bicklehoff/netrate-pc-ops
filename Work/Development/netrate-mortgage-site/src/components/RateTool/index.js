'use client';

import { useState } from 'react';
import staticAmwestData from '@/data/rates/amwest.json';
import ScenarioForm from './ScenarioForm';
import RateResults from './RateResults';
import RateEducation from './RateEducation';
import LeadCapture from './LeadCapture';
import RateQuoteModal from './RateQuoteModal';
import RateQuotePrintView from './RateQuotePrintView';
import { LO_CONFIG } from '@/lib/rates/config';

export default function RateTool({ initialRateData }) {
  // Use GCS data if available, fall back to static bundled data
  const rateData = initialRateData?.lenders?.[0] || staticAmwestData;

  const [scenario, setScenario] = useState({
    purpose: "refi",
    propertyType: "sfr",
    propertyValue: 500000,
    downPaymentPct: 20,
    currentPayoff: 400000,
    currentRate: 7.125,
    fico: 760,
    loanAmount: 0,
    ltv: 0,
    state: 'CO',
    thirdPartyCosts: 2800,
  });

  const [selectedRate, setSelectedRate] = useState(null);
  const [compareRates, setCompareRates] = useState([]);

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
            <button
              onClick={() => window.print()}
              className="mt-2 text-xs font-semibold border border-white/40 text-white rounded-md px-3 py-1.5 hover:bg-white/10 transition-colors print:hidden"
            >
              Print My Quote
            </button>
          </div>
        </div>
      </div>

      {/* Rate Tool Body — hidden in print */}
      <div className="px-1 print:hidden">
        <ScenarioForm scenario={scenario} onChange={setScenario} />
        <RateResults
          scenario={scenario}
          rateData={rateData}
          onSelectRate={setSelectedRate}
          compareRates={compareRates}
          onToggleCompare={handleToggleCompare}
        />
        <RateEducation />
        <LeadCapture scenario={scenario} />
      </div>

      {/* Rate Quote Modal */}
      {selectedRate && (
        <RateQuoteModal
          rate={selectedRate}
          scenario={scenario}
          onClose={() => setSelectedRate(null)}
        />
      )}

      {/* Print View — hidden on screen, shown in print */}
      <RateQuotePrintView
        scenario={scenario}
        rateData={rateData}
        compareRates={compareRates}
        selectedRate={selectedRate}
      />

      {/* Disclaimer */}
      <div className="text-xs text-gray-400 px-5 py-4 border-t border-gray-100 leading-relaxed print:hidden">
        <p>Rates shown are approximate based on today&apos;s wholesale pricing and standard loan-level adjustments. Actual rates depend on full credit review, property appraisal, and underwriting. Not a commitment to lend. {LO_CONFIG.company} | NMLS {LO_CONFIG.nmls} | {LO_CONFIG.address}</p>
      </div>
    </div>
  );
}
