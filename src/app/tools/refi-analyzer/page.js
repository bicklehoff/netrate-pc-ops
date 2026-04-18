'use client';

import { useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { fmtDollars } from '@/lib/formatters';
import { calculateMonthlyPI } from '@/lib/mortgage-math';

function Input({ label, prefix, suffix, value, onChange, step, min }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <div className="mt-1 relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          step={step || 1}
          min={min || 0}
          className={`w-full border border-gray-200 rounded-lg py-2.5 text-sm focus:border-brand focus:ring-2 focus:ring-brand/10 outline-none transition-colors ${prefix ? 'pl-7' : 'pl-3'} ${suffix ? 'pr-10' : 'pr-3'}`}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{suffix}</span>}
      </div>
    </label>
  );
}

function RefiAnalyzerContent() {
  const sp = useSearchParams();
  const [balance, setBalance] = useState(sp.get('balance') || '350000');
  const [currentRate, setCurrentRate] = useState(sp.get('currentRate') || '7.50');
  const [remainingYears, setRemainingYears] = useState('27');
  const [newRate, setNewRate] = useState(sp.get('newRate') || '6.50');
  const [newTerm, setNewTerm] = useState(sp.get('newTerm') || '30');
  const [closingCosts, setClosingCosts] = useState('4000');
  const [holdYears, setHoldYears] = useState('7');

  const results = useMemo(() => {
    const bal = parseFloat(balance) || 0;
    const curRate = parseFloat(currentRate) || 0;
    const remYrs = parseFloat(remainingYears) || 27;
    const remMo = remYrs * 12;
    const nRate = parseFloat(newRate) || 0;
    const nYrs = parseFloat(newTerm) || 30;
    const nMo = nYrs * 12;
    const costs = parseFloat(closingCosts) || 0;
    const hold = (parseFloat(holdYears) || 7) * 12;

    if (!bal) return null;

    const currentPmt = calculateMonthlyPI(curRate, bal, remYrs) || 0;
    const newPmt = calculateMonthlyPI(nRate, bal, nYrs) || 0;
    const monthlySavings = currentPmt - newPmt;

    const breakEvenMonths = monthlySavings > 0 ? Math.ceil(costs / monthlySavings) : Infinity;

    const currentTotalInterest = currentPmt * remMo - bal;
    const newTotalInterest = newPmt * nMo - bal;
    const interestSaved = currentTotalInterest - newTotalInterest;

    // Cost comparison over hold period
    const holdMo = Math.min(hold, remMo);
    const currentCostOverHold = currentPmt * holdMo;
    const newCostOverHold = newPmt * Math.min(hold, nMo) + costs;
    const netSavingsOverHold = currentCostOverHold - newCostOverHold;

    let verdict, verdictColor, verdictBg;
    if (monthlySavings <= 0) {
      verdict = 'Not Worth It — New rate doesn\'t save money';
      verdictColor = 'text-red-700'; verdictBg = 'bg-red-50 border-red-200';
    } else if (breakEvenMonths <= hold) {
      verdict = 'Worth It — You\'ll recoup costs and save';
      verdictColor = 'text-green-700'; verdictBg = 'bg-green-50 border-green-200';
    } else {
      verdict = 'Maybe — Break-even is past your hold period';
      verdictColor = 'text-amber-700'; verdictBg = 'bg-amber-50 border-amber-200';
    }

    return {
      currentPmt, newPmt, monthlySavings, breakEvenMonths,
      interestSaved, currentCostOverHold, newCostOverHold, netSavingsOverHold,
      verdict, verdictColor, verdictBg,
    };
  }, [balance, currentRate, remainingYears, newRate, newTerm, closingCosts, holdYears]);

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-8">
        <Link href="/tools" className="text-sm text-brand hover:underline">← Back to tools</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-3">Refi Recoup Analyzer</h1>
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

      {results && (
        <div className="space-y-4">
          <div className={`rounded-xl border p-6 text-center ${results.verdictBg}`}>
            <div className={`text-lg font-bold ${results.verdictColor}`}>{results.verdict}</div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-xs text-gray-500 uppercase tracking-wide">Current Payment</div>
              <div className="text-lg font-semibold text-gray-900 mt-1">{fmtDollars(results.currentPmt)}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-xs text-gray-500 uppercase tracking-wide">New Payment</div>
              <div className="text-lg font-semibold text-gray-900 mt-1">{fmtDollars(results.newPmt)}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-xs text-gray-500 uppercase tracking-wide">Monthly Savings</div>
              <div className="text-lg font-semibold text-green-700 mt-1">{fmtDollars(results.monthlySavings)}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-xs text-gray-500 uppercase tracking-wide">Break-Even</div>
              <div className="text-lg font-semibold text-gray-900 mt-1">
                {results.breakEvenMonths === Infinity ? '—' : `${results.breakEvenMonths} mo`}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-xs text-gray-500 uppercase tracking-wide">Total Interest Saved (life of loan)</div>
              <div className="text-lg font-semibold text-green-700 mt-1">{fmtDollars(results.interestSaved)}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-xs text-gray-500 uppercase tracking-wide">Net Savings Over {holdYears}yr Hold</div>
              <div className="text-lg font-semibold text-gray-900 mt-1">{fmtDollars(results.netSavingsOverHold)}</div>
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

export default function RefiAnalyzerPage() {
  return <Suspense><RefiAnalyzerContent /></Suspense>;
}
