'use client';

import { useState, useMemo } from 'react';
import { useScenario } from './ScenarioContext';
import { runOptimizerSweep } from '@/lib/hecm/optimizer';

const fmt = (n, dec = 0) => {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
};

const fmtDollar = (n) => {
  if (n === null || n === undefined) return '—';
  return '$' + fmt(n, 0);
};

export default function OptimizerGrid() {
  const { state, age } = useScenario();
  const [targetComp, setTargetComp] = useState(5000);
  const [collapsed, setCollapsed] = useState(false);

  const sweep = useMemo(() => {
    if (!age || !state.homeValue || !state.tenYearCMT) return null;
    return runOptimizerSweep({
      age,
      homeValue: state.homeValue,
      fhaLimit: state.fhaLimit,
      existingLiens: state.existingLiens,
      origFee: state.origFee,
      thirdPartyCosts: state.thirdPartyCosts,
      oneYearCMT: state.oneYearCMT,
      tenYearCMT: state.tenYearCMT,
      mipRate: state.mipRate,
      targetComp,
    });
  }, [age, state.homeValue, state.fhaLimit, state.existingLiens, state.origFee,
      state.thirdPartyCosts, state.oneYearCMT, state.tenYearCMT, state.mipRate, targetComp]);

  if (!sweep) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 print:hidden">
        <h3 className="text-sm font-semibold text-ink-mid">FOA Margin Optimizer</h3>
        <p className="text-xs text-ink-subtle mt-1">Enter borrower age, home value, and CMT rates to see the optimizer grid.</p>
      </div>
    );
  }

  const { rows, sweetSpot, borrowerBest, viable } = sweep;

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden print:hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-surface-alt border-b cursor-pointer"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-ink-mid">FOA Margin Optimizer</h3>
          {sweetSpot && (
            <span className="text-xs bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded-full font-medium">
              Sweet Spot: {sweetSpot.margin}% &rarr; {fmtDollar(sweetSpot.compDollars)} comp
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-ink-subtle" onClick={e => e.stopPropagation()}>
            Target Comp: $
            <input
              type="number"
              value={targetComp}
              onChange={(e) => setTargetComp(parseFloat(e.target.value) || 0)}
              className="w-16 ml-1 px-1 py-0.5 text-xs border border-gray-300 rounded"
              step={500}
              min={0}
            />
          </label>
          <span className="text-ink-subtle text-sm">{collapsed ? '+' : '−'}</span>
        </div>
      </div>

      {!collapsed && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-ink-subtle bg-surface-alt border-b">
                <th className="px-3 py-2 text-left font-medium">Margin</th>
                <th className="px-2 py-2 text-right font-medium">Exp Rate</th>
                <th className="px-2 py-2 text-right font-medium">PLF</th>
                <th className="px-2 py-2 text-right font-medium">PL</th>
                <th className="px-2 py-2 text-right font-medium">PLU</th>
                <th className="px-2 py-2 text-right font-medium">Bucket</th>
                <th className="px-2 py-2 text-right font-medium">Premium</th>
                <th className="px-2 py-2 text-right font-medium">Comp $</th>
                <th className="px-2 py-2 text-right font-medium">Available</th>
                <th className="px-2 py-2 text-right font-medium">LOC Growth</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const isSweetSpot = sweetSpot && row.margin === sweetSpot.margin;
                const isBorrowerBest = borrowerBest && row.margin === borrowerBest.margin;

                return (
                  <tr
                    key={i}
                    className={`border-b ${
                      !row.viable ? 'bg-red-50 text-ink-subtle' :
                      isSweetSpot ? 'bg-cyan-50 font-semibold' :
                      isBorrowerBest ? 'bg-emerald-50' :
                      ''
                    }`}
                  >
                    <td className="px-3 py-1.5 font-mono">
                      {row.margin}%
                      {isSweetSpot && <span className="ml-1 text-cyan-600" title="Sweet spot">*</span>}
                      {isBorrowerBest && <span className="ml-1 text-emerald-600" title="Borrower best">+</span>}
                    </td>
                    {row.viable ? (
                      <>
                        <td className="px-2 py-1.5 text-right font-mono">{row.expectedRate?.toFixed(3)}</td>
                        <td className="px-2 py-1.5 text-right font-mono">{row.plf?.toFixed(4)}</td>
                        <td className="px-2 py-1.5 text-right font-mono">{fmtDollar(row.pl)}</td>
                        <td className="px-2 py-1.5 text-right font-mono">{(row.plu * 100).toFixed(1)}%</td>
                        <td className="px-2 py-1.5 text-right font-mono">{row.bucket}</td>
                        <td className="px-2 py-1.5 text-right font-mono">{row.premium?.toFixed(3)}</td>
                        <td className="px-2 py-1.5 text-right font-mono font-medium">{fmtDollar(row.compDollars)}</td>
                        <td className="px-2 py-1.5 text-right font-mono">{fmtDollar(row.availableFunds)}</td>
                        <td className="px-2 py-1.5 text-right font-mono">{row.locGrowth?.toFixed(2)}%</td>
                      </>
                    ) : (
                      <td colSpan={9} className="px-2 py-1.5 text-center italic">{row.reason}</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Legend */}
          <div className="px-3 py-2 bg-surface-alt border-t flex items-center gap-4 text-xs text-ink-subtle">
            <span><span className="text-cyan-600 font-semibold">*</span> Sweet Spot — closest to ${fmt(targetComp)} target comp</span>
            <span><span className="text-emerald-600 font-semibold">+</span> Borrower Best — max available funds above target</span>
            <span className="ml-auto">{viable.length} of {rows.length} margins viable</span>
          </div>
        </div>
      )}
    </div>
  );
}
