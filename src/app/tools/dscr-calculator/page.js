'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

function fmt(n) { return n.toLocaleString('en-US', { maximumFractionDigits: 2 }); }
function dollar(n) { return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

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

export default function DSCRCalculatorPage() {
  const [rentalIncome, setRentalIncome] = useState('3000');
  const [expenses, setExpenses] = useState('800');
  const [loanAmount, setLoanAmount] = useState('300000');
  const [rate, setRate] = useState('7.25');
  const [term, setTerm] = useState('30');

  const results = useMemo(() => {
    const income = parseFloat(rentalIncome) || 0;
    const exp = parseFloat(expenses) || 0;
    const loan = parseFloat(loanAmount) || 0;
    const r = (parseFloat(rate) || 0) / 100 / 12;
    const n = (parseFloat(term) || 30) * 12;

    if (!loan || !r) return null;

    const payment = loan * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const noi = income - exp;
    const dscr = payment > 0 ? noi / payment : 0;

    let status, color, bg;
    if (dscr >= 1.25) { status = 'Strong — Qualifies'; color = 'text-green-700'; bg = 'bg-green-50 border-green-200'; }
    else if (dscr >= 1.0) { status = 'Marginal — May Qualify'; color = 'text-amber-700'; bg = 'bg-amber-50 border-amber-200'; }
    else { status = 'Does Not Qualify'; color = 'text-red-700'; bg = 'bg-red-50 border-red-200'; }

    return { payment, noi, dscr, status, color, bg };
  }, [rentalIncome, expenses, loanAmount, rate, term]);

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-8">
        <Link href="/" className="text-sm text-cyan-600 hover:underline">← Back to tools</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-3">DSCR Calculator</h1>
        <p className="text-sm text-gray-500 mt-1">
          Debt Service Coverage Ratio measures whether a property&apos;s rental income covers its loan payments.
          Most DSCR lenders require a ratio of 1.25 or higher — meaning the property earns 25% more than the debt costs.
          No personal income documentation needed.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <Input label="Monthly Gross Rental Income" prefix="$" value={rentalIncome} onChange={setRentalIncome} step="100" />
        <Input label="Monthly Expenses (tax, ins, HOA, mgmt)" prefix="$" value={expenses} onChange={setExpenses} step="50" />
        <Input label="Loan Amount" prefix="$" value={loanAmount} onChange={setLoanAmount} step="5000" />
        <Input label="Interest Rate" suffix="%" value={rate} onChange={setRate} step="0.125" />
        <Input label="Loan Term (years)" suffix="yr" value={term} onChange={setTerm} />
      </div>

      {results && (
        <div className="space-y-4">
          <div className={`rounded-xl border p-6 text-center ${results.bg}`}>
            <div className="text-4xl font-bold tabular-nums">{fmt(results.dscr)}</div>
            <div className={`text-sm font-semibold mt-1 ${results.color}`}>{results.status}</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-xs text-gray-500 uppercase tracking-wide">Net Operating Income</div>
              <div className="text-lg font-semibold text-gray-900 mt-1">{dollar(results.noi)}<span className="text-xs text-gray-400">/mo</span></div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-xs text-gray-500 uppercase tracking-wide">Monthly Debt Service</div>
              <div className="text-lg font-semibold text-gray-900 mt-1">{dollar(results.payment)}<span className="text-xs text-gray-400">/mo</span></div>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-500">
            <strong>How it works:</strong> DSCR = Net Operating Income ÷ Debt Service. A ratio above 1.0 means the property
            covers its own mortgage. Most lenders want 1.25+. This calculator uses principal &amp; interest only — your lender
            may include taxes and insurance in the debt service figure.
          </div>

          <div className="flex gap-3 pt-2">
            <Link href="/contact" className="inline-flex items-center px-5 py-2.5 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-700 transition-colors">
              Talk to a loan officer
            </Link>
            <Link href="/portal/apply" className="inline-flex items-center px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
              Start application
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
