/**
 * refi-analyzer v1 — StandaloneView.
 *
 * Full-page UI for /tools/refi-analyzer. Replaces
 * src/app/tools/refi-analyzer/content.js. Owns input collection +
 * runs live compute via useCompute. No behavior change vs. the old
 * content.js: same inputs, same numbers, same UI.
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
// `./index.js` would create a circular dep — see Phase 2 PR #284 for
// the same pattern in cost-of-waiting.
const moduleStub = {
  id: 'refi-analyzer',
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

const VERDICT_STYLE = {
  good: { color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  bad: { color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  neutral: { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
};

function RefiAnalyzerContent({ parRate }) {
  const sp = useSearchParams();
  const defaultNewRate = parRate != null ? parRate.toFixed(3) : FALLBACK_NEW_RATE;
  const [balance, setBalance] = useState(sp.get('balance') || '350000');
  const [currentRate, setCurrentRate] = useState(sp.get('currentRate') || '7.50');
  const [remainingYears, setRemainingYears] = useState('27');
  const [newRate, setNewRate] = useState(sp.get('newRate') || defaultNewRate);
  const [newTerm, setNewTerm] = useState(sp.get('newTerm') || '30');
  const [closingCosts, setClosingCosts] = useState('4000');
  const [holdYears, setHoldYears] = useState('7');

  const computeInput = useMemo(() => {
    const bal = parseFloat(balance) || 0;
    const cur = parseFloat(currentRate) || 0;
    const rem = parseFloat(remainingYears) || 0;
    const nr = parseFloat(newRate) || 0;
    const nt = parseFloat(newTerm) || 0;
    const costs = parseFloat(closingCosts) || 0;
    const hold = parseFloat(holdYears) || 0;
    if (!bal || !cur || !rem || !nr || !nt) return null;
    return {
      scenario: {
        current_balance: bal,
        current_rate: cur,
        remaining_term_years: rem,
        new_rate: nr,
        new_term_years: nt,
      },
      config: { closing_costs: costs, hold_years: hold },
    };
  }, [balance, currentRate, remainingYears, newRate, newTerm, closingCosts, holdYears]);

  const { result, error } = useCompute(moduleStub, computeInput, { debounceMs: 0 });

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <Link href="/tools" className="text-sm text-brand hover:underline">← Back to tools</Link>
          <div className="text-2xl font-bold text-gray-900 mt-3">Refi Recoup Analyzer</div>
          <p className="text-sm text-gray-500 mt-1">
            Should you refinance? Enter your current loan details and a new rate to see your monthly savings,
            break-even timeline, and total cost comparison. The math tells the story.
          </p>
        </div>

        <div className="space-y-6 mb-8">
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Current Loan</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input label="Remaining Balance" prefix="$" value={balance} onChange={setBalance} step="5000" />
              <Input label="Current Rate" suffix="%" value={currentRate} onChange={setCurrentRate} step="0.125" />
              <Input label="Remaining Term" suffix="yr" value={remainingYears} onChange={setRemainingYears} />
            </div>
          </div>
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">New Loan</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input label="New Rate" suffix="%" value={newRate} onChange={setNewRate} step="0.125" />
              <Input label="New Term" suffix="yr" value={newTerm} onChange={setNewTerm} />
              <Input label="Closing Costs" prefix="$" value={closingCosts} onChange={setClosingCosts} step="500" />
            </div>
          </div>
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Your Plan</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input label="How long will you keep the home?" suffix="yr" value={holdYears} onChange={setHoldYears} />
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Couldn&apos;t compute: {error.message}
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className={`rounded-xl border p-6 text-center ${VERDICT_STYLE[result.verdictTone].bg}`}>
              <div className={`text-lg font-bold ${VERDICT_STYLE[result.verdictTone].color}`}>{result.verdict}</div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Current Payment</div>
                <div className="text-lg font-semibold text-gray-900 mt-1">{fmtDollars(result.currentPmt)}</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs text-gray-500 uppercase tracking-wide">New Payment</div>
                <div className="text-lg font-semibold text-gray-900 mt-1">{fmtDollars(result.newPmt)}</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Monthly Savings</div>
                <div className="text-lg font-semibold text-green-700 mt-1">{fmtDollars(result.monthlySavings)}</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Break-Even</div>
                <div className="text-lg font-semibold text-gray-900 mt-1">
                  {result.breakEvenMonths == null ? '—' : `${result.breakEvenMonths} mo`}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Total Interest Saved (life of loan)</div>
                <div className="text-lg font-semibold text-green-700 mt-1">{fmtDollars(result.interestSaved)}</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Net Savings Over {holdYears}yr Hold</div>
                <div className="text-lg font-semibold text-gray-900 mt-1">{fmtDollars(result.netSavingsOverHold)}</div>
              </div>
            </div>

            <div className="bg-brand/5 border border-brand/20 rounded-xl p-4 text-sm">
              <strong className="text-gray-900">Ready to see how your refinance would actually be structured?</strong>
              <p className="text-gray-600 mt-1">
                Compare four strategies side by side — balance-to-balance, roll everything in, split the difference, or buy the rate down.
                See the real cash flow, not just the monthly savings.
              </p>
              <Link href="/refinance-calculator" className="inline-flex items-center mt-2 text-brand font-medium hover:underline">
                Open the Refinance Calculator &rarr;
              </Link>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-500">
              <strong>When does a refi make sense?</strong> Generally, if you can lower your rate by 0.5%+ and plan to stay
              in the home past the break-even point, refinancing saves money. This calculator compares principal &amp; interest only —
              your actual savings may vary with escrow changes.
            </div>

            <div className="flex gap-3 pt-2">
              <Link href="/contact" className="inline-flex items-center px-5 py-2.5 bg-brand text-white text-sm font-medium rounded-2xl hover:bg-brand-dark transition-colors">
                Talk to a loan officer
              </Link>
              <Link href="/rates" className="inline-flex items-center px-5 py-2.5 border-2 border-brand text-brand text-sm font-medium rounded-2xl hover:bg-brand/5 transition-colors">
                See today&apos;s rates
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StandaloneView({ parRate = null }) {
  return (
    <Suspense>
      <RefiAnalyzerContent parRate={parRate} />
    </Suspense>
  );
}
