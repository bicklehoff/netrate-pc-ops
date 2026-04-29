/**
 * purchase-calculator v1 — EmbeddedView.
 *
 * Compact card for /portal/quote/[id]. Pure presentational; consumes
 * the frozen result. Surfaces the total payment + 4-cell PITI(A)
 * breakdown + cash-to-close + DTI. Skips max-affordable since the
 * borrower is looking at a quote for a specific scenario, not a
 * what-if affordability range.
 */

import { fmtDollars, fmtPct } from '@/lib/formatters';

const DTI_STYLE = {
  good: { color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  neutral: { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  bad: { color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
};

/**
 * @param {{
 *   scenario: object,
 *   config: object,
 *   result: object,
 * }} props
 */
export default function EmbeddedView({ result }) {
  if (!result) return null;
  const dtiStyle = DTI_STYLE[result.dtiTone] || DTI_STYLE.neutral;

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-900">Purchase Payment Breakdown</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Estimated monthly payment + cash to close at the proposed scenario.
        </p>
      </div>

      <div className="px-5 py-4 text-center border-b border-gray-100">
        <div className="text-xs text-gray-500 uppercase tracking-wide">Estimated Monthly Payment</div>
        <div className="text-3xl font-bold text-gray-900 mt-1 tabular-nums">{fmtDollars(result.totalMonthly)}</div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-gray-100">
        <div className="p-3 bg-white">
          <div className="text-xs text-gray-500">P&amp;I</div>
          <div className="text-sm font-semibold text-gray-900 mt-0.5">{fmtDollars(result.monthlyPI)}</div>
        </div>
        <div className="p-3 bg-white">
          <div className="text-xs text-gray-500">Tax</div>
          <div className="text-sm font-semibold text-gray-900 mt-0.5">{fmtDollars(result.monthlyTax)}</div>
        </div>
        <div className="p-3 bg-white">
          <div className="text-xs text-gray-500">Insurance</div>
          <div className="text-sm font-semibold text-gray-900 mt-0.5">{fmtDollars(result.monthlyIns)}</div>
        </div>
        <div className="p-3 bg-white">
          <div className="text-xs text-gray-500">{result.monthlyPMI > 0 ? 'PMI' : 'No PMI'}</div>
          <div className="text-sm font-semibold text-gray-900 mt-0.5">{fmtDollars(result.monthlyPMI)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-gray-100 border-t border-gray-100">
        <div className="p-4 bg-white">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Cash to Close</div>
          <div className="text-base font-semibold text-gray-900 mt-1">{fmtDollars(result.cashToClose)}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            {fmtDollars(result.downPayment)} down + ~{fmtDollars(result.closingCostsEstimate)} closing
          </div>
        </div>
        <div className={`p-4 ${dtiStyle.bg}`}>
          <div className="text-xs text-gray-500 uppercase tracking-wide">DTI</div>
          <div className={`text-base font-semibold mt-1 ${dtiStyle.color}`}>
            {fmtPct(result.dti)} — {result.dtiLabel}
          </div>
        </div>
      </div>
    </div>
  );
}
