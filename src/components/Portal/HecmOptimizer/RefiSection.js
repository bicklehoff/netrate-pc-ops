'use client';

import { useState, useMemo } from 'react';
import { useScenario } from './ScenarioContext';

function Input({ label, value, onChange, type = 'text', className = '', inputClass = '', ...rest }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-ink-subtle mb-0.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        className={`w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none ${inputClass}`}
        {...rest}
      />
    </div>
  );
}

const fmtDollar = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

export default function RefiSection() {
  const { state, setField, results } = useScenario();
  const [collapsed, setCollapsed] = useState(true);

  const handleNum = (field) => (e) => setField(field, parseFloat(e.target.value) || 0);
  const handleText = (field) => (e) => setField(field, e.target.value);

  // Refi analysis: compare old loan vs new scenarios
  const refiAnalysis = useMemo(() => {
    if (!state.isRefi || !state.origMCA || !state.origExpectedRate) return null;

    const origPL = state.currentPL || 0;
    const origBalance = state.currentBalance || 0;
    const origPayoff = state.currentPayoff || origBalance;
    const unclaimedBenefit = Math.max(origPL - origPayoff, 0);

    return results.map((r) => {
      if (!r) return null;
      const newPL = r.principalLimit;
      const plIncrease = newPL - origPL;
      const additionalBenefit = Math.max(r.cashToBorrower, 0);
      return {
        newPL,
        plIncrease,
        origPL,
        origPayoff,
        unclaimedBenefit,
        additionalBenefit,
        newRate: r.expectedRate,
        origRate: state.origExpectedRate,
        rateChange: r.expectedRate - state.origExpectedRate,
      };
    });
  }, [state, results]);

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden print:hidden">
      {/* Toggle header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-surface-alt border-b cursor-pointer"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-ink-mid">Refinance Analysis</h3>
          <label className="flex items-center gap-1.5 text-xs" onClick={e => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={state.isRefi}
              onChange={(e) => setField('isRefi', e.target.checked)}
              className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
            />
            This is a refinance
          </label>
        </div>
        <span className="text-ink-subtle text-sm">{collapsed ? '+' : '−'}</span>
      </div>

      {!collapsed && state.isRefi && (
        <div className="p-4 space-y-4">
          {/* Current loan inputs */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <Input label="Current Lender" value={state.currentLender} onChange={handleText('currentLender')} inputClass="bg-yellow-50" />
            <Input label="Loan Number" value={state.loanNumber} onChange={handleText('loanNumber')} inputClass="bg-yellow-50" />
            <Input label="Orig MCA" type="number" value={state.origMCA || ''} onChange={handleNum('origMCA')} inputClass="bg-yellow-50" />
            <Input label="Orig Margin" type="number" value={state.origMargin || ''} onChange={handleNum('origMargin')} step="0.001" inputClass="bg-yellow-50" />
            <Input label="Orig Expected Rate" type="number" value={state.origExpectedRate || ''} onChange={handleNum('origExpectedRate')} step="0.001" inputClass="bg-yellow-50" />
            <Input label="Orig Date" type="date" value={state.origDate} onChange={handleText('origDate')} inputClass="bg-yellow-50" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <Input label="Current PL" type="number" value={state.currentPL || ''} onChange={handleNum('currentPL')} inputClass="bg-yellow-50" />
            <Input label="Current Balance" type="number" value={state.currentBalance || ''} onChange={handleNum('currentBalance')} inputClass="bg-yellow-50" />
            <Input label="Current Payoff" type="number" value={state.currentPayoff || ''} onChange={handleNum('currentPayoff')} inputClass="bg-yellow-50" />
            <Input label="Orig UFMIP" type="number" value={state.origUFMIP || ''} onChange={handleNum('origUFMIP')} inputClass="bg-yellow-50" />
            <Input label="Orig MIP%" type="number" value={state.origMIP || ''} onChange={handleNum('origMIP')} step="0.01" inputClass="bg-yellow-50" />
          </div>

          {/* Refi comparison table */}
          {refiAnalysis && (
            <div className="mt-3">
              <h4 className="text-xs font-semibold text-ink-mid mb-2">Refi Comparison</h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-ink-subtle bg-surface-alt border-b">
                    <th className="px-3 py-1.5 text-left font-medium">Metric</th>
                    {results.map((_, i) => (
                      <th key={i} className="px-2 py-1.5 text-right font-medium">Option {['A','B','C'][i]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  <tr>
                    <td className="px-3 py-1.5 text-ink-mid">Original PL</td>
                    {refiAnalysis.map((a, i) => (
                      <td key={i} className="px-2 py-1.5 text-right font-mono">{a ? fmtDollar(a.origPL) : '—'}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-3 py-1.5 text-ink-mid">New PL</td>
                    {refiAnalysis.map((a, i) => (
                      <td key={i} className="px-2 py-1.5 text-right font-mono">{a ? fmtDollar(a.newPL) : '—'}</td>
                    ))}
                  </tr>
                  <tr className="bg-cyan-50 font-medium">
                    <td className="px-3 py-1.5 text-ink-mid">PL Increase</td>
                    {refiAnalysis.map((a, i) => (
                      <td key={i} className={`px-2 py-1.5 text-right font-mono ${a && a.plIncrease < 0 ? 'text-red-600' : ''}`}>
                        {a ? fmtDollar(a.plIncrease) : '—'}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-3 py-1.5 text-ink-mid">Unclaimed Benefit</td>
                    {refiAnalysis.map((a, i) => (
                      <td key={i} className="px-2 py-1.5 text-right font-mono">{a ? fmtDollar(a.unclaimedBenefit) : '—'}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-3 py-1.5 text-ink-mid">Additional Benefit</td>
                    {refiAnalysis.map((a, i) => (
                      <td key={i} className="px-2 py-1.5 text-right font-mono">{a ? fmtDollar(a.additionalBenefit) : '—'}</td>
                    ))}
                  </tr>
                  <tr>
                    <td className="px-3 py-1.5 text-ink-mid">Rate Change</td>
                    {refiAnalysis.map((a, i) => (
                      <td key={i} className={`px-2 py-1.5 text-right font-mono ${a && a.rateChange > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {a ? (a.rateChange > 0 ? '+' : '') + a.rateChange.toFixed(3) + '%' : '—'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
