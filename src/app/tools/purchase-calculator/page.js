'use client';

import { useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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
          className={`w-full border border-gray-200 rounded-lg py-2.5 text-sm focus:border-brand focus:ring-2 focus:ring-brand/10 outline-none transition-colors ${prefix ? 'pl-7' : 'pl-3'} ${suffix ? 'pr-10' : 'pr-3'}`}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{suffix}</span>}
      </div>
    </label>
  );
}

function PurchaseCalculatorContent() {
  const sp = useSearchParams();
  const [homePrice, setHomePrice] = useState(sp.get('homePrice') || '450000');
  const [downPct, setDownPct] = useState(sp.get('downPct') || '3');
  const [rate, setRate] = useState(sp.get('rate') || '6.875');
  const [term, setTerm] = useState(sp.get('term') || '30');
  const [taxRate, setTaxRate] = useState('0.6');
  const [insurance, setInsurance] = useState('1200');
  const [hoa, setHoa] = useState('0');
  const [income, setIncome] = useState('95000');

  const results = useMemo(() => {
    const price = parseFloat(homePrice) || 0;
    const dp = (parseFloat(downPct) || 3) / 100;
    const r = parseFloat(rate) || 0;
    const n = (parseFloat(term) || 30) * 12;
    const tax = (parseFloat(taxRate) || 0.6) / 100;
    const ins = parseFloat(insurance) || 1200;
    const hoaAmt = parseFloat(hoa) || 0;
    const grossIncome = parseFloat(income) || 0;

    if (!price) return null;

    const downPayment = price * dp;
    const loanAmount = price - downPayment;
    const monthlyPI = pmt(loanAmount, r, n);
    const monthlyTax = (price * tax) / 12;
    const monthlyIns = ins / 12;

    // PMI if < 20% down — estimate 0.5% of loan annually
    const monthlyPMI = dp < 0.2 ? (loanAmount * 0.005) / 12 : 0;

    const totalMonthly = monthlyPI + monthlyTax + monthlyIns + monthlyPMI + hoaAmt;
    const cashToClose = downPayment + (loanAmount * 0.03); // ~3% closing costs

    const monthlyIncome = grossIncome / 12;
    const dti = monthlyIncome > 0 ? (totalMonthly / monthlyIncome) * 100 : 0;

    let dtiColor, dtiBg, dtiLabel;
    if (dti <= 36) { dtiColor = 'text-green-700'; dtiBg = 'bg-green-50 border-green-200'; dtiLabel = 'Comfortable'; }
    else if (dti <= 45) { dtiColor = 'text-amber-700'; dtiBg = 'bg-amber-50 border-amber-200'; dtiLabel = 'Qualifying'; }
    else { dtiColor = 'text-red-700'; dtiBg = 'bg-red-50 border-red-200'; dtiLabel = 'Over limit'; }

    // Max affordable price at 45% DTI
    const maxMonthly = monthlyIncome * 0.45;
    // Solve backwards: maxMonthly = PI + tax + ins + pmi + hoa
    // Approximate iteratively
    let maxPrice = price;
    for (let i = 0; i < 20; i++) {
      const mLoan = maxPrice * (1 - dp);
      const mPI = pmt(mLoan, r, n);
      const mTax = (maxPrice * tax) / 12;
      const mPMI = dp < 0.2 ? (mLoan * 0.005) / 12 : 0;
      const mTotal = mPI + mTax + monthlyIns + mPMI + hoaAmt;
      const ratio = maxMonthly / mTotal;
      maxPrice = maxPrice * ratio;
      if (Math.abs(ratio - 1) < 0.001) break;
    }

    return {
      downPayment, loanAmount, monthlyPI, monthlyTax, monthlyIns, monthlyPMI,
      totalMonthly, cashToClose, dti, dtiColor, dtiBg, dtiLabel, maxPrice, hoaAmt,
    };
  }, [homePrice, downPct, rate, term, taxRate, insurance, hoa, income]);

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
    <div className="max-w-3xl mx-auto px-6 py-10">
      <div className="mb-8">
        <Link href="/tools" className="text-sm text-brand hover:underline">← Back to tools</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-3">Purchase Calculator</h1>
        <p className="text-sm text-gray-500 mt-1">
          Estimate your monthly payment, cash to close, and how much home you can afford.
          Default is Conventional 97 (3% down) — adjust to fit your scenario.
        </p>
      </div>

      <div className="space-y-6 mb-8">
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Property &amp; Loan</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Home Price" prefix="$" value={homePrice} onChange={setHomePrice} step="5000" />
            <Input label="Down Payment" suffix="%" value={downPct} onChange={setDownPct} step="0.5" />
            <Input label="Interest Rate" suffix="%" value={rate} onChange={setRate} step="0.125" />
            <Input label="Loan Term" suffix="yr" value={term} onChange={setTerm} />
          </div>
        </div>
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Taxes, Insurance &amp; HOA</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Property Tax Rate" suffix="%" value={taxRate} onChange={setTaxRate} step="0.1" />
            <Input label="Annual Insurance" prefix="$" value={insurance} onChange={setInsurance} step="100" />
            <Input label="Monthly HOA" prefix="$" value={hoa} onChange={setHoa} step="25" />
          </div>
        </div>
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Your Income</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="Annual Gross Income" prefix="$" value={income} onChange={setIncome} step="1000" />
          </div>
        </div>
      </div>

      {results && (
        <div className="space-y-4">
          {/* Total Payment Hero */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
            <div className="text-xs text-gray-500 uppercase tracking-wide">Estimated Monthly Payment</div>
            <div className="text-4xl font-bold text-gray-900 mt-1 tabular-nums">{dollar(results.totalMonthly)}</div>
          </div>

          {/* Payment Breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-xs text-gray-500">Principal &amp; Interest</div>
              <div className="text-base font-semibold text-gray-900 mt-1">{dollar(results.monthlyPI)}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-xs text-gray-500">Property Tax</div>
              <div className="text-base font-semibold text-gray-900 mt-1">{dollar(results.monthlyTax)}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-xs text-gray-500">Insurance</div>
              <div className="text-base font-semibold text-gray-900 mt-1">{dollar(results.monthlyIns)}</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-xs text-gray-500">{results.monthlyPMI > 0 ? 'PMI' : 'No PMI'}</div>
              <div className="text-base font-semibold text-gray-900 mt-1">
                {results.monthlyPMI > 0 ? dollar(results.monthlyPMI) : '$0'}
              </div>
            </div>
          </div>

          {/* Cash & DTI */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-xs text-gray-500 uppercase tracking-wide">Cash to Close (est.)</div>
              <div className="text-lg font-semibold text-gray-900 mt-1">{dollar(results.cashToClose)}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                {dollar(results.downPayment)} down + ~{dollar(results.loanAmount * 0.03)} closing
              </div>
            </div>
            <div className={`rounded-xl border p-4 ${results.dtiBg}`}>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Debt-to-Income Ratio</div>
              <div className={`text-lg font-semibold mt-1 ${results.dtiColor}`}>
                {results.dti.toFixed(1)}%
                <span className="text-xs font-normal ml-1">— {results.dtiLabel}</span>
              </div>
            </div>
          </div>

          {/* Max Affordable */}
          <div className="bg-brand/5 border border-brand/10 rounded-xl p-4">
            <div className="text-xs text-brand uppercase tracking-wide">Max Affordable Home (at 45% DTI)</div>
            <div className="text-lg font-bold text-brand mt-1">{dollar(results.maxPrice)}</div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-500">
            <strong>What&apos;s included:</strong> Principal &amp; interest, property tax, homeowner&apos;s insurance, PMI
            (if less than 20% down), and HOA. Closing costs estimated at 3% of loan amount.
            Actual costs vary by lender, location, and loan type.
          </div>

          <div className="flex gap-3 pt-2">
            <Link href="/portal/apply" className="inline-flex items-center px-5 py-2.5 bg-brand text-[#fff000] text-sm font-medium rounded-2xl hover:bg-brand-dark transition-colors">
              Get pre-approved
            </Link>
            <Link href="/contact" className="inline-flex items-center px-5 py-2.5 border-2 border-brand text-brand text-sm font-medium rounded-2xl hover:bg-brand/5 transition-colors">
              Talk to a loan officer
            </Link>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}

export default function PurchaseCalculatorPage() {
  return <Suspense><PurchaseCalculatorContent /></Suspense>;
}
