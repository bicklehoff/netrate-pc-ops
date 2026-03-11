'use client';

import { calculateLLPA, calculatePI, priceRates } from '@/lib/rates/engine';

export default function RateResults({ scenario, rateData, compareRates = [], onToggleCompare, onViewReport }) {
  if (!scenario.loanAmount || scenario.loanAmount <= 0 || !scenario.propertyValue) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 my-4 text-center text-gray-500">
        Enter your scenario above to see today&apos;s rates
      </div>
    );
  }

  const llpa = calculateLLPA(scenario, rateData);
  const rates = priceRates(scenario, rateData);
  const currentPI = scenario.currentRate ? calculatePI(scenario.currentRate, scenario.loanAmount) : null;

  let parIdx = 0;
  let minAbsAdj = Infinity;
  rates.forEach((r, i) => {
    if (Math.abs(r.adjPrice) < minAbsAdj) { minAbsAdj = Math.abs(r.adjPrice); parIdx = i; }
  });

  const showStart = Math.max(0, parIdx - 5);
  const showEnd = Math.min(rates.length, parIdx + 6);
  const visibleRates = rates.slice(showStart, showEnd);

  return (
    <div className="bg-white border border-gray-200 rounded-lg my-4 overflow-hidden">
      <div className="text-white px-5 py-3 flex justify-between items-center bg-brand-dark">
        <h2 className="text-lg font-semibold">Your Rate Options</h2>
        <span className="text-xs text-gray-300">30yr Fixed | 30-Day Lock</span>
      </div>

      {/* LLPA Summary */}
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Price Adjustments Applied</p>
        <div className="flex flex-wrap gap-3">
          {llpa.breakdown.map((adj, i) => (
            <span key={i} className="text-xs bg-white border border-gray-200 rounded px-2 py-1">
              {adj.label}: <strong className={adj.value > 0 ? "text-red-600" : "text-green-600"}>
                {adj.value > 0 ? "+" : ""}{adj.value.toFixed(3)}
              </strong>
            </span>
          ))}
          <span className="text-xs text-white rounded px-2 py-1 font-semibold bg-brand-dark">
            Total: {llpa.total > 0 ? "+" : ""}{llpa.total.toFixed(3)} pts
          </span>
        </div>
      </div>

      {/* Sticky Compare Bar — always visible when rates selected */}
      {compareRates.length > 0 && (
        <div className="sticky top-0 z-10 px-5 py-3 bg-brand/5 border-b border-brand/20 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <span className="font-semibold text-brand">{compareRates.length}</span>
            <span>rate{compareRates.length > 1 ? 's' : ''} selected:</span>
            {compareRates.map(r => (
              <span key={r.rate} className="bg-white border border-brand/30 text-brand-dark font-mono font-semibold rounded px-2 py-0.5 text-xs">
                {r.rate.toFixed(3)}%
              </span>
            ))}
          </div>
          <button
            onClick={() => onViewReport?.()}
            className="bg-brand text-white px-5 py-2 rounded-lg font-semibold text-sm hover:bg-brand-dark transition-colors whitespace-nowrap"
          >
            View Comparison Report
          </button>
        </div>
      )}

      {/* Rate Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
              <th className="text-left px-5 py-3">Rate</th>
              <th className="text-right px-3 py-3">Monthly P&I</th>
              {currentPI && <th className="text-right px-3 py-3">Monthly Savings</th>}
              <th className="text-right px-3 py-3">Credit / Charge</th>
              <th className="text-right px-5 py-3">Lender Cost</th>
              <th className="px-3 py-3"></th>
              <th className="px-2 py-3 print:hidden"></th>
            </tr>
          </thead>
          <tbody>
            {visibleRates.map((r, i) => {
              const isCredit = r.adjPrice < 0;
              const isPar = Math.abs(r.adjPrice) < 0.15;
              const savings = currentPI ? currentPI - r.monthlyPI : 0;
              const actualIdx = showStart + i;
              return (
                <tr key={r.rate}
                  className={`border-b border-gray-100 ${isPar ? "bg-cyan-50" : actualIdx % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-cyan-50 transition-colors`}>
                  <td className="px-5 py-3 font-semibold text-gray-800">{r.rate.toFixed(3)}%</td>
                  <td className="text-right px-3 py-3 font-mono text-gray-700">
                    ${r.monthlyPI.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  {currentPI && (
                    <td className={`text-right px-3 py-3 font-mono ${savings > 0 ? "text-green-700" : "text-gray-400"}`}>
                      {savings > 0 ? `-$${savings.toFixed(0)}/mo` : "\u2014"}
                    </td>
                  )}
                  <td className={`text-right px-3 py-3 font-semibold ${isCredit ? "text-green-700" : "text-red-600"}`}>
                    {isCredit ? "Credit" : "Charge"}
                  </td>
                  <td className={`text-right px-5 py-3 font-mono font-semibold ${isCredit ? "text-green-700" : "text-red-600"}`}>
                    {isCredit
                      ? `($${Math.abs(r.creditDollars).toLocaleString("en-US", { maximumFractionDigits: 0 })})`
                      : `$${Math.abs(r.creditDollars).toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
                  </td>
                  <td className="px-3 py-3">
                    {isPar && <span className="text-xs text-white rounded px-2 py-1 whitespace-nowrap bg-brand">PAR</span>}
                    {!isPar && isCredit && r.adjPrice < -1 && <span className="text-xs bg-green-100 text-green-800 rounded px-2 py-1 whitespace-nowrap">Low Cost</span>}
                  </td>
                  <td className="px-2 py-3 print:hidden">
                    {(() => {
                      const isCompared = compareRates.some(c => c.rate === r.rate);
                      return (
                        <button
                          onClick={() => onToggleCompare?.(r)}
                          className={`whitespace-nowrap text-xs rounded-md px-2 py-1 border transition-colors ${
                            isCompared
                              ? 'bg-brand text-white border-brand'
                              : 'border-gray-300 text-gray-400 hover:border-brand hover:text-brand'
                          } ${!isCompared && compareRates.length >= 3 ? 'opacity-30 cursor-not-allowed' : ''}`}
                          disabled={!isCompared && compareRates.length >= 3}
                        >
                          {isCompared ? '✓' : 'Compare'}
                        </button>
                      );
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Current rate nudge for refi when no current rate entered */}
      {scenario.purpose !== 'purchase' && !currentPI && (
        <div className="px-5 py-3 bg-amber-50 border-t border-amber-200 text-sm text-amber-800">
          <strong>Tip:</strong> Enter your current rate above to see monthly savings and break-even analysis for each option.
        </div>
      )}

      <div className="px-5 py-2 text-xs text-gray-400 border-t border-gray-100">
        Rates approximate based on today&apos;s pricing. Lender fees: ${rateData.lender.lenderFees.toLocaleString()}. Est. third-party costs: ${(scenario.thirdPartyCosts || 0).toLocaleString()}. Contact for exact quote with full cost breakdown.
      </div>
    </div>
  );
}
