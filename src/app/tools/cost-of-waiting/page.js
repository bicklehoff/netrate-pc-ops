'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

function dollar(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
function pmt(principal, annualRate, months) {
  const r = annualRate / 100 / 12;
  if (!r) return principal / months;
  return principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

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
          className={`w-full border border-gray-300 rounded-lg py-2.5 text-sm focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 ${prefix ? 'pl-7' : 'pl-3'} ${suffix ? 'pr-10' : 'pr-3'}`}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{suffix}</span>}
      </div>
    </label>
  );
}

const waitMonths = [1, 2, 3, 6, 9, 12, 18, 24, 36];

export default function CostOfWaitingPage() {
  const [loanAmount, setLoanAmount] = useState('400000');
  const [currentRate, setCurrentRate] = useState('7.25');
  const [newRate, setNewRate] = useState('6.50');
  const [term, setTerm] = useState('30');

  const results = useMemo(() => {
    const loan = parseFloat(loanAmount) || 0;
    const curRate = parseFloat(currentRate) || 0;
    const nRate = parseFloat(newRate) || 0;
    const months = (parseFloat(term) || 30) * 12;

    if (!loan || !curRate || !nRate || nRate >= curRate) return null;

    const currentPmt = pmt(loan, curRate, months);
    const newPmt = pmt(loan, nRate, months);
    const monthlySavings = currentPmt - newPmt;

    const table = waitMonths.map(m => ({
      months: m,
      lost: monthlySavings * m,
    }));

    const lifetimeSavings = monthlySavings * months;
    const totalInterestCurrent = currentPmt * months - loan;
    const totalInterestNew = newPmt * months - loan;
    const interestSaved = totalInterestCurrent - totalInterestNew;

    return { currentPmt, newPmt, monthlySavings, table, lifetimeSavings, interestSaved };
  }, [loanAmount, currentRate, newRate, term]);

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-8">
        <Link href="/" className="text-sm text-cyan-600 hover:underline">&larr; Back to tools</Link>
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
            <div className="text-4xl font-bold text-green-800 tabular-nums">{dollar(results.monthlySavings)}</div>
            <div className="text-xs text-green-600 mt-2">
              {dollar(results.currentPmt)}/mo &rarr; {dollar(results.newPmt)}/mo
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
                      {dollar(row.lost)}
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
              <div className="text-xl font-bold text-gray-900 tabular-nums">{dollar(results.lifetimeSavings)}</div>
              <div className="text-xs text-gray-400 mt-1">over {term} years</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-5 text-center">
              <div className="text-xs text-gray-500 font-medium mb-1">Interest Saved</div>
              <div className="text-xl font-bold text-gray-900 tabular-nums">{dollar(results.interestSaved)}</div>
              <div className="text-xs text-gray-400 mt-1">total interest reduction</div>
            </div>
          </div>

          {/* CTA */}
          <div className="rounded-xl border border-cyan-100 bg-cyan-50 p-6">
            <p className="text-sm text-gray-700">
              <strong>No-cost refinance option:</strong> If closing costs are holding you back, ask about a no-cost refinance.
              We can build the costs into the rate so you pay nothing out of pocket — and still save every month.
            </p>
            <div className="mt-4 flex gap-3">
              <Link href="/rates" className="inline-block bg-brand text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-dark transition-colors">
                See Today&apos;s Rates
              </Link>
              <Link href="/tools/refi-analyzer" className="inline-block border border-brand text-brand px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-cyan-50 transition-colors">
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
  );
}
