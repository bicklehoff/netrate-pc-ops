'use client';

import { useState } from 'react';

export default function QuoteFeeEditor({ fees, onFeesChange, selectedRates, scenario, quoteId, onSaveDraft, loading }) {
  const [expanded, setExpanded] = useState({});

  const toggle = (section) => setExpanded(prev => ({ ...prev, [section]: !prev[section] }));

  const updateItem = (sectionKey, itemIndex, newAmount) => {
    const updated = { ...fees };
    const section = { ...updated[sectionKey] };
    const items = [...section.items];
    items[itemIndex] = { ...items[itemIndex], amount: Number(newAmount) || 0 };
    section.items = items;
    section.total = items.reduce((sum, i) => sum + i.amount, 0);
    updated[sectionKey] = section;
    updated.totalClosingCosts = ['sectionA', 'sectionB', 'sectionC', 'sectionE', 'sectionF', 'sectionG']
      .reduce((sum, k) => sum + (updated[k]?.total || 0), 0);
    onFeesChange(updated);
  };

  // Monthly payment calc
  const primaryRate = selectedRates[0];
  const monthlyPI = primaryRate ? calculatePI(Number(scenario.loanAmount), primaryRate.rate, scenario.term || 30) : 0;
  const monthlyTax = fees?.monthlyTax || 0;
  const monthlyIns = fees?.monthlyInsurance || 0;
  const totalMonthly = monthlyPI + monthlyTax + monthlyIns;

  // Cash to close (purchase only)
  const downPayment = scenario.purpose === 'purchase'
    ? (Number(scenario.propertyValue) || 0) - (Number(scenario.loanAmount) || 0)
    : 0;
  const rebate = primaryRate?.rebateDollars || 0;
  const discount = primaryRate?.discountDollars || 0;
  const cashToClose = downPayment + (fees?.totalClosingCosts || 0) + discount - rebate;

  const sections = ['sectionA', 'sectionB', 'sectionC', 'sectionE', 'sectionF', 'sectionG'];

  return (
    <div className="space-y-4">
      {/* Rate Summary Cards */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Selected Rates</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {selectedRates.map((r, i) => (
            <div key={i} className={`p-4 rounded-lg border ${i === 0 ? 'border-cyan-300 bg-cyan-50' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg font-mono font-bold">{r.rate.toFixed(3)}%</span>
                {i === 0 && <span className="text-[10px] font-medium text-cyan-700 bg-cyan-100 px-2 py-0.5 rounded-full">PRIMARY</span>}
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                <div>{r.program}</div>
                <div className="capitalize">{r.lender} | {r.investor} {r.tier}</div>
                <div className="font-mono">P&I: ${r.monthlyPI?.toLocaleString()}/mo</div>
                {r.rebateDollars > 0 && <div className="text-green-600">Credit: ${r.rebateDollars.toLocaleString()}</div>}
                {r.discountDollars > 0 && <div className="text-red-600">Discount: ${r.discountDollars.toLocaleString()}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fee Sections */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Fee Breakdown</h3>
          <p className="text-xs text-gray-500 mt-0.5">Edit any line item — totals update automatically</p>
        </div>
        <div className="divide-y divide-gray-100">
          {sections.map(key => {
            const section = fees?.[key];
            if (!section || section.items.length === 0) return null;
            const isOpen = expanded[key] !== false; // default open

            return (
              <div key={key}>
                <button
                  onClick={() => toggle(key)}
                  className="w-full px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-700">{section.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono font-medium">${section.total?.toLocaleString()}</span>
                    <span className="text-gray-400 text-xs">{isOpen ? '\u25B2' : '\u25BC'}</span>
                  </div>
                </button>
                {isOpen && (
                  <div className="px-6 pb-3 space-y-1">
                    {section.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between gap-4">
                        <span className="text-xs text-gray-600 flex-1">{item.label}</span>
                        <div className="relative w-28">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                          <input
                            type="number"
                            value={item.amount}
                            onChange={e => updateItem(key, i, e.target.value)}
                            className="w-full pl-5 pr-2 py-1 text-xs text-right font-mono rounded border-gray-200 focus:ring-cyan-500 focus:border-cyan-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Totals */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Total Closing Costs</span>
            <span className="font-mono font-medium">${(fees?.totalClosingCosts || 0).toLocaleString()}</span>
          </div>
          {scenario.purpose === 'purchase' && (
            <>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Down Payment</span>
                <span className="font-mono">${downPayment.toLocaleString()}</span>
              </div>
              {rebate > 0 && (
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-green-600">Lender Credit</span>
                  <span className="font-mono text-green-600">-${rebate.toLocaleString()}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-red-600">Discount Points</span>
                  <span className="font-mono text-red-600">+${discount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-300">
                <span>Estimated Cash to Close</span>
                <span className="font-mono">${cashToClose.toLocaleString()}</span>
              </div>
            </>
          )}
          <div className="flex justify-between text-sm font-bold pt-2 mt-2 border-t border-gray-300">
            <span>Monthly Payment (PITI)</span>
            <span className="font-mono">${totalMonthly.toLocaleString()}/mo</span>
          </div>
          <div className="text-[10px] text-gray-400 mt-1">
            P&I: ${monthlyPI.toLocaleString()} + Tax: ${monthlyTax.toLocaleString()} + Insurance: ${monthlyIns.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-400">
          Quote ID: {quoteId ? quoteId.slice(0, 8) : 'N/A'}
        </div>
        <div className="flex gap-3">
          <button
            onClick={onSaveDraft}
            disabled={loading}
            className="px-5 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Saving...' : 'Save Draft'}
          </button>
          <button
            disabled
            className="px-5 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium opacity-50 cursor-not-allowed"
            title="Send to Borrower — coming in Phase 4"
          >
            Send to Borrower
          </button>
        </div>
      </div>
    </div>
  );
}

function calculatePI(principal, annualRate, termYears) {
  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  if (r === 0) return Math.round(principal / n);
  return Math.round(principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
}
