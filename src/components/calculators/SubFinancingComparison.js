'use client';

/**
 * Sub Financing Comparison Calculator
 *
 * Should I keep my HELOC/second mortgage or pay it off with a cash-out refi?
 * Shows side-by-side comparison with LLPA impact, monthly payments, and recommendation.
 */

import { useState, useMemo } from 'react';
import { compareSubFinancingOptions } from '@/lib/rates/sub-financing-comparison';

function formatDollars(n) {
  if (n == null) return '—';
  return '$' + Math.abs(Math.round(n)).toLocaleString();
}

function formatPts(n) {
  if (n == null) return '—';
  return (n >= 0 ? '+' : '') + n.toFixed(3) + ' pts';
}

export default function SubFinancingComparison() {
  const [inputs, setInputs] = useState({
    firstMortgageBalance: 300000,
    currentFirstRate: 6.5,
    secondLienBalance: 50000,
    secondLienPayment: 375,
    secondLienRate: 8.5,
    propertyValue: 500000,
    creditScore: 740,
  });

  const update = (field, value) => {
    setInputs(prev => ({ ...prev, [field]: value }));
  };

  const result = useMemo(() => {
    if (!inputs.firstMortgageBalance || !inputs.secondLienBalance || !inputs.propertyValue) return null;
    try {
      return compareSubFinancingOptions(inputs);
    } catch {
      return null;
    }
  }, [inputs]);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Keep Your Second Lien or Pay It Off?</h1>
      <p className="text-gray-600 mb-6">
        If you have a HELOC or second mortgage, refinancing gets more expensive — lenders add a pricing
        adjustment and use your combined LTV for pricing. Sometimes paying off the second with a cash-out
        refi costs less overall. Let&apos;s find out.
      </p>

      {/* Inputs */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Your Current Situation</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">First Mortgage Balance</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input type="number" value={inputs.firstMortgageBalance}
                onChange={e => update('firstMortgageBalance', Number(e.target.value))}
                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Current First Rate</label>
            <div className="relative">
              <input type="number" step="0.125" value={inputs.currentFirstRate}
                onChange={e => update('currentFirstRate', Number(e.target.value))}
                className="w-full pl-3 pr-7 py-2 border border-gray-300 rounded-lg text-sm" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Second Lien Balance</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input type="number" value={inputs.secondLienBalance}
                onChange={e => update('secondLienBalance', Number(e.target.value))}
                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Second Lien Payment</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input type="number" value={inputs.secondLienPayment}
                onChange={e => update('secondLienPayment', Number(e.target.value))}
                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Property Value</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
              <input type="number" value={inputs.propertyValue}
                onChange={e => update('propertyValue', Number(e.target.value))}
                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Credit Score</label>
            <input type="number" value={inputs.creditScore}
              onChange={e => update('creditScore', Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Second Lien Rate</label>
            <div className="relative">
              <input type="number" step="0.125" value={inputs.secondLienRate}
                onChange={e => update('secondLienRate', Number(e.target.value))}
                className="w-full pl-3 pr-7 py-2 border border-gray-300 rounded-lg text-sm" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Side by side comparison */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {/* Option A */}
            <div className={`rounded-xl border-2 p-6 ${result.comparison.winner === 'keepSecond' ? 'border-brand bg-brand/5' : 'border-gray-200 bg-white'}`}>
              {result.comparison.winner === 'keepSecond' && (
                <span className="inline-block bg-brand text-white text-xs font-bold px-2 py-1 rounded mb-3">BETTER OPTION</span>
              )}
              <h3 className="font-semibold text-gray-900 mb-1">{result.optionA.label}</h3>
              <p className="text-xs text-gray-500 mb-4">{result.optionA.description}</p>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">New first mortgage</span>
                  <span className="font-medium">{formatDollars(result.optionA.loanAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">LTV / CLTV</span>
                  <span className="font-medium">{result.optionA.ltv}% / {result.optionA.cltv}%</span>
                </div>
                <div className="border-t border-gray-100 pt-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">FICO/LTV LLPA</span>
                    <span className="text-red-600">{formatPts(result.optionA.llpa.base)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Sub financing LLPA</span>
                    <span className="text-red-600">{formatPts(result.optionA.llpa.subFinancing)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-gray-700">Total pricing hit</span>
                    <span className="text-red-700">{formatPts(result.optionA.totalPricingHit)} ({formatDollars(result.optionA.totalPricingDollars)})</span>
                  </div>
                </div>
                <div className="border-t border-gray-100 pt-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Est. first mortgage payment</span>
                    <span className="font-medium">{formatDollars(result.optionA.estimatedPayment)}/mo</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Second lien payment</span>
                    <span className="font-medium">{formatDollars(result.optionA.secondLienPayment)}/mo</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-gray-900 mt-1">
                    <span>Total monthly</span>
                    <span>{formatDollars(result.optionA.totalMonthly)}/mo</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Option B */}
            <div className={`rounded-xl border-2 p-6 ${result.comparison.winner === 'payoff' ? 'border-brand bg-brand/5' : 'border-gray-200 bg-white'}`}>
              {result.comparison.winner === 'payoff' && (
                <span className="inline-block bg-brand text-white text-xs font-bold px-2 py-1 rounded mb-3">BETTER OPTION</span>
              )}
              {result.optionB.ltv80Warning && (
                <span className="inline-block bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded mb-3">LTV &gt; 80% — MAY NOT BE AVAILABLE</span>
              )}
              <h3 className="font-semibold text-gray-900 mb-1">{result.optionB.label}</h3>
              <p className="text-xs text-gray-500 mb-4">{result.optionB.description}</p>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">New mortgage (includes payoff)</span>
                  <span className="font-medium">{formatDollars(result.optionB.loanAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">LTV</span>
                  <span className="font-medium">{result.optionB.ltv}%</span>
                </div>
                <div className="border-t border-gray-100 pt-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Cash-out LLPA</span>
                    <span className="text-red-600">{formatPts(result.optionB.llpa.cashOut)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Sub financing LLPA</span>
                    <span className="text-green-600">+0.000 pts (none)</span>
                  </div>
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-gray-700">Total pricing hit</span>
                    <span className="text-red-700">{formatPts(result.optionB.totalPricingHit)} ({formatDollars(result.optionB.totalPricingDollars)})</span>
                  </div>
                </div>
                <div className="border-t border-gray-100 pt-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Est. mortgage payment</span>
                    <span className="font-medium">{formatDollars(result.optionB.estimatedPayment)}/mo</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Second lien payment</span>
                    <span className="text-green-600 font-medium">$0/mo</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-gray-900 mt-1">
                    <span>Total monthly</span>
                    <span>{formatDollars(result.optionB.totalMonthly)}/mo</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Verdict */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">The Verdict</h3>
            <p className="text-gray-700 mb-3">{result.comparison.reason}</p>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-xs text-gray-500">Monthly Difference</div>
                <div className={`text-lg font-bold ${result.comparison.monthlySavings > 0 ? 'text-green-700' : result.comparison.monthlySavings < 0 ? 'text-red-700' : 'text-gray-700'}`}>
                  {result.comparison.monthlySavings > 0 ? 'Save ' : result.comparison.monthlySavings < 0 ? 'Costs ' : ''}
                  {formatDollars(result.comparison.monthlySavings)}/mo
                </div>
                <div className="text-xs text-gray-500">by paying off the second</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Pricing Difference</div>
                <div className={`text-lg font-bold ${result.comparison.pricingDifference > 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {formatDollars(result.comparison.pricingDifference)}
                </div>
                <div className="text-xs text-gray-500">saved in LLPA adjustments</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Break-Even</div>
                <div className="text-lg font-bold text-gray-700">
                  {result.comparison.breakEvenMonths ? `${result.comparison.breakEvenMonths} months` : '—'}
                </div>
                <div className="text-xs text-gray-500">to recoup closing costs</div>
              </div>
            </div>
          </div>

          {/* Explainer */}
          <div className="text-xs text-gray-500 space-y-2">
            <p>
              <strong>Why does keeping a second lien cost more?</strong> When you refinance with a second mortgage
              or HELOC still in place, lenders treat the combined loan-to-value (CLTV) as your risk level, not
              just the first mortgage LTV. Plus, there&apos;s an additional pricing adjustment just for having
              subordinate financing — typically 0.625 to 1.875 points depending on your LTV.
            </p>
            <p>
              Rates shown are estimates based on standard GSE pricing adjustments. Your actual rate depends on
              the full scenario including lender, loan type, and underwriting. Contact us for a precise quote.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
