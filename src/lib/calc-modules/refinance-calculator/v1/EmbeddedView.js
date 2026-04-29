/**
 * refinance-calculator v1 — EmbeddedView.
 *
 * Compact card for /portal/quote/[id]. Pure presentational; consumes
 * frozen result. Renders only the preset the MLO chose at send time
 * (from config.active_preset). Skips PresetBar + MiniRateStrip + the
 * full LoanInputs panel — the surrounding quote view supplies that
 * context.
 */

import { fmtDollars } from '@/lib/formatters';

const PRESET_LABEL = {
  noCost: 'No-Cost',
  zeroOop: 'Zero Out of Pocket',
  lowestRate: 'Lowest Rate',
  custom: 'Custom Rate',
};

const PRESET_KEY = {
  noCost: 'noCost',
  zeroOop: 'zeroOop',
  lowestRate: 'lowest',
  custom: 'custom',
};

/**
 * @param {{
 *   scenario: object,
 *   config: { active_preset: string, custom_selected_rate: number | null },
 *   result: object,
 * }} props
 */
export default function EmbeddedView({ config, result }) {
  if (!result?.strategies) return null;
  const preset = config?.active_preset || 'noCost';
  const active = result.strategies[PRESET_KEY[preset]] || result.strategies.noCost;
  if (!active) return null;

  const savingsPositive = active.monthlySavings > 0;
  const inPocket = active.netCashFlow <= 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-900">Refinance Strategy — {PRESET_LABEL[preset]}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{active.lender} · {active.program}</p>
      </div>

      <div className="px-5 py-4 flex items-baseline justify-between border-b border-gray-100">
        <div className="text-3xl font-bold text-gray-900 tabular-nums">{active.rate.toFixed(3)}%</div>
        {result.effectiveDate && (
          <div className="text-xs text-gray-400 text-right">
            Rates as of<br />{result.effectiveDate}
          </div>
        )}
      </div>

      <div className="px-5 py-3 text-sm text-gray-600">{active.explanation}</div>

      <div className="grid grid-cols-2 gap-px bg-gray-100 border-t border-gray-100">
        <div className="p-4 bg-white">
          <div className="text-xs text-gray-500 uppercase tracking-wide">New Payment</div>
          <div className="text-base font-semibold text-gray-900 mt-1 tabular-nums">{fmtDollars(active.payment)}</div>
        </div>
        <div className="p-4 bg-white">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Monthly Savings</div>
          <div className={`text-base font-semibold mt-1 tabular-nums ${savingsPositive ? 'text-green-700' : 'text-red-600'}`}>
            {savingsPositive ? '+' : ''}{fmtDollars(active.monthlySavings)}
          </div>
        </div>
        <div className="p-4 bg-white">
          <div className="text-xs text-gray-500 uppercase tracking-wide">New Loan Amount</div>
          <div className="text-base font-semibold text-gray-900 mt-1 tabular-nums">{fmtDollars(active.loanAmount)}</div>
        </div>
        <div className="p-4 bg-white">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Cash to Close</div>
          <div className="text-base font-semibold text-gray-900 mt-1 tabular-nums">
            {active.cashToClose === 0 ? '$0' : fmtDollars(active.cashToClose)}
          </div>
        </div>
      </div>

      <div className={`px-5 py-3 border-t border-gray-100 text-center ${inPocket ? 'bg-green-50' : 'bg-amber-50'}`}>
        <div className={`text-xs font-medium uppercase tracking-wide ${inPocket ? 'text-green-700' : 'text-amber-700'}`}>
          Net Out-of-Pocket
        </div>
        <div className={`text-xl font-bold mt-1 tabular-nums ${inPocket ? 'text-green-800' : 'text-amber-800'}`}>
          {inPocket ? `+${fmtDollars(Math.abs(active.netCashFlow))} in pocket` : fmtDollars(active.netCashFlow)}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          After ${Math.round(active.totalCashBack).toLocaleString('en-US')} cash back within ~30 days
        </div>
      </div>
    </div>
  );
}
