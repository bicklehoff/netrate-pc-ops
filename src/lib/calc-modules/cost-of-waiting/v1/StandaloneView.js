/**
 * cost-of-waiting v1 — StandaloneView.
 *
 * Full-page layout for /tools/cost-of-waiting. Owns input collection +
 * runs live compute via the useCompute hook. Compute logic is in
 * compute.js — this file is presentational + state.
 *
 * Replaces src/app/tools/cost-of-waiting/content.js. No behavior change:
 * same inputs, same numbers, same UI. The page's server-side homepage-
 * cache fetch (parRate) flows in as a prop and seeds the new-rate input.
 */

'use client';

import { useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { fmtDollars } from '@/lib/formatters';
import { useCompute } from '../../useCompute.js';
import { compute } from './compute.js';
import { schema } from './schema.js';

// Mini module stub for useCompute. Importing the full module def from
// `./index.js` would create a circular dependency since index.js imports
// this view. useCompute only reads inputSchema + compute + capabilities —
// the stub gives it those without the cycle.
const moduleStub = {
  id: 'cost-of-waiting',
  version: 1,
  inputSchema: schema,
  compute,
  capabilities: { needsRates: false, needsToday: false, attachable: true },
};

function Input({ label, prefix, suffix, value, onChange, step, min }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <div className="mt-1 relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          step={step || 1}
          min={min || 0}
          className={`w-full border border-gray-200 rounded-lg py-2.5 text-sm focus:border-brand focus:ring-2 focus:ring-brand/10 outline-none transition-colors ${prefix ? 'pl-7' : 'pl-3'} ${suffix ? 'pr-10' : 'pr-3'}`}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{suffix}</span>}
      </div>
    </label>
  );
}

const FALLBACK_NEW_RATE = '6.50';

function CostOfWaitingContent({ parRate }) {
  const sp = useSearchParams();
  const defaultNewRate = parRate != null ? parRate.toFixed(3) : FALLBACK_NEW_RATE;
  const [loanAmount, setLoanAmount] = useState(sp.get('loanAmount') || '400000');
  const [currentRate, setCurrentRate] = useState(sp.get('currentRate') || '7.25');
  const [newRate, setNewRate] = useState(sp.get('newRate') || defaultNewRate);
  const [term, setTerm] = useState(sp.get('term') || '30');

  // Parse + shape into the schema input. Memoized so identity is stable
  // when raw strings haven't changed; useCompute's inputKey de-dupes
  // anyway but this avoids the JSON.stringify churn on every keystroke.
  const computeInput = useMemo(() => {
    const loan = parseFloat(loanAmount) || 0;
    const cur = parseFloat(currentRate) || 0;
    const nr = parseFloat(newRate) || 0;
    const t = parseFloat(term) || 30;
    if (!loan || !cur || !nr) return null;
    return {
      scenario: { loan_amount: loan, current_rate: cur, term: t },
      config: { newRate: nr, sp500ReturnRate: 0.07, cdReturnRate: 0.045 },
    };
  }, [loanAmount, currentRate, newRate, term]);

  // debounceMs: 0 — pure local compute, no fetch, no need to debounce.
  const { result, error } = useCompute(moduleStub, computeInput, { debounceMs: 0 });

  const showResults = result && result.eligible;

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <Link href="/tools" className="text-sm text-brand hover:underline">&larr; Back to tools</Link>
          <div className="text-2xl font-bold text-gray-900 mt-3">Cost of Waiting Calculator</div>
          <p className="text-sm text-gray-500 mt-1">
            Every month you wait to refinance at a lower rate, you&apos;re paying more than you need to.
            This calculator shows exactly how much that delay costs you.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <Input label="Loan Amount" prefix="$" value={loanAmount} onChange={setLoanAmount} step="5000" />
          <Input label="Current Rate" suffix="%" value={currentRate} onChange={setCurrentRate} step="0.125" />
          <Input label="Available New Rate" suffix="%" value={newRate} onChange={setNewRate} step="0.125" />
          <Input label="Loan Term (years)" suffix="yr" value={term} onChange={setTerm} />
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Couldn&apos;t compute: {error.message}
          </div>
        )}

        {showResults && (
          <div className="space-y-6">
            <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
              <div className="text-sm text-green-700 font-medium mb-1">Monthly Savings Available Now</div>
              <div className="text-4xl font-bold text-green-800 tabular-nums">{fmtDollars(result.monthlySavings)}</div>
              <div className="text-xs text-green-600 mt-2">
                {fmtDollars(result.currentPmt)}/mo &rarr; {fmtDollars(result.newPmt)}/mo
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-900">What Waiting Costs You</h2>
                <p className="text-xs text-gray-500 mt-0.5">Money lost by not refinancing today</p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-6 py-3 text-gray-500 font-medium">If You Wait</th>
                    <th className="text-right px-6 py-3 text-gray-500 font-medium">Money Lost</th>
                  </tr>
                </thead>
                <tbody>
                  {result.table.map((row) => (
                    <tr key={row.months} className="border-b border-gray-50 last:border-0">
                      <td className="px-6 py-3 text-gray-700">
                        {row.months} {row.months === 1 ? 'month' : 'months'}
                      </td>
                      <td className="px-6 py-3 text-right font-semibold text-red-600 tabular-nums">
                        {fmtDollars(row.lost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-gray-200 bg-white p-5 text-center">
                <div className="text-xs text-gray-500 font-medium mb-1">Lifetime Savings</div>
                <div className="text-xl font-bold text-gray-900 tabular-nums">{fmtDollars(result.lifetimeSavings)}</div>
                <div className="text-xs text-gray-400 mt-1">over {term} years</div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-5 text-center">
                <div className="text-xs text-gray-500 font-medium mb-1">Interest Saved</div>
                <div className="text-xl font-bold text-gray-900 tabular-nums">{fmtDollars(result.interestSaved)}</div>
                <div className="text-xs text-gray-400 mt-1">total interest reduction</div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-900">What Your Savings Could Become</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  If you refinance today, here&apos;s what {fmtDollars(result.monthlySavings)}/mo could grow into
                </p>
              </div>

              <div className="px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2 h-2 rounded-full bg-brand" />
                  <span className="text-sm font-semibold text-gray-800">Pay off your mortgage faster</span>
                </div>
                <p className="text-sm text-gray-600">
                  Put {fmtDollars(result.monthlySavings)}/mo toward extra principal and pay off your loan{' '}
                  <strong className="text-brand">{result.yearsSaved} years early</strong>,
                  saving <strong className="text-brand">{fmtDollars(result.interestSavedExtra)}</strong> in interest.
                </p>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">Time</th>
                    <th className="text-right px-4 py-3 text-gray-500 font-medium">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-brand" />Extra Equity
                      </span>
                    </th>
                    <th className="text-right px-4 py-3 text-gray-500 font-medium">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500" />S&P 500 (~7%)
                      </span>
                    </th>
                    <th className="text-right px-4 py-3 text-gray-500 font-medium">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />CDs (~4.5%)
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.opportunities.map((row) => (
                    <tr key={row.years} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-3 text-gray-700">{row.years} yr</td>
                      <td className="px-4 py-3 text-right font-semibold text-brand tabular-nums">{fmtDollars(row.extraPrincipal)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-700 tabular-nums">{fmtDollars(row.sp500)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-blue-700 tabular-nums">{fmtDollars(row.cds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="px-6 py-3 bg-gray-50 text-xs text-gray-400">
                Extra Equity shows additional mortgage paydown vs normal payments at {newRate}%.
                S&P 500 uses ~7% inflation-adjusted historical return. CDs reflect ~4.5% APY.
                All assume {fmtDollars(result.monthlySavings)}/mo contributed monthly. Returns are hypothetical.
              </div>
            </div>

            <div className="rounded-xl border border-brand/10 bg-brand/5 p-6">
              <p className="text-sm text-gray-700">
                <strong>No-cost refinance option:</strong> If closing costs are holding you back, ask about a no-cost refinance.
                We can build the costs into the rate so you pay nothing out of pocket — and still save every month.
              </p>
              <div className="mt-4 flex gap-3">
                <Link href="/rates" className="inline-block bg-go text-white px-5 py-2.5 rounded-nr-md text-sm font-bold hover:bg-go-dark transition-colors">
                  See Today&apos;s Rates
                </Link>
                <Link href="/tools/refi-analyzer" className="inline-block border-2 border-brand text-brand px-5 py-2.5 rounded-2xl text-sm font-medium hover:bg-brand/5 transition-colors">
                  Refi Analyzer
                </Link>
              </div>
            </div>

            <p className="text-xs text-gray-400 pt-2">
              For illustration only. Assumes fixed-rate, fully amortizing loan. Actual savings depend on loan terms, fees, and market conditions.
              Licensed in CA, CO, OR, TX. NMLS #1111861.
            </p>
          </div>
        )}

        {!showResults && !error && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
            Enter a new rate lower than your current rate to see how much waiting costs you.
          </div>
        )}
      </div>
    </div>
  );
}

export default function StandaloneView({ parRate = null }) {
  return (
    <Suspense>
      <CostOfWaitingContent parRate={parRate} />
    </Suspense>
  );
}
