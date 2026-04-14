'use client';

import { useSearchParams } from 'next/navigation';
import { calculatePI } from '@/lib/rates/engine';

export default function RateResults({ scenario, apiResults, loading, onSaveScenario, brpToken }) {
  const searchParams = useSearchParams();
  const debugMode = searchParams?.get('debug') === '1';

  if (!scenario.loanAmount || scenario.loanAmount <= 0 || !scenario.propertyValue) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 my-4 text-center text-gray-500">
        Enter your scenario above to see today&apos;s rates
      </div>
    );
  }

  const llpa = { total: 0, breakdown: apiResults?.[0]?.breakdown || [] };
  const rates = apiResults || [];
  const currentPI = scenario.currentRate ? calculatePI(scenario.currentRate, scenario.loanAmount) : null;

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-12 my-4 text-center">
        <svg className="animate-spin h-8 w-8 text-brand mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <p className="text-gray-600 font-medium">Pulling today&apos;s mortgage rates...</p>
        <p className="text-gray-400 text-sm mt-1">Calculating adjustments for your scenario</p>
      </div>
    );
  }

  if (!rates || rates.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 my-4 text-center text-gray-500">
        Click &quot;Get My Rates&quot; above to see today&apos;s pricing
      </div>
    );
  }

  // Find PAR rate — closest to 100 (smallest absolute cost/credit)
  let parIdx = 0;
  let minAbsCost = Infinity;
  rates.forEach((r, i) => {
    const absCost = Math.abs(r.costDollars || 0);
    if (absCost < minAbsCost) { minAbsCost = absCost; parIdx = i; }
  });

  const showStart = Math.max(0, parIdx - 5);
  const showEnd = Math.min(rates.length, parIdx + 6);
  // Display lowest rate first (ascending)
  const sliced = rates.slice(showStart, showEnd);
  // API results are already ascending
  const isAscending = sliced.length >= 2 && sliced[0].rate <= sliced[sliced.length - 1].rate;
  const visibleRates = isAscending ? sliced : sliced.reverse();

  // Find sweet spots in both directions from par.
  // CHARGE SIDE (below par): cheapest cost per 1/8th of rate drop from par.
  // CREDIT SIDE (above par): most credit per 1/8th of rate increase from par.
  let bestValueRate = null;
  let bestCreditRate = null;
  {
    const parRate = rates[parIdx];
    if (parRate) {
      // Charge side — lowest cost per eighth below par (lower rate = more discount)
      let bestCostPerEighth = Infinity;
      for (const r of rates) {
        if (r.rate >= parRate.rate || !r.isDiscount) continue;
        const eighthsBelow = (parRate.rate - r.rate) / 0.125;
        if (eighthsBelow <= 0) continue;
        const costPerEighth = r.discountDollars / eighthsBelow;
        if (costPerEighth < bestCostPerEighth) {
          bestCostPerEighth = costPerEighth;
          bestValueRate = r;
        }
      }

      // Credit side — most rebate per eighth above par (higher rate = more rebate)
      let bestCreditPerEighth = 0;
      for (const r of rates) {
        if (r.rate <= parRate.rate || !r.isRebate) continue;
        const eighthsAbove = (r.rate - parRate.rate) / 0.125;
        if (eighthsAbove <= 0) continue;
        const creditPerEighth = r.rebateDollars / eighthsAbove;
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

      {/* Save Scenario Bar */}
      <div className={`px-5 py-3 ${brpToken ? 'bg-brand/5 border-b border-brand/20' : 'bg-amber-50 border-b border-amber-200'} flex items-center justify-between print:hidden`}>
        <p className={`text-sm ${brpToken ? 'text-brand-dark' : 'text-amber-800'} hidden sm:block`}>
          {brpToken
            ? 'Like these rates? Update your saved scenario with these new inputs.'
            : 'Want to track these rates? Save now and we\u2019ll alert you when they change.'}
        </p>
        <button
          onClick={() => onSaveScenario?.()}
          className={`${brpToken ? 'bg-brand hover:bg-brand-dark' : 'bg-amber-500 hover:bg-amber-600'} text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors whitespace-nowrap flex items-center gap-2 ml-auto shadow-sm`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {brpToken ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            )}
          </svg>
          {brpToken ? 'Update My Rate Scenario' : 'Save & Get Rate Alerts'}
        </button>
      </div>

      {/* Rate Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
              <th className="text-left px-3 py-3">Rate</th>
              {debugMode && <th className="text-left px-2 py-3">Lender</th>}
              <th className="text-right px-2 py-3">APR</th>
              <th className="text-right px-2 py-3">Monthly P&I</th>
              {currentPI && <th className="text-right px-2 py-3">Savings</th>}
              <th className="text-right px-3 py-3">Cost / Credit</th>
              <th className="px-2 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {visibleRates.map((r, i) => {
              const isRebate = r.isRebate || false;
              const isPar = r.isPar || Math.abs(r.costDollars) < 50;
              const savings = currentPI ? currentPI - r.monthlyPI : 0;
              const displayDollars = isRebate ? (r.rebateDollars || 0) : (r.discountDollars || 0);
              const isNoCost = isRebate && (r.rebateDollars >= (r.lenderFee || 0));
              const isBestValue = bestValueRate && r.rate === bestValueRate.rate;
              const isBestCredit = bestCreditRate && r.rate === bestCreditRate.rate;
              return (
                <tr key={r.rate}
                  className={`border-b border-gray-100 ${isPar ? "bg-cyan-50" : i % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-cyan-50 transition-colors`}>
                  <td className="px-3 py-3">
                    <span className="font-semibold text-gray-800">{r.rate.toFixed(3)}%</span>
                    {debugMode && r.program && <div className="text-[10px] text-gray-400 truncate max-w-[180px]">{r.program}</div>}
                  </td>
                  {debugMode && (
                    <td className="px-2 py-3">
                      <span className="text-xs font-mono uppercase text-gray-700 bg-gray-100 rounded px-2 py-1">{r.lender || '—'}</span>
                    </td>
                  )}
                  <td className="text-right px-2 py-3 font-mono text-gray-500">{r.apr ? r.apr.toFixed(3) + '%' : '—'}</td>
                  <td className="text-right px-2 py-3 font-mono text-gray-700">
                    ${r.monthlyPI.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  {currentPI && (
                    <td className={`text-right px-2 py-3 font-mono ${savings > 0 ? "text-green-700" : "text-gray-400"}`}>
                      {savings > 0 ? `-$${savings.toFixed(0)}/mo` : "\u2014"}
                    </td>
                  )}
                  <td className={`text-right px-3 py-3 font-mono font-semibold ${isRebate ? "text-green-700" : "text-red-600"}`}>
                    {isRebate
                      ? `($${displayDollars.toLocaleString("en-US", { maximumFractionDigits: 0 })})`
                      : `$${displayDollars.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex flex-wrap gap-1">
                      {isBestValue && <span className="text-xs bg-blue-100 text-blue-800 rounded px-2 py-1 whitespace-nowrap">SWEET SPOT</span>}
                      {isBestCredit && <span className="text-xs bg-purple-100 text-purple-800 rounded px-2 py-1 whitespace-nowrap">SWEET SPOT</span>}
                      {isPar && <span className="text-xs text-white rounded px-2 py-1 whitespace-nowrap bg-brand">PAR</span>}
                      {isNoCost && !isPar && <span className="text-xs bg-green-100 text-green-800 rounded px-2 py-1 whitespace-nowrap">NO COST</span>}
                    </div>
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

      {/* Save Scenario CTA — shown when results are loaded */}
      <div className="px-5 py-4 border-t border-gray-100 print:hidden bg-gradient-to-b from-white to-cyan-50/30">
        <button
          onClick={() => onSaveScenario?.()}
          className="w-full bg-brand text-white rounded-lg py-3 font-semibold text-sm hover:bg-brand-dark transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {brpToken ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            )}
          </svg>
          {brpToken ? 'Update My Rate Scenario' : 'Save This Scenario & Get Rate Alerts'}
        </button>
        <p className="text-xs text-gray-400 text-center mt-2">
          We&apos;ll re-price this exact scenario on your schedule and email you when rates move. Reviewed by a human, not a bot.
        </p>
      </div>

      <div className="px-5 py-2 text-xs text-gray-400 border-t border-gray-100">
        Rates approximate based on today&apos;s pricing.{' '}
        Showing best rate across {new Set(apiResults.map(r => r.lender)).size} lenders.{' '}
        Est. third-party costs: ${(scenario.thirdPartyCosts || 0).toLocaleString()}. Contact for exact quote with full cost breakdown.
      </div>
    </div>
  );
}
