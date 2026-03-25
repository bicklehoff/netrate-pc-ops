'use client';

import { calculateLLPA, calculatePI, priceRates } from '@/lib/rates/engine';

export default function RateResults({ scenario, rateData, apiResults, loading, compareRates = [], onToggleCompare, onViewReport }) {

  if (!scenario.loanAmount || scenario.loanAmount <= 0 || !scenario.propertyValue) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 my-4 text-center text-gray-500">
        Enter your scenario above to see today&apos;s rates
      </div>
    );
  }

  // Use API results if available, fall back to old engine.js
  let rates, llpa;
  if (apiResults && apiResults.length > 0) {
    rates = apiResults;
    // Build LLPA summary from the first result's breakdown
    const firstWithLlpa = apiResults.find(r => r.llpaBreakdown?.length > 0);
    llpa = {
      total: firstWithLlpa?.llpaPoints || 0,
      breakdown: firstWithLlpa?.llpaBreakdown || [],
    };
  } else {
    llpa = calculateLLPA(scenario, rateData);
    rates = priceRates(scenario, rateData);
  }
  const currentPI = scenario.currentRate ? calculatePI(scenario.currentRate, scenario.loanAmount) : null;

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-8 my-4 text-center text-gray-500">
        Loading rates...
      </div>
    );
  }

  let parIdx = 0;
  let minAbsAdj = Infinity;
  rates.forEach((r, i) => {
    if (Math.abs(r.adjPrice) < minAbsAdj) { minAbsAdj = Math.abs(r.adjPrice); parIdx = i; }
  });

  const showStart = Math.max(0, parIdx - 5);
  const showEnd = Math.min(rates.length, parIdx + 6);
  // Display lowest rate first (ascending)
  const sliced = rates.slice(showStart, showEnd);
  // API results are already ascending; old engine results were descending
  const isAscending = sliced.length >= 2 && sliced[0].rate <= sliced[sliced.length - 1].rate;
  const visibleRates = isAscending ? sliced : sliced.reverse();

  // Compute badge thresholds
  const lenderFees = rateData.lender.lenderFees;
  const thirdPartyCosts = scenario.thirdPartyCosts || 0;
  const totalFixed = lenderFees + thirdPartyCosts;

  // Find sweet spots in both directions from par.
  // CHARGE SIDE (below par): cheapest cost per 1/8th of rate drop from par.
  // CREDIT SIDE (above par): most credit per 1/8th of rate increase from par.
  let bestValueRate = null;
  let bestCreditRate = null;
  {
    const parRate = rates[parIdx];
    if (parRate) {
      const parCost = (parRate.adjPrice / 100) * scenario.loanAmount;

      // Charge side — lowest cost per eighth below par
      let bestCostPerEighth = Infinity;
      for (const r of rates) {
        if (r.rate >= parRate.rate || r.adjPrice <= 0) continue;
        const eighthsBelow = (parRate.rate - r.rate) / 0.125;
        if (eighthsBelow <= 0) continue;
        const totalCost = ((r.adjPrice / 100) * scenario.loanAmount) - parCost;
        if (totalCost <= 0) continue;
        const costPerEighth = totalCost / eighthsBelow;
        if (costPerEighth < bestCostPerEighth) {
          bestCostPerEighth = costPerEighth;
          bestValueRate = r;
        }
      }

      // Credit side — most credit per eighth above par
      let bestCreditPerEighth = 0;
      for (const r of rates) {
        if (r.rate <= parRate.rate || r.creditDollars >= 0) continue;
        const eighthsAbove = (r.rate - parRate.rate) / 0.125;
        if (eighthsAbove <= 0) continue;
        const totalCredit = Math.abs(r.creditDollars);
        const creditPerEighth = totalCredit / eighthsAbove;
        if (creditPerEighth > bestCreditPerEighth) {
          bestCreditPerEighth = creditPerEighth;
          bestCreditRate = r;
        }
      }
    }
  }

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
            {[...compareRates].sort((a, b) => a.rate - b.rate).map(r => (
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
              <th className="text-left px-3 py-3">Rate</th>
              <th className="text-left px-2 py-3">Lender</th>
              <th className="text-right px-2 py-3">APR</th>
              <th className="text-right px-2 py-3">Monthly P&I</th>
              {currentPI && <th className="text-right px-2 py-3">Savings</th>}
              <th className="text-right px-3 py-3">Cost / Credit</th>
              <th className="px-2 py-3"></th>
              <th className="px-1 py-3 print:hidden"></th>
            </tr>
          </thead>
          <tbody>
            {visibleRates.map((r, i) => {
              const isCredit = r.adjPrice < 0;
              const isPar = Math.abs(r.adjPrice) < 0.15;
              const savings = currentPI ? currentPI - r.monthlyPI : 0;
              const isNoCost = (totalFixed + r.creditDollars) <= 0;
              const isBestValue = bestValueRate && r.rate === bestValueRate.rate;
              const isBestCredit = bestCreditRate && r.rate === bestCreditRate.rate;
              return (
                <tr key={r.rate}
                  className={`border-b border-gray-100 ${isPar ? "bg-cyan-50" : i % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-cyan-50 transition-colors`}>
                  <td className="px-3 py-3 font-semibold text-gray-800">{r.rate.toFixed(3)}%</td>
                  <td className="px-2 py-3 text-xs text-gray-400">{r.lender || ''}</td>
                  <td className="text-right px-2 py-3 font-mono text-gray-500">{r.apr ? r.apr.toFixed(3) + '%' : '—'}</td>
                  <td className="text-right px-2 py-3 font-mono text-gray-700">
                    ${r.monthlyPI.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  {currentPI && (
                    <td className={`text-right px-2 py-3 font-mono ${savings > 0 ? "text-green-700" : "text-gray-400"}`}>
                      {savings > 0 ? `-$${savings.toFixed(0)}/mo` : "\u2014"}
                    </td>
                  )}
                  <td className={`text-right px-3 py-3 font-mono font-semibold ${isCredit ? "text-green-700" : "text-red-600"}`}>
                    {isCredit
                      ? `($${Math.abs(r.creditDollars).toLocaleString("en-US", { maximumFractionDigits: 0 })})`
                      : `$${Math.abs(r.creditDollars).toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex flex-wrap gap-1">
                      {isBestValue && <span className="text-xs bg-blue-100 text-blue-800 rounded px-2 py-1 whitespace-nowrap">SWEET SPOT</span>}
                      {isBestCredit && <span className="text-xs bg-purple-100 text-purple-800 rounded px-2 py-1 whitespace-nowrap">SWEET SPOT</span>}
                      {isPar && <span className="text-xs text-white rounded px-2 py-1 whitespace-nowrap bg-brand">PAR</span>}
                      {isNoCost && !isPar && <span className="text-xs bg-green-100 text-green-800 rounded px-2 py-1 whitespace-nowrap">NO COST</span>}
                    </div>
                  </td>
                  <td className="px-1 py-3 print:hidden">
                    {(() => {
                      const isCompared = compareRates.some(c => c.rate === r.rate);
                      return (
                        <button
                          onClick={() => onToggleCompare?.(r)}
                          className={`whitespace-nowrap text-xs font-medium rounded-md px-3 py-1.5 border transition-all ${
                            isCompared
                              ? 'bg-brand text-white border-brand shadow-sm'
                              : 'border-brand/40 text-brand hover:bg-brand hover:text-white hover:border-brand hover:shadow-sm'
                          } ${!isCompared && compareRates.length >= 3 ? 'opacity-30 cursor-not-allowed' : ''}`}
                          disabled={!isCompared && compareRates.length >= 3}
                        >
                          {isCompared ? '✓ Selected' : '+ Compare'}
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
