'use client';

import { useState, useMemo } from 'react';
import { useScenario } from './ScenarioContext';

const fmt = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '0.00';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function FeeRow({ fee, index, onUpdate, onRemove, isCustom }) {
  const borrower = Math.max((fee.cost || 0) - (fee.poc || 0), 0);

  return (
    <tr className="border-b border-gray-100 hover:bg-surface-alt/50 group">
      {/* HUD Line */}
      <td className="px-2 py-1 text-xs text-ink-subtle w-12 text-right">
        {isCustom ? (
          <input
            type="text"
            value={fee.hudLine}
            onChange={(e) => onUpdate(index, 'hudLine', e.target.value)}
            className="w-full text-xs text-right bg-yellow-50 border border-yellow-200 rounded px-1 py-0.5"
            placeholder="—"
          />
        ) : (
          fee.hudLine
        )}
      </td>

      {/* Name */}
      <td className="px-2 py-1 text-xs text-ink-mid min-w-[180px]">
        {isCustom ? (
          <input
            type="text"
            value={fee.name}
            onChange={(e) => onUpdate(index, 'name', e.target.value)}
            className="w-full text-xs bg-yellow-50 border border-yellow-200 rounded px-1 py-0.5"
            placeholder="Fee name"
          />
        ) : (
          fee.name
        )}
      </td>

      {/* Payee */}
      <td className="px-2 py-1 text-xs text-ink-subtle min-w-[140px]">
        <input
          type="text"
          value={fee.payee}
          onChange={(e) => onUpdate(index, 'payee', e.target.value)}
          className="w-full text-xs bg-transparent border-0 border-b border-transparent hover:border-gray-200 focus:border-cyan-400 focus:bg-yellow-50 rounded px-1 py-0.5 outline-none transition-colors"
          placeholder="—"
        />
      </td>

      {/* Cost */}
      <td className="px-2 py-1 text-right w-24">
        <input
          type="number"
          step="0.01"
          min="0"
          value={fee.cost || ''}
          onChange={(e) => onUpdate(index, 'cost', parseFloat(e.target.value) || 0)}
          className="w-full text-xs text-right bg-yellow-50 border border-yellow-200 rounded px-1 py-0.5 focus:border-cyan-400 outline-none"
        />
      </td>

      {/* POC */}
      <td className="px-2 py-1 text-right w-24">
        <input
          type="number"
          step="0.01"
          min="0"
          value={fee.poc || ''}
          onChange={(e) => onUpdate(index, 'poc', parseFloat(e.target.value) || 0)}
          className="w-full text-xs text-right bg-yellow-50 border border-yellow-200 rounded px-1 py-0.5 focus:border-cyan-400 outline-none"
        />
      </td>

      {/* Borrower (calculated) */}
      <td className="px-2 py-1 text-xs text-right w-24 font-mono bg-emerald-50/50">
        {fmt(borrower)}
      </td>

      {/* Remove button (only for custom rows) */}
      <td className="px-1 py-1 w-8">
        {isCustom && (
          <button
            onClick={() => onRemove(index)}
            className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
            title="Remove fee"
          >
            ✕
          </button>
        )}
      </td>
    </tr>
  );
}

export default function FeesSection() {
  const { state, setFee, addFee, removeFee, feesTotal } = useScenario();
  const [open, setOpen] = useState(false);

  const { totalCost, totalPoc } = useMemo(() => {
    const fees = state.fees || [];
    return {
      totalCost: fees.reduce((s, f) => s + (f.cost || 0), 0),
      totalPoc: fees.reduce((s, f) => s + (f.poc || 0), 0),
    };
  }, [state.fees]);

  // Count of standard fees (non-custom) to distinguish custom rows
  const standardCount = 21; // Number of DEFAULT_FEES entries

  return (
    <div className="border border-gray-200 rounded-lg bg-white print:border-0">
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-alt transition-colors"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-ink">Fee Calculation</h2>
          <span className="text-xs text-ink-subtle font-mono">
            Total: ${fmt(totalCost)} | POC: ${fmt(totalPoc)} | Borrower: ${fmt(feesTotal)}
          </span>
        </div>
        <span className="text-ink-subtle text-sm">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="px-2 py-1.5 text-xs font-semibold text-ink-subtle text-right w-12">Id</th>
                <th className="px-2 py-1.5 text-xs font-semibold text-ink-subtle text-left">Name</th>
                <th className="px-2 py-1.5 text-xs font-semibold text-ink-subtle text-left">Payee</th>
                <th className="px-2 py-1.5 text-xs font-semibold text-ink-subtle text-right w-24">Cost</th>
                <th className="px-2 py-1.5 text-xs font-semibold text-ink-subtle text-right w-24">POC</th>
                <th className="px-2 py-1.5 text-xs font-semibold text-ink-subtle text-right w-24">Borrower</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {/* Origination fee (read-only, pulled from scenario calc) */}
              <tr className="border-b border-gray-100 bg-surface-alt/50">
                <td className="px-2 py-1 text-xs text-ink-subtle text-right">801</td>
                <td className="px-2 py-1 text-xs text-ink-mid font-medium">Origination fee</td>
                <td className="px-2 py-1 text-xs text-ink-subtle">Broker</td>
                <td className="px-2 py-1 text-xs text-right font-mono bg-emerald-50/50">{fmt(state.origFee)}</td>
                <td className="px-2 py-1 text-xs text-right font-mono text-ink-subtle">0.00</td>
                <td className="px-2 py-1 text-xs text-right font-mono bg-emerald-50/50">{fmt(state.origFee)}</td>
                <td></td>
              </tr>

              {/* MIP (read-only, calculated from MCA) */}
              <tr className="border-b border-gray-100 bg-surface-alt/50">
                <td className="px-2 py-1 text-xs text-ink-subtle text-right">902</td>
                <td className="px-2 py-1 text-xs text-ink-mid font-medium">Mortgage insurance premium</td>
                <td className="px-2 py-1 text-xs text-ink-subtle">HUD</td>
                <td className="px-2 py-1 text-xs text-right font-mono bg-emerald-50/50">
                  {fmt(Math.min(state.homeValue, state.fhaLimit) * 0.02)}
                </td>
                <td className="px-2 py-1 text-xs text-right font-mono text-ink-subtle">0.00</td>
                <td className="px-2 py-1 text-xs text-right font-mono bg-emerald-50/50">
                  {fmt(Math.min(state.homeValue, state.fhaLimit) * 0.02)}
                </td>
                <td></td>
              </tr>

              {/* Separator */}
              <tr>
                <td colSpan="7" className="py-1 border-b border-gray-200"></td>
              </tr>

              {/* Editable fee rows */}
              {(state.fees || []).map((fee, i) => (
                <FeeRow
                  key={i}
                  fee={fee}
                  index={i}
                  onUpdate={setFee}
                  onRemove={removeFee}
                  isCustom={i >= standardCount}
                />
              ))}
            </tbody>

            {/* Add Fee button */}
            <tfoot>
              <tr>
                <td colSpan="7" className="pt-2 pb-1">
                  <button
                    onClick={addFee}
                    className="text-xs text-cyan-600 hover:text-cyan-800 font-medium"
                  >
                    + Add Fee
                  </button>
                </td>
              </tr>

              {/* Totals row (3rd party only, excl origination + MIP) */}
              <tr className="border-t-2 border-gray-300">
                <td colSpan="3" className="px-2 py-2 text-xs font-bold text-ink-mid text-right">
                  Third Party Totals
                </td>
                <td className="px-2 py-2 text-xs text-right font-bold font-mono">{fmt(totalCost)}</td>
                <td className="px-2 py-2 text-xs text-right font-bold font-mono">{fmt(totalPoc)}</td>
                <td className="px-2 py-2 text-xs text-right font-bold font-mono text-cyan-700">{fmt(feesTotal)}</td>
                <td></td>
              </tr>

              {/* Grand total including orig + MIP */}
              <tr className="border-t border-gray-200 bg-surface-alt">
                <td colSpan="3" className="px-2 py-2 text-xs font-bold text-ink text-right">
                  Total Closing Costs
                </td>
                <td className="px-2 py-2 text-xs text-right font-bold font-mono">
                  {fmt(totalCost + (state.origFee || 0) + Math.min(state.homeValue, state.fhaLimit) * 0.02)}
                </td>
                <td className="px-2 py-2 text-xs text-right font-bold font-mono">{fmt(totalPoc)}</td>
                <td className="px-2 py-2 text-xs text-right font-bold font-mono text-cyan-700">
                  {fmt(feesTotal + (state.origFee || 0) + Math.min(state.homeValue, state.fhaLimit) * 0.02)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
