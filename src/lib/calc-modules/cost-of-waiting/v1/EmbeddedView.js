/**
 * cost-of-waiting v1 — EmbeddedView.
 *
 * Compact card for /portal/quote/[id] when this module is attached to a
 * sent quote. Pure presentational — consumes the frozen `result` from
 * quotes.attached_modules[i]. Per spec §5: never re-computes.
 *
 * Layout: heading + monthly-savings hero + 3-row condensed wait table +
 * lifetime savings line. Skips the opportunity-cost table to keep the
 * embedded card readable in a quote view.
 */

import { fmtDollars } from '@/lib/formatters';

const CONDENSED_WAIT_MONTHS = [3, 6, 12];

/**
 * @param {{
 *   scenario: object,
 *   config: { newRate: number, sp500ReturnRate: number, cdReturnRate: number },
 *   result: object,
 * }} props
 */
export default function EmbeddedView({ result }) {
  if (!result || !result.eligible) {
    // No savings to show — render nothing rather than a sad-state card.
    // The quote page can omit empty modules from rendering entirely.
    return null;
  }

  const condensed = result.table.filter((row) => CONDENSED_WAIT_MONTHS.includes(row.months));

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-900">Cost of Waiting</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          What it costs to delay refinancing at the rate above.
        </p>
      </div>

      <div className="px-5 py-4 grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-gray-500 font-medium mb-0.5">Monthly Savings</div>
          <div className="text-2xl font-bold text-green-700 tabular-nums">
            {fmtDollars(result.monthlySavings)}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {fmtDollars(result.currentPmt)}/mo &rarr; {fmtDollars(result.newPmt)}/mo
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 font-medium mb-0.5">Lifetime Savings</div>
          <div className="text-2xl font-bold text-gray-900 tabular-nums">
            {fmtDollars(result.lifetimeSavings)}
          </div>
          <div className="text-xs text-gray-400 mt-1">over the loan term</div>
        </div>
      </div>

      <table className="w-full text-sm border-t border-gray-100">
        <thead>
          <tr>
            <th className="text-left px-5 py-2 text-xs text-gray-500 font-medium">If you wait</th>
            <th className="text-right px-5 py-2 text-xs text-gray-500 font-medium">You lose</th>
          </tr>
        </thead>
        <tbody>
          {condensed.map((row) => (
            <tr key={row.months} className="border-t border-gray-50">
              <td className="px-5 py-2 text-gray-700">
                {row.months} {row.months === 1 ? 'month' : 'months'}
              </td>
              <td className="px-5 py-2 text-right font-semibold text-red-600 tabular-nums">
                {fmtDollars(row.lost)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
