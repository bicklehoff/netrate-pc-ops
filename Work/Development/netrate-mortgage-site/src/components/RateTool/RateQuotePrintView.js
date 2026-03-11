// Rate Quote Print View — Branded, print-optimized rate summary
// Hidden on screen (hidden print:block), shown when user clicks "Print My Quote"
// Pattern matches HecmOptimizer/PrintView.js

'use client';

import { calculateLLPA, calculatePI, priceRates } from '@/lib/rates/engine';
import { LO_CONFIG } from '@/lib/rates/config';
import { STATE_DEFAULTS } from '@/lib/rates/closing-costs';

const PURPOSE_LABELS = {
  purchase: 'Purchase',
  refi: 'Rate/Term Refinance',
  cashout: 'Cash-Out Refinance',
};

const PROP_LABELS = {
  sfr: 'Single Family',
  condo: 'Condo',
  townhome: 'Townhome',
};

const fmtDollar = (v) => {
  if (v === null || v === undefined) return '—';
  const prefix = v < 0 ? '-' : '';
  return `${prefix}$${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};

const fmtPI = (v) =>
  '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function getAutoPickRates(visibleRates) {
  // Auto-pick 3 rates: lowest rate with cost, par, highest credit
  let parRate = visibleRates[0];
  let minAbsAdj = Infinity;
  visibleRates.forEach(r => {
    if (Math.abs(r.adjPrice) < minAbsAdj) { minAbsAdj = Math.abs(r.adjPrice); parRate = r; }
  });

  const costRates = visibleRates.filter(r => r.adjPrice > 0.15);
  const creditRates = visibleRates.filter(r => r.adjPrice < -0.15);

  const picks = [parRate];
  if (costRates.length > 0) picks.unshift(costRates[costRates.length - 1]); // lowest rate (highest cost)
  if (creditRates.length > 0) picks.push(creditRates[0]); // highest credit

  // Dedupe by rate
  const seen = new Set();
  return picks.filter(r => {
    if (seen.has(r.rate)) return false;
    seen.add(r.rate);
    return true;
  }).slice(0, 3);
}

export default function RateQuotePrintView({ scenario, rateData, compareRates, selectedRate }) {
  // Determine which rates to show
  const rates = priceRates(scenario, rateData);
  let parIdx = 0;
  let minAbsAdj = Infinity;
  rates.forEach((r, i) => {
    if (Math.abs(r.adjPrice) < minAbsAdj) { minAbsAdj = Math.abs(r.adjPrice); parIdx = i; }
  });
  const showStart = Math.max(0, parIdx - 5);
  const showEnd = Math.min(rates.length, parIdx + 6);
  const visibleRates = rates.slice(showStart, showEnd);

  const ratesToShow = compareRates.length > 0
    ? compareRates
    : selectedRate
      ? [selectedRate]
      : getAutoPickRates(visibleRates);

  if (ratesToShow.length === 0 || !scenario.loanAmount || scenario.loanAmount <= 0) return null;

  const llpa = calculateLLPA(scenario, rateData);
  const currentPI = scenario.currentRate ? calculatePI(scenario.currentRate, scenario.loanAmount) : null;
  const stateLabel = STATE_DEFAULTS[scenario.state]?.label || scenario.state || '';
  const lenderFees = rateData.lender.lenderFees;
  const thirdPartyCosts = scenario.thirdPartyCosts || 0;
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="hidden print:block">
      {/* Page 1: Quote */}
      <div className="print-page">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-cyan-700">{LO_CONFIG.company}</h1>
          <p className="text-sm text-gray-500">NMLS #{LO_CONFIG.nmls}</p>
          <p className="text-xs text-gray-400 mt-1">{LO_CONFIG.address} | {LO_CONFIG.phone}</p>
        </div>

        <div className="border-t-2 border-cyan-600 pt-4 mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Your Rate Quote</h2>
          <p className="text-sm text-gray-500 mt-1">Prepared by {LO_CONFIG.name} | {today}</p>
          <p className="text-xs text-gray-400">Effective rates as of {rateData.lender.effectiveDate}</p>
        </div>

        {/* Scenario Summary */}
        <div className="bg-gray-50 rounded-lg p-4 mb-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Your Scenario</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <div><span className="text-gray-500">Purpose:</span> {PURPOSE_LABELS[scenario.purpose] || scenario.purpose}</div>
            <div><span className="text-gray-500">Property:</span> {fmtDollar(scenario.propertyValue)} | {PROP_LABELS[scenario.propertyType] || scenario.propertyType}</div>
            <div><span className="text-gray-500">Loan Amount:</span> {fmtDollar(scenario.loanAmount)}</div>
            <div><span className="text-gray-500">LTV:</span> {scenario.ltv?.toFixed(1)}%</div>
            <div><span className="text-gray-500">Credit Score:</span> {scenario.fico}+</div>
            <div><span className="text-gray-500">State:</span> {stateLabel}</div>
            {currentPI && <div><span className="text-gray-500">Current Rate:</span> {scenario.currentRate}%</div>}
          </div>
        </div>

        {/* Rate Comparison Table */}
        <h3 className="text-sm font-semibold text-gray-700 mb-2">
          {ratesToShow.length > 1 ? 'Rate Comparison' : 'Selected Rate'}
        </h3>
        <table className="w-full text-sm border border-gray-300 mb-5">
          <thead>
            <tr className="bg-cyan-50">
              <th className="px-3 py-2 text-left text-gray-600 border-b border-gray-300">Rate</th>
              <th className="px-3 py-2 text-right text-gray-600 border-b border-gray-300">Monthly P&I</th>
              {currentPI && <th className="px-3 py-2 text-right text-gray-600 border-b border-gray-300">Monthly Savings</th>}
              <th className="px-3 py-2 text-right text-gray-600 border-b border-gray-300">Credit / Charge</th>
              <th className="px-3 py-2 text-right text-gray-600 border-b border-gray-300">Net ($)</th>
            </tr>
          </thead>
          <tbody>
            {ratesToShow.map(r => {
              const isCredit = r.adjPrice < 0;
              const savings = currentPI ? currentPI - r.monthlyPI : 0;
              return (
                <tr key={r.rate} className="border-b border-gray-200">
                  <td className="px-3 py-2 font-semibold">{r.rate.toFixed(3)}%</td>
                  <td className="px-3 py-2 text-right font-mono">{fmtPI(r.monthlyPI)}</td>
                  {currentPI && (
                    <td className={`px-3 py-2 text-right font-mono ${savings > 0 ? 'text-green-700' : ''}`}>
                      {savings > 0 ? `-$${savings.toFixed(0)}/mo` : '—'}
                    </td>
                  )}
                  <td className={`px-3 py-2 text-right font-semibold ${isCredit ? 'text-green-700' : 'text-red-600'}`}>
                    {isCredit ? 'Credit' : 'Charge'} {Math.abs(r.adjPrice).toFixed(2)}%
                  </td>
                  <td className={`px-3 py-2 text-right font-mono font-semibold ${isCredit ? 'text-green-700' : 'text-red-600'}`}>
                    {isCredit ? '+' : '-'}{fmtDollar(Math.abs(r.creditDollars))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* LLPA Breakdown */}
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Price Adjustments (LLPA)</h3>
          <table className="text-xs border border-gray-200 w-full">
            <tbody>
              {llpa.breakdown.map((adj, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="px-3 py-1 text-gray-600">{adj.label}</td>
                  <td className={`px-3 py-1 text-right font-mono ${adj.value > 0 ? 'text-red-600' : 'text-green-700'}`}>
                    {adj.value > 0 ? '+' : ''}{adj.value.toFixed(3)}
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-semibold">
                <td className="px-3 py-1 text-gray-700">Total Adjustment</td>
                <td className="px-3 py-1 text-right font-mono">
                  {llpa.total > 0 ? '+' : ''}{llpa.total.toFixed(3)} pts
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Cost Breakdown per rate */}
        {currentPI && (
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Estimated Cost Breakdown</h3>
            <table className="w-full text-xs border border-gray-200">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-300">
                  <th className="px-3 py-1.5 text-left text-gray-600">Cost Item</th>
                  {ratesToShow.map(r => (
                    <th key={r.rate} className="px-3 py-1.5 text-right text-cyan-700 font-semibold">
                      {r.rate.toFixed(3)}%
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-3 py-1 text-gray-600">Lender Fees</td>
                  {ratesToShow.map(r => (
                    <td key={r.rate} className="px-3 py-1 text-right font-mono">{fmtDollar(lenderFees)}</td>
                  ))}
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-3 py-1 text-gray-600">Est. Third-Party ({stateLabel})</td>
                  {ratesToShow.map(r => (
                    <td key={r.rate} className="px-3 py-1 text-right font-mono">{fmtDollar(thirdPartyCosts)}</td>
                  ))}
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-3 py-1 text-gray-600">Credit / Charge</td>
                  {ratesToShow.map(r => (
                    <td key={r.rate} className={`px-3 py-1 text-right font-mono ${r.creditDollars < 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {r.creditDollars < 0 ? '+' : ''}{fmtDollar(r.creditDollars)}
                    </td>
                  ))}
                </tr>
                <tr className="bg-gray-50 font-semibold border-t border-gray-300">
                  <td className="px-3 py-1.5 text-gray-700">Est. Total Refi Cost</td>
                  {ratesToShow.map(r => {
                    const total = lenderFees + thirdPartyCosts + r.creditDollars;
                    return (
                      <td key={r.rate} className="px-3 py-1.5 text-right font-mono">{fmtDollar(total)}</td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Break-Even Stats (refi only) */}
        {currentPI && (
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Break-Even Analysis</h3>
            <table className="w-full text-xs border border-gray-200">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-300">
                  <th className="px-3 py-1.5 text-left text-gray-600">Metric</th>
                  {ratesToShow.map(r => (
                    <th key={r.rate} className="px-3 py-1.5 text-right text-cyan-700 font-semibold">
                      {r.rate.toFixed(3)}%
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-3 py-1 text-gray-600">Monthly Savings</td>
                  {ratesToShow.map(r => {
                    const sav = currentPI - r.monthlyPI;
                    return (
                      <td key={r.rate} className={`px-3 py-1 text-right font-mono ${sav > 0 ? 'text-green-700' : ''}`}>
                        {sav > 0 ? `$${sav.toFixed(0)}/mo` : '—'}
                      </td>
                    );
                  })}
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-3 py-1 text-gray-600">Annual Savings</td>
                  {ratesToShow.map(r => {
                    const sav = currentPI - r.monthlyPI;
                    return (
                      <td key={r.rate} className={`px-3 py-1 text-right font-mono ${sav > 0 ? 'text-green-700' : ''}`}>
                        {sav > 0 ? `$${(sav * 12).toFixed(0)}/yr` : '—'}
                      </td>
                    );
                  })}
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-3 py-1 text-gray-600">Est. Total Refi Cost</td>
                  {ratesToShow.map(r => {
                    const total = lenderFees + thirdPartyCosts + r.creditDollars;
                    return (
                      <td key={r.rate} className="px-3 py-1 text-right font-mono">{fmtDollar(total)}</td>
                    );
                  })}
                </tr>
                <tr className="bg-cyan-50 font-semibold border-t border-gray-300">
                  <td className="px-3 py-1.5 text-gray-700">Break-Even</td>
                  {ratesToShow.map(r => {
                    const sav = currentPI - r.monthlyPI;
                    const total = lenderFees + thirdPartyCosts + r.creditDollars;
                    const months = sav > 0 ? total / sav : null;
                    return (
                      <td key={r.rate} className="px-3 py-1.5 text-right font-mono text-cyan-700">
                        {months !== null && months > 0 ? `${months.toFixed(1)} months` : months === 0 || (months !== null && months <= 0) ? 'Instant' : '—'}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Disclaimer */}
        <div className="mt-6 pt-4 border-t border-gray-300 text-xs text-gray-500 space-y-2">
          <p>Rates shown are approximate based on today&apos;s wholesale pricing and standard loan-level price adjustments. Actual rates depend on full credit review, property appraisal, and underwriting approval. Third-party cost estimates are based on state averages and may vary by county and provider. Not a commitment to lend.</p>
          <p>{LO_CONFIG.name} | NMLS #{LO_CONFIG.nmls} | {LO_CONFIG.company} | {LO_CONFIG.phone} | {LO_CONFIG.email}</p>
          <p className="text-gray-400">netratemortgage.com</p>
        </div>
      </div>
    </div>
  );
}
