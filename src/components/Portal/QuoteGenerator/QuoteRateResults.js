'use client';

import { useState, useCallback } from 'react';

export default function QuoteRateResults({ pricing, selectedRates, onSelectRates, onReprice, loading, onNext }) {
  const [showAll, setShowAll] = useState(false);
  const results = pricing?.results || [];
  const displayed = showAll ? results : results.slice(0, 20);

  const toggleRate = useCallback((rate) => {
    const exists = selectedRates.find(r => r.rate === rate.rate && r.lender === rate.lender && r.program === rate.program);
    if (exists) {
      onSelectRates(selectedRates.filter(r => !(r.rate === rate.rate && r.lender === rate.lender && r.program === rate.program)));
    } else if (selectedRates.length < 3) {
      onSelectRates([...selectedRates, {
        rate: rate.rate,
        price: rate.finalPrice,
        lender: rate.lender,
        lenderCode: rate.lenderCode || rate.lender,
        program: rate.program,
        investor: rate.investor,
        tier: rate.tier,
        lockDays: 30,
        monthlyPI: rate.monthlyPI || calculatePI(rate.baseLoanAmount || rate.effectiveLoanAmount, rate.rate, 30),
        rebateDollars: rate.rebateDollars || 0,
        discountDollars: rate.discountDollars || 0,
        compDollars: rate.compDollars || 0,
        lenderFee: rate.lenderFee || 0,
        breakdown: rate.breakdown || [],
      }]);
    }
  }, [selectedRates, onSelectRates]);

  const isSelected = (r) =>
    selectedRates.some(s => s.rate === r.rate && s.lender === r.lender && s.program === r.program);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Rate Results</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {pricing?.resultCount || 0} rates found | Effective: {pricing?.effectiveDate || 'N/A'} | Select up to 3
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onReprice}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium text-cyan-600 bg-cyan-50 rounded-lg hover:bg-cyan-100 disabled:opacity-50"
          >
            {loading ? 'Pricing...' : 'Re-price'}
          </button>
          <span className="text-xs text-gray-400">{selectedRates.length}/3 selected</span>
        </div>
      </div>

      {/* Rate table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="w-8 px-2 py-2"></th>
              <th className="px-3 py-2 text-left">Rate</th>
              <th className="px-3 py-2 text-left">Lender</th>
              <th className="px-3 py-2 text-left">Program</th>
              <th className="px-3 py-2 text-right">Price</th>
              <th className="px-3 py-2 text-right">Credit/Cost</th>
              <th className="px-3 py-2 text-right">Lender Fee</th>
              <th className="px-3 py-2 text-right">Monthly P&I</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {displayed.map((r, i) => {
              const selected = isSelected(r);
              const isPar = Math.abs(r.finalPrice - 100) < 0.125;
              const isRebate = r.finalPrice > 100;

              return (
                <tr
                  key={i}
                  onClick={() => toggleRate(r)}
                  className={`cursor-pointer transition-colors ${
                    selected ? 'bg-cyan-50' : 'hover:bg-gray-50'
                  } ${isPar ? 'font-medium' : ''}`}
                >
                  <td className="px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={selected}
                      readOnly
                      className="w-3.5 h-3.5 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                    />
                  </td>
                  <td className="px-3 py-2 font-mono font-medium">{r.rate.toFixed(3)}%</td>
                  <td className="px-3 py-2 capitalize">{r.lender}</td>
                  <td className="px-3 py-2">
                    <span>{r.program}</span>
                    {isPar && <span className="ml-1 px-1 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-medium">PAR</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{r.finalPrice?.toFixed(4)}</td>
                  <td className={`px-3 py-2 text-right font-mono ${isRebate ? 'text-green-600' : 'text-red-600'}`}>
                    {isRebate
                      ? `+$${(r.rebateDollars || 0).toLocaleString()}`
                      : `-$${(r.discountDollars || 0).toLocaleString()}`
                    }
                  </td>
                  <td className="px-3 py-2 text-right font-mono">${(r.lenderFee || 0).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    ${calculatePI(r.baseLoanAmount || r.effectiveLoanAmount || 400000, r.rate, 30).toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {results.length > 20 && !showAll && (
        <div className="px-6 py-2 border-t border-gray-100">
          <button onClick={() => setShowAll(true)} className="text-xs text-cyan-600 hover:underline">
            Show all {results.length} rates
          </button>
        </div>
      )}

      {/* Selected rates summary + Next */}
      {selectedRates.length > 0 && (
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="flex gap-3">
            {selectedRates.map((s, i) => (
              <div key={i} className="px-3 py-1.5 bg-white rounded-lg border border-cyan-200 text-xs">
                <span className="font-mono font-medium">{s.rate.toFixed(3)}%</span>
                <span className="text-gray-400 ml-1">| {s.lender}</span>
              </div>
            ))}
          </div>
          <button
            onClick={onNext}
            className="px-5 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-700 transition-colors"
          >
            Next: Fees & Preview
          </button>
        </div>
      )}
    </div>
  );
}

function calculatePI(principal, annualRate, termYears) {
  const monthlyRate = annualRate / 100 / 12;
  const n = termYears * 12;
  if (monthlyRate === 0) return Math.round(principal / n);
  const pmt = principal * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
  return Math.round(pmt);
}
