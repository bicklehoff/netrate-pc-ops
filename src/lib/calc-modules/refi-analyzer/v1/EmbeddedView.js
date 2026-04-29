/**
 * refi-analyzer v1 — EmbeddedView.
 *
 * Compact card for /portal/quote/[id]. Pure presentational; consumes
 * the frozen result. Skips the educational copy + CTA blocks since the
 * quote view's chrome handles those — this card surfaces the verdict
 * + 4 key numbers (current pmt, new pmt, monthly savings, break-even)
 * and the net-savings-over-hold figure.
 */

import { fmtDollars } from '@/lib/formatters';

const VERDICT_STYLE = {
  good: { color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  bad: { color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  neutral: { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
};

/**
 * @param {{
 *   scenario: object,
 *   config: { closing_costs: number, hold_years: number },
 *   result: object,
 * }} props
 */
export default function EmbeddedView({ config, result }) {
  if (!result) return null;
  const tone = VERDICT_STYLE[result.verdictTone] || VERDICT_STYLE.neutral;

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-900">Refi Recoup Analysis</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Break-even on the proposed rate vs. holding {config.hold_years}-year horizon.
        </p>
      </div>

      <div className={`px-5 py-3 border-b border-gray-100 text-center ${tone.bg}`}>
        <div className={`text-sm font-bold ${tone.color}`}>{result.verdict}</div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-gray-100">
        <div className="p-4 bg-white">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Monthly Savings</div>
          <div className="text-lg font-semibold text-green-700 mt-1 tabular-nums">{fmtDollars(result.monthlySavings)}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            {fmtDollars(result.currentPmt)}/mo &rarr; {fmtDollars(result.newPmt)}/mo
          </div>
        </div>
        <div className="p-4 bg-white">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Break-Even</div>
          <div className="text-lg font-semibold text-gray-900 mt-1 tabular-nums">
            {result.breakEvenMonths == null ? '—' : `${result.breakEvenMonths} mo`}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">on {fmtDollars(config.closing_costs)} costs</div>
        </div>
        <div className="p-4 bg-white">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Interest Saved</div>
          <div className="text-lg font-semibold text-green-700 mt-1 tabular-nums">{fmtDollars(result.interestSaved)}</div>
          <div className="text-xs text-gray-400 mt-0.5">over life of loan</div>
        </div>
        <div className="p-4 bg-white">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Net Savings ({config.hold_years}yr hold)</div>
          <div className="text-lg font-semibold text-gray-900 mt-1 tabular-nums">{fmtDollars(result.netSavingsOverHold)}</div>
          <div className="text-xs text-gray-400 mt-0.5">after closing costs</div>
        </div>
      </div>
    </div>
  );
}
