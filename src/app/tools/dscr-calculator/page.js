'use client';

import { useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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

function DSCRCalculatorContent() {
  const sp = useSearchParams();
  const [rentalIncome, setRentalIncome] = useState('3000');
  const [expenses, setExpenses] = useState('800');
  const [loanAmount, setLoanAmount] = useState(sp.get('loanAmount') || '300000');
  const [rate, setRate] = useState(sp.get('rate') || '7.25');
  const [term, setTerm] = useState(sp.get('term') || '30');

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

    let status, color, bg, detail;
    if (dscr >= 1.25) {
      status = 'Strong — Qualifies';
      color = 'text-green-700';
      bg = 'bg-green-50 border-green-200';
      detail = 'Most DSCR lenders approve at 1.25+. The property earns 25%+ more than the mortgage costs. Best rates available at this tier.';
    } else if (dscr >= 1.15) {
      status = 'Good — Qualifies with Most Lenders';
      color = 'text-green-600';
      bg = 'bg-green-50 border-green-200';
      detail = 'Above 1.15 qualifies with most DSCR programs. Rates may be slightly higher than the 1.25+ tier.';
    } else if (dscr >= 1.0) {
      status = 'Minimum — Limited Options';
      color = 'text-amber-700';
      bg = 'bg-amber-50 border-amber-200';
      detail = 'A 1.0 DSCR means the rent exactly covers the mortgage — no cushion. Some lenders allow this but expect higher rates and larger down payments (typically 25-30%).';
    } else if (dscr >= 0.75) {
      status = 'Below Break-Even — Specialty Programs Only';
      color = 'text-orange-700';
      bg = 'bg-orange-50 border-orange-200';
      detail = 'The property doesn\'t fully cover the mortgage. A few lenders offer "no-ratio" or sub-1.0 DSCR programs, but rates are significantly higher and typically require 30%+ down.';
    } else {
      status = 'Does Not Qualify';
      color = 'text-red-700';
      bg = 'bg-red-50 border-red-200';
      detail = 'The rental income is too low relative to the mortgage payment. Consider a larger down payment (reduces the mortgage) or verify your rent estimate against market comps.';
    }

    return { payment, noi, dscr, status, color, bg, detail };
  }, [rentalIncome, expenses, loanAmount, rate, term]);

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-8">
        <Link href="/" className="text-sm text-cyan-600 hover:underline">← Back to tools</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-3">DSCR Calculator</h1>
        <p className="text-sm text-gray-500 mt-1">
          <strong>DSCR</strong> stands for Debt Service Coverage Ratio. It&apos;s a simple formula:
          your property&apos;s rental income divided by the mortgage payment. If the ratio is above 1.0, the
          property pays for itself. DSCR loans are for investment properties — they qualify based on
          the property&apos;s income, not yours. No tax returns, no pay stubs, no personal income documentation.
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
            <p className="text-xs text-gray-600 mt-2 max-w-lg mx-auto">{results.detail}</p>
          </div>

          {/* DSCR Tier Guide */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">DSCR Tiers — What Lenders Look For</h4>
            <div className="space-y-1.5">
              {[
                { range: '1.25+', label: 'Strong', desc: 'Best rates, most lenders', color: 'bg-green-500', active: results.dscr >= 1.25 },
                { range: '1.15–1.24', label: 'Good', desc: 'Qualifies with most programs', color: 'bg-green-400', active: results.dscr >= 1.15 && results.dscr < 1.25 },
                { range: '1.00–1.14', label: 'Minimum', desc: 'Higher rates, more down payment', color: 'bg-amber-400', active: results.dscr >= 1.0 && results.dscr < 1.15 },
                { range: '0.75–0.99', label: 'Below break-even', desc: 'Specialty programs only', color: 'bg-orange-400', active: results.dscr >= 0.75 && results.dscr < 1.0 },
                { range: 'Below 0.75', label: 'Does not qualify', desc: 'Increase rent or down payment', color: 'bg-red-400', active: results.dscr < 0.75 },
              ].map((tier) => (
                <div key={tier.range} className={`flex items-center gap-3 text-xs px-3 py-1.5 rounded ${tier.active ? 'bg-gray-100 font-semibold' : ''}`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${tier.color} flex-shrink-0`} />
                  <span className="w-20 font-mono text-gray-700">{tier.range}</span>
                  <span className="text-gray-600">{tier.label} — {tier.desc}</span>
                  {tier.active && <span className="ml-auto text-brand font-semibold">← You</span>}
                </div>
              ))}
            </div>
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

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-500 space-y-2">
            <p><strong>How the math works:</strong></p>
            <p className="font-mono bg-white rounded px-2 py-1 inline-block">DSCR = Rental Income − Expenses ÷ Mortgage Payment</p>
            <p>
              Example: $3,000 rent − $800 expenses = $2,200 net income. If the mortgage is $1,760/mo,
              your DSCR is 2,200 ÷ 1,760 = <strong>1.25</strong>. The property earns 25% more than the mortgage costs.
            </p>
            <p>
              <strong>Note:</strong> This calculator uses principal &amp; interest only. Your lender may include
              taxes and insurance in the debt service figure, which would lower the ratio. Enter your full
              monthly expenses (tax, insurance, HOA, property management) in the expenses field for the most accurate result.
            </p>
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

export default function DSCRCalculatorPage() {
  return <Suspense><DSCRCalculatorContent /></Suspense>;
}
