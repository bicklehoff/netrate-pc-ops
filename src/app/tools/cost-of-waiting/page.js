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

const waitMonths = [1, 2, 3, 6, 9, 12, 18, 24, 36];

function CostOfWaitingContent() {
  const sp = useSearchParams();
  const [loanAmount, setLoanAmount] = useState(sp.get('loanAmount') || '400000');
  const [currentRate, setCurrentRate] = useState(sp.get('currentRate') || '7.25');
  const [newRate, setNewRate] = useState(sp.get('newRate') || '6.50');
  const [term, setTerm] = useState(sp.get('term') || '30');

  const results = useMemo(() => {
    const loan = parseFloat(loanAmount) || 0;
    const curRate = parseFloat(currentRate) || 0;
    const nRate = parseFloat(newRate) || 0;
    const termYears = parseFloat(term) || 30;
    const months = termYears * 12;

    if (!loan || !curRate || !nRate || nRate >= curRate) return null;

    const currentPmt = calculateMonthlyPI(curRate, loan, termYears) || 0;
    const newPmt = calculateMonthlyPI(nRate, loan, termYears) || 0;
    const monthlySavings = currentPmt - newPmt;

    const table = waitMonths.map(m => ({
      months: m,
      lost: monthlySavings * m,
    }));

    const lifetimeSavings = monthlySavings * months;
    const totalInterestCurrent = currentPmt * months - loan;
    const totalInterestNew = newPmt * months - loan;
    const interestSaved = totalInterestCurrent - totalInterestNew;

    // Opportunity cost: what the monthly savings could become if invested
    // FV of annuity: PMT × [((1+r)^n - 1) / r]
    const fvAnnuity = (monthlyPmt, annualReturn, years) => {
      const r = annualReturn / 12;
      const n = years * 12;
      if (!r) return monthlyPmt * n;
      return monthlyPmt * ((Math.pow(1 + r, n) - 1) / r);
    };

    // Calculate extra principal paydown schedule with snapshots at each horizon
    const r = nRate / 100 / 12;
    let balanceExtra = loan;   // balance with extra payments
    let balanceBase = loan;    // balance with normal payments
    let monthsPaidOff = 0;
    let totalInterestExtra = 0;
    const horizons = [5, 10, 15, 20];
    const horizonMonths = horizons.map(y => y * 12);
    const equityAdvantage = {}; // extra equity built at each horizon
    let paidOff = false;

    for (let m = 1; m <= months; m++) {
      // Normal schedule
      if (balanceBase > 0) {
        const intBase = balanceBase * r;
        const princBase = Math.min(newPmt - intBase, balanceBase);
        balanceBase -= princBase;
      }
      // Extra payment schedule
      if (balanceExtra > 0) {
        const intExtra = balanceExtra * r;
        totalInterestExtra += intExtra;
        const princExtra = Math.min(newPmt + monthlySavings - intExtra, balanceExtra);
        balanceExtra -= princExtra;
        if (balanceExtra <= 0 && !paidOff) {
          monthsPaidOff = m;
          paidOff = true;
        }
      }
      // Snapshot at each horizon
      if (horizonMonths.includes(m)) {
        const yr = m / 12;
        equityAdvantage[yr] = Math.max(0, balanceBase - balanceExtra);
      }
    }
    if (!paidOff) monthsPaidOff = months;
    const totalInterestBase = newPmt * months - loan;
    const interestSavedExtra = totalInterestBase - totalInterestExtra;
    const yearsSaved = Math.round(((months - monthsPaidOff) / 12) * 10) / 10;

    const opportunities = horizons.map(yr => ({
      years: yr,
      extraPrincipal: equityAdvantage[yr] || 0,
      sp500: fvAnnuity(monthlySavings, 0.07, yr),
      cds: fvAnnuity(monthlySavings, 0.045, yr),
    }));

    return { currentPmt, newPmt, monthlySavings, table, lifetimeSavings, interestSaved, opportunities, yearsSaved, interestSavedExtra };
  }, [loanAmount, currentRate, newRate, term]);

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-8">
        <Link href="/tools" className="text-sm text-brand hover:underline">&larr; Back to tools</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-3">Cost of Waiting Calculator</h1>
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

      {results && (
        <div className="space-y-6">
          {/* Monthly savings hero */}
          <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
            <div className="text-sm text-green-700 font-medium mb-1">Monthly Savings Available Now</div>
            <div className="text-4xl font-bold text-green-800 tabular-nums">{fmtDollars(results.monthlySavings)}</div>
            <div className="text-xs text-green-600 mt-2">
              {fmtDollars(results.currentPmt)}/mo &rarr; {fmtDollars(results.newPmt)}/mo
            </div>
          </div>

          {/* Cost of waiting table */}
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
                {results.table.map(row => (
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

          {/* Lifetime context */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-gray-200 bg-white p-5 text-center">
              <div className="text-xs text-gray-500 font-medium mb-1">Lifetime Savings</div>
              <div className="text-xl font-bold text-gray-900 tabular-nums">{fmtDollars(results.lifetimeSavings)}</div>
              <div className="text-xs text-gray-400 mt-1">over {term} years</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 text-center">
              <div className="text-xs text-gray-500 font-medium mb-1">Interest Saved</div>
              <div className="text-xl font-bold text-gray-900 tabular-nums">{fmtDollars(results.interestSaved)}</div>
              <div className="text-xs text-gray-400 mt-1">total interest reduction</div>
            </div>
          </div>

          {/* Opportunity cost — what your savings could become */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">What Your Savings Could Become</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                If you refinance today, here&apos;s what {fmtDollars(results.monthlySavings)}/mo could grow into
              </p>
            </div>

            {/* Extra principal summary */}
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-brand" />
                <span className="text-sm font-semibold text-gray-800">Pay off your mortgage faster</span>
              </div>
              <p className="text-sm text-gray-600">
                Put {fmtDollars(results.monthlySavings)}/mo toward extra principal and pay off your loan{' '}
                <strong className="text-brand">{results.yearsSaved} years early</strong>,
                saving <strong className="text-brand">{fmtDollars(results.interestSavedExtra)}</strong> in interest.
              </p>
            </div>

            {/* Investment comparison table — 3 columns */}
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
                {results.opportunities.map(row => (
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
              All assume {fmtDollars(results.monthlySavings)}/mo contributed monthly. Returns are hypothetical.
            </div>
          </div>

          {/* CTA */}
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

      {!results && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
          Enter a new rate lower than your current rate to see how much waiting costs you.
        </div>
      )}
    </div>
    </div>
  );
}

export default function CostOfWaitingPage() {
  return <Suspense><CostOfWaitingContent /></Suspense>;
}
