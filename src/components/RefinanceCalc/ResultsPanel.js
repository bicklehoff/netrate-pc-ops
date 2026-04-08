'use client';

import { dollar, ltvTier } from './shared';

function Metric({ label, value, sub, className }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
      <div className={`text-lg font-semibold mt-0.5 ${className || 'text-gray-900'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export default function ResultsPanel({ active, loading, escrow, effectiveDate }) {
  if (loading && !active) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-gray-500">Pulling today&apos;s rates...</p>
        </div>
      </div>
    );
  }

  if (!active) {
    return (
      <div className="flex items-center justify-center py-20 text-center">
        <div>
          <p className="text-gray-500">Enter your loan details to see results.</p>
          <p className="text-sm text-gray-400 mt-1">We&apos;ll pull today&apos;s wholesale rates and find the best option.</p>
        </div>
      </div>
    );
  }

  const savingsPositive = active.monthlySavings > 0;
  const needsPmi = active.ltv > 80;
  const tier = ltvTier(active.ltv);

  return (
    <div className={`space-y-4 ${loading ? 'opacity-60 transition-opacity' : ''}`}>
      {/* Rate & explanation */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-3xl font-bold text-gray-900">{active.rate.toFixed(3)}%</div>
            <div className="text-xs text-gray-400 mt-0.5">{active.lender} &middot; {active.program}</div>
          </div>
          {effectiveDate && (
            <div className="text-xs text-gray-400 text-right">
              Rates as of<br />{effectiveDate}
            </div>
          )}
        </div>
        <p className="text-sm text-gray-600 mt-3">{active.explanation}</p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-3">
        <Metric label="New Payment" value={dollar(active.payment)} />
        <Metric
          label="Monthly Savings"
          value={(savingsPositive ? '+' : '') + dollar(active.monthlySavings)}
          className={savingsPositive ? 'text-emerald-700' : 'text-red-600'}
        />
        <Metric label="New Loan Amount" value={dollar(active.loanAmount)} />
        <Metric label="Cash to Close" value={active.cashToClose === 0 ? '$0' : dollar(active.cashToClose)} />
      </div>

      {/* Cash flow back */}
      <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-4">
        <h3 className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">Cash Flow Back (within 30 days)</h3>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-xs text-emerald-600">Skipped Payment</div>
            <div className="font-semibold text-emerald-800">{dollar(active.skippedPayment)}</div>
          </div>
          {active.escrowRefund > 0 && (
            <div>
              <div className="text-xs text-emerald-600">Escrow Refund</div>
              <div className="font-semibold text-emerald-800">{dollar(active.escrowRefund)}</div>
            </div>
          )}
          <div>
            <div className="text-xs text-emerald-600">Total Back</div>
            <div className="font-semibold text-emerald-800">{dollar(active.totalCashBack)}</div>
          </div>
        </div>
      </div>

      {/* Net out-of-pocket */}
      <div className={`rounded-xl p-5 text-center ${active.netCashFlow <= 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
        <div className={`text-xs font-medium uppercase tracking-wide ${active.netCashFlow <= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
          Net Out-of-Pocket
        </div>
        <div className={`text-2xl font-bold mt-1 ${active.netCashFlow <= 0 ? 'text-emerald-800' : 'text-amber-800'}`}>
          {active.netCashFlow <= 0 ? '+' + dollar(Math.abs(active.netCashFlow)) + ' in pocket' : dollar(active.netCashFlow)}
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Cash to close minus cash that comes back within ~30 days
        </div>
      </div>

      {/* Escrow breakdown */}
      {escrow.breakdown.length > 0 && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Soft Cost Breakdown</h3>
          <div className="space-y-1.5 text-sm">
            {escrow.breakdown.map((item, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-gray-600">{item.label}</span>
                <span className="font-medium text-gray-900">{dollar(item.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-1.5 border-t border-gray-200 font-semibold">
              <span className="text-gray-700">Total soft costs</span>
              <span className="text-gray-900">{dollar(escrow.total)}</span>
            </div>
          </div>
        </div>
      )}

      {/* LTV & Breakeven */}
      <div className="flex items-center justify-between text-sm bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div>
          <span className="text-gray-500">LTV: </span>
          <span className={`font-semibold px-1.5 py-0.5 rounded ${needsPmi ? 'bg-red-50 text-red-700' : tier.bg + ' ' + tier.color}`}>
            {active.ltv.toFixed(1)}%
          </span>
          {needsPmi && <span className="ml-1.5 text-xs font-medium text-red-600">PMI required</span>}
        </div>
        <div className="text-gray-500">
          Breakeven:{' '}
          <span className="font-medium text-gray-700">
            {active.breakeven === 0 ? 'Immediate' : active.breakeven === null ? 'N/A' : active.breakeven + ' mo'}
          </span>
        </div>
      </div>
    </div>
  );
}
