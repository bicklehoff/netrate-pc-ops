'use client';

import { useState, useCallback, useMemo } from 'react';

/**
 * Find sweet spot rates for a set of rates within a program.
 * CHARGE SIDE: cheapest cost per 1/8th of rate drop from par
 * CREDIT SIDE: most credit per 1/8th of rate increase from par
 */
function findSweetSpots(rates) {
  // Find par rate (closest to 100)
  const parRate = rates.reduce((best, r) =>
    !best || Math.abs(r.finalPrice - 100) < Math.abs(best.finalPrice - 100) ? r : best, null);

  if (!parRate) return { chargeSweet: null, creditSweet: null, parRate: null };

  let chargeSweet = null;
  let bestCostPerEighth = Infinity;
  let creditSweet = null;
  let bestCreditPerEighth = 0;

  for (const r of rates) {
    // Charge side — lower rate than par, borrower pays discount
    if (r.rate < parRate.rate && r.discountDollars > 0) {
      const eighthsBelow = (parRate.rate - r.rate) / 0.125;
      if (eighthsBelow > 0) {
        const costPerEighth = r.discountDollars / eighthsBelow;
        if (costPerEighth < bestCostPerEighth) {
          bestCostPerEighth = costPerEighth;
          chargeSweet = r;
        }
      }
    }
    // Credit side — higher rate than par, borrower gets rebate
    if (r.rate > parRate.rate && r.rebateDollars > 0) {
      const eighthsAbove = (r.rate - parRate.rate) / 0.125;
      if (eighthsAbove > 0) {
        const creditPerEighth = r.rebateDollars / eighthsAbove;
        if (creditPerEighth > bestCreditPerEighth) {
          bestCreditPerEighth = creditPerEighth;
          creditSweet = r;
        }
      }
    }
  }

  return { chargeSweet, creditSweet, parRate };
}

export default function QuoteRateResults({ pricing, selectedRates, onSelectRates, onReprice, loading, onNext, borrowerPaid, escrowsWaived, onEscrowsWaivedChange: _onEscrowsWaivedChange }) {
  const [viewMode, setViewMode] = useState('programs'); // 'programs' | 'all'
  const [expandedPrograms, setExpandedPrograms] = useState(new Set());
  const [showAll, setShowAll] = useState(false);
  const results = pricing?.results || [];

  // Group results by program name
  const programGroups = useMemo(() => {
    const groups = new Map();
    for (const r of results) {
      const key = r.program || 'Unknown';
      if (!groups.has(key)) {
        groups.set(key, {
          program: key,
          lender: r.lender,
          investor: r.investor,
          tier: r.tier,
          rates: [],
          bestRate: null,
          parRate: null,
        });
      }
      const g = groups.get(key);
      g.rates.push(r);
      if (!g.bestRate || r.finalPrice > g.bestRate.finalPrice) g.bestRate = r;
      if (!g.parRate || Math.abs(r.finalPrice - 100) < Math.abs(g.parRate.finalPrice - 100)) g.parRate = r;
    }
    // Compute sweet spots per program
    for (const g of groups.values()) {
      const spots = findSweetSpots(g.rates);
      g.chargeSweet = spots.chargeSweet;
      g.creditSweet = spots.creditSweet;
    }
    // Sort by PAR rate quality descending (best par pricing at the top)
    // This gives the most meaningful comparison — same rate, which lender prices it best
    return Array.from(groups.values()).sort((a, b) => {
      const aScore = a.parRate?.finalPrice ?? 0;
      const bScore = b.parRate?.finalPrice ?? 0;
      return bScore - aScore;
    });
  }, [results]);

  // Global sweet spots for the flat "All Rates" view
  const globalSweets = useMemo(() => findSweetSpots(results), [results]);

  const toggleProgram = (program) => {
    setExpandedPrograms(prev => {
      const next = new Set(prev);
      if (next.has(program)) next.delete(program); else next.add(program);
      return next;
    });
  };

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
        monthlyPI: calculatePI(rate.baseLoanAmount || rate.effectiveLoanAmount, rate.rate, 30),
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
          <h3 className="text-sm font-bold text-gray-900">
            {viewMode === 'programs'
              ? `${programGroups.length} Eligible Programs`
              : `${results.length} Rates`
            }
          </h3>
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
            Effective: {pricing?.effectiveDate || 'N/A'} | All prices after LLPA adjustments
            {borrowerPaid && <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">BORROWER-PAID (no comp)</span>}
            {escrowsWaived && <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded font-medium">ESCROWS WAIVED</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('programs')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === 'programs' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              Programs
            </button>
            <button
              onClick={() => setViewMode('all')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
            >
              All Rates
            </button>
          </div>
          <button
            onClick={onReprice}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium text-cyan-600 bg-cyan-50 rounded-lg hover:bg-cyan-100 disabled:opacity-50"
          >
            {loading ? 'Pricing...' : 'Re-price'}
          </button>
          <span className="text-xs text-gray-400">{selectedRates.length}/3</span>
        </div>
      </div>

      {/* Program View */}
      {viewMode === 'programs' ? (
        <div className="divide-y divide-gray-50">
          {programGroups.map((g) => {
            const expanded = expandedPrograms.has(g.program);
            const par = g.parRate;
            const best = g.bestRate;

            return (
              <div key={g.program}>
                {/* Program header row */}
                <div
                  className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => toggleProgram(g.program)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{g.program}</div>
                    <div className="text-xs text-gray-500 capitalize">{g.lender} | {g.investor} {g.tier} | {g.rates.length} rates</div>
                  </div>
                  <div className="flex items-center gap-4 ml-4">
                    <div className="text-right">
                      <div className="text-xs text-gray-400">PAR</div>
                      <div className="text-sm font-mono font-bold">{par?.rate?.toFixed(3)}%</div>
                    </div>
                    {g.chargeSweet && (
                      <div className="text-right">
                        <div className="text-xs text-blue-500">Buy-Down Sweet</div>
                        <div className="text-sm font-mono font-bold text-blue-700">{g.chargeSweet.rate.toFixed(3)}%</div>
                      </div>
                    )}
                    {g.creditSweet && (
                      <div className="text-right">
                        <div className="text-xs text-purple-500">Credit Sweet</div>
                        <div className="text-sm font-mono font-bold text-purple-700">{g.creditSweet.rate.toFixed(3)}%</div>
                      </div>
                    )}
                    <div className="text-right">
                      <div className="text-xs text-gray-400">Best (adj.)</div>
                      <div className={`text-sm font-mono font-bold ${best?.finalPrice > 100 ? 'text-green-600' : 'text-gray-900'}`}>
                        {best?.finalPrice?.toFixed(3)}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleRate(par || best); }}
                      className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                        isSelected(par || best)
                          ? 'bg-cyan-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-cyan-50 hover:text-cyan-700'
                      }`}
                    >
                      {isSelected(par || best) ? 'Selected' : 'Select PAR'}
                    </button>
                    <span className="text-gray-400 text-xs">{expanded ? '\u25B2' : '\u25BC'}</span>
                  </div>
                </div>

                {/* Expanded rates */}
                {expanded && (
                  <div className="bg-gray-50 px-6 pb-3">
                    <table className="w-full text-xs">
                      <thead className="text-gray-400">
                        <tr>
                          <th className="w-8 py-1"></th>
                          <th className="py-1 text-left">Rate</th>
                          <th className="py-1 text-right">Price</th>
                          <th className="py-1 text-right">Credit/Cost</th>
                          <th className="py-1 text-right">Monthly P&I</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.rates.map((r, i) => {
                          const selected = isSelected(r);
                          const rIsPar = Math.abs(r.finalPrice - 100) < 0.125;
                          const isRebate = r.finalPrice > 100;
                          return (
                            <tr
                              key={i}
                              onClick={() => toggleRate(r)}
                              className={`cursor-pointer ${selected ? 'bg-cyan-50' : 'hover:bg-white'} ${rIsPar ? 'font-semibold' : ''}`}
                            >
                              <td className="py-1.5">
                                <input type="checkbox" checked={selected} readOnly className="w-3 h-3 rounded border-gray-300 text-cyan-600" />
                              </td>
                              <td className="py-1.5 font-mono">
                                {r.rate.toFixed(3)}%
                                {rIsPar && <span className="ml-1 px-1 bg-green-100 text-green-700 rounded text-[9px]">PAR</span>}
                                {g.chargeSweet && r.rate === g.chargeSweet.rate && <span className="ml-1 px-1 bg-blue-100 text-blue-700 rounded text-[9px]">SWEET SPOT</span>}
                                {g.creditSweet && r.rate === g.creditSweet.rate && <span className="ml-1 px-1 bg-purple-100 text-purple-700 rounded text-[9px]">SWEET SPOT</span>}
                              </td>
                              <td className="py-1.5 text-right font-mono">{r.finalPrice?.toFixed(4)}</td>
                              <td className={`py-1.5 text-right font-mono ${isRebate ? 'text-green-600' : 'text-red-600'}`}>
                                {isRebate ? `+$${(r.rebateDollars || 0).toLocaleString()}` : `-$${(r.discountDollars || 0).toLocaleString()}`}
                              </td>
                              <td className="py-1.5 text-right font-mono">
                                ${calculatePI(r.baseLoanAmount || r.effectiveLoanAmount || 400000, r.rate, 30).toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* All Rates View (flat table) */
        <>
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
                {(showAll ? results : results.slice(0, 20)).map((r, i) => {
                  const selected = isSelected(r);
                  const isPar = Math.abs(r.finalPrice - 100) < 0.125;
                  const isRebate = r.finalPrice > 100;
                  return (
                    <tr
                      key={i}
                      onClick={() => toggleRate(r)}
                      className={`cursor-pointer transition-colors ${selected ? 'bg-cyan-50' : 'hover:bg-gray-50'} ${isPar ? 'font-medium' : ''}`}
                    >
                      <td className="px-2 py-2 text-center">
                        <input type="checkbox" checked={selected} readOnly className="w-3.5 h-3.5 rounded border-gray-300 text-cyan-600" />
                      </td>
                      <td className="px-3 py-2 font-mono font-medium">{r.rate.toFixed(3)}%</td>
                      <td className="px-3 py-2 capitalize">{r.lender}</td>
                      <td className="px-3 py-2">
                        <span>{r.program}</span>
                        {isPar && <span className="ml-1 px-1 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-medium">PAR</span>}
                        {globalSweets.chargeSweet && r.rate === globalSweets.chargeSweet.rate && r.program === globalSweets.chargeSweet.program && <span className="ml-1 px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-medium">SWEET SPOT</span>}
                        {globalSweets.creditSweet && r.rate === globalSweets.creditSweet.rate && r.program === globalSweets.creditSweet.program && <span className="ml-1 px-1 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-medium">SWEET SPOT</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{r.finalPrice?.toFixed(4)}</td>
                      <td className={`px-3 py-2 text-right font-mono ${isRebate ? 'text-green-600' : 'text-red-600'}`}>
                        {isRebate ? `+$${(r.rebateDollars || 0).toLocaleString()}` : `-$${(r.discountDollars || 0).toLocaleString()}`}
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
        </>
      )}

      {/* Selected rates summary + Next */}
      {selectedRates.length > 0 && (
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-900 rounded-b-xl flex items-center justify-between">
          <div className="flex gap-3">
            {selectedRates.map((s, i) => (
              <div key={i} className="px-3 py-1.5 bg-gray-800 rounded-lg border border-gray-700 text-xs text-white">
                <span className="font-mono font-bold">{s.rate.toFixed(3)}%</span>
                <span className="text-gray-400 ml-1.5">| {s.program?.split(' ').slice(0, 3).join(' ')}</span>
              </div>
            ))}
          </div>
          <button
            onClick={onNext}
            className="px-6 py-2 bg-cyan-500 text-white rounded-lg text-sm font-bold hover:bg-cyan-400 transition-colors tracking-wide"
          >
            NEXT: FEES & PREVIEW
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
