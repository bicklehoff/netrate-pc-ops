'use client';

import { useState, useMemo, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

/* ── helpers ─────────────────────────────────────────────────────── */
function dollar(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
function pmt(principal, annualRate, months) {
  const r = annualRate / 100 / 12;
  if (!r) return principal / months;
  return principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

/* ── loan program definitions ────────────────────────────────────── */
const PROGRAMS = {
  conventional: { label: 'Conventional', minDown: 3,   pmiRate: 0.5, pmiLifeOfLoan: false, upfrontFeeRate: 0,      fundingFeeLabel: null },
  fha:          { label: 'FHA',          minDown: 3.5, pmiRate: 0.85, pmiLifeOfLoan: true,  upfrontFeeRate: 1.75,   fundingFeeLabel: 'UFMIP' },
  va:           { label: 'VA',           minDown: 0,   pmiRate: 0,   pmiLifeOfLoan: false, upfrontFeeRate: 2.15,   fundingFeeLabel: 'VA Funding Fee' },
  usda:         { label: 'USDA',         minDown: 0,   pmiRate: 0.35, pmiLifeOfLoan: true,  upfrontFeeRate: 1.0,    fundingFeeLabel: 'Guarantee Fee' },
};

/* ── slider + text input ─────────────────────────────────────────── */
function SliderInput({ label, value, onChange, min, max, step, prefix, suffix, icon }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-ink">{label}</span>
        {icon && <span className="text-ink-subtle">{icon}</span>}
      </div>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle text-sm pointer-events-none">{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          step={step}
          min={min}
          max={max}
          className={`w-full border border-gray-200 rounded-nr-lg py-2.5 text-sm font-semibold text-ink focus:border-brand focus:ring-2 focus:ring-brand/10 outline-none transition-colors tabular-nums ${prefix ? 'pl-7' : 'pl-3'} ${suffix ? 'pr-10' : 'pr-3'}`}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle text-sm pointer-events-none">{suffix}</span>}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="mt-2 w-full h-2 rounded-lg appearance-none cursor-pointer accent-brand bg-gray-200"
      />
      <div className="flex justify-between text-[10px] text-ink-subtle mt-0.5">
        <span>{prefix}{typeof min === 'number' ? min.toLocaleString() : min}</span>
        <span>{prefix}{typeof max === 'number' ? max.toLocaleString() : max}</span>
      </div>
    </div>
  );
}

/* ── simple text input (no slider) ───────────────────────────────── */
function TextInput({ label, prefix, suffix, value, onChange, step, min }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink">{label}</span>
      <div className="mt-1.5 relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle text-sm">{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          step={step || 1}
          min={min || 0}
          className={`w-full border border-gray-200 rounded-nr-lg py-2.5 text-sm focus:border-brand focus:ring-2 focus:ring-brand/10 outline-none transition-colors ${prefix ? 'pl-7' : 'pl-3'} ${suffix ? 'pr-10' : 'pr-3'}`}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle text-sm">{suffix}</span>}
      </div>
    </label>
  );
}

/* ── payment bar segment ─────────────────────────────────────────── */
function PaymentBar({ segments }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (!total) return null;
  return (
    <div className="flex h-3 rounded-full overflow-hidden">
      {segments.map((seg) => {
        const pct = (seg.value / total) * 100;
        if (pct < 0.5) return null;
        return (
          <div
            key={seg.label}
            className={`${seg.color} transition-all duration-300`}
            style={{ width: `${pct}%` }}
            title={`${seg.label}: ${dollar(seg.value)}`}
          />
        );
      })}
    </div>
  );
}

/* ── main calculator ─────────────────────────────────────────────── */
function PurchaseCalculatorContent() {
  const sp = useSearchParams();
  const [program, setProgram] = useState('conventional');
  const [homePrice, setHomePrice] = useState(sp.get('homePrice') || '500000');
  const [downPct, setDownPct] = useState(sp.get('downPct') || '20');
  const [rate, setRate] = useState(sp.get('rate') || '6.875');
  const [term, setTerm] = useState(sp.get('term') || '30');
  const [taxRate, setTaxRate] = useState('0.6');
  const [insurance, setInsurance] = useState('1200');
  const [hoa, setHoa] = useState('0');
  const [income, setIncome] = useState('95000');

  const prog = PROGRAMS[program];
  const DOWN_PRESETS = [
    ...(prog.minDown <= 3 ? [3] : []),
    ...(prog.minDown <= 3.5 && program === 'fha' ? [3.5] : []),
    5, 10, 20
  ].filter((v, i, a) => v >= prog.minDown && a.indexOf(v) === i);

  const handleProgramChange = useCallback((key) => {
    setProgram(key);
    const p = PROGRAMS[key];
    if (parseFloat(downPct) < p.minDown) setDownPct(String(p.minDown));
  }, [downPct]);

  const results = useMemo(() => {
    const price = parseFloat(homePrice) || 0;
    const dp = Math.max(parseFloat(downPct) || 0, prog.minDown) / 100;
    const r = parseFloat(rate) || 0;
    const n = (parseFloat(term) || 30) * 12;
    const tax = (parseFloat(taxRate) || 0.6) / 100;
    const ins = parseFloat(insurance) || 1200;
    const hoaAmt = parseFloat(hoa) || 0;
    const grossIncome = parseFloat(income) || 0;

    if (!price) return null;

    const downPayment = price * dp;
    const baseLoan = price - downPayment;

    // Upfront fee rolled into loan (FHA UFMIP, VA funding fee, USDA guarantee fee)
    const upfrontFee = baseLoan * (prog.upfrontFeeRate / 100);
    const loanAmount = baseLoan + upfrontFee;

    const monthlyPI = pmt(loanAmount, r, n);
    const monthlyTax = (price * tax) / 12;
    const monthlyIns = ins / 12;

    // PMI / MIP calculation per program
    let monthlyPMI = 0;
    if (program === 'conventional') {
      monthlyPMI = dp < 0.2 ? (baseLoan * (prog.pmiRate / 100)) / 12 : 0;
    } else if (program === 'fha' || program === 'usda') {
      monthlyPMI = (baseLoan * (prog.pmiRate / 100)) / 12;
    }
    // VA has no monthly PMI

    const totalMonthly = monthlyPI + monthlyTax + monthlyIns + monthlyPMI + hoaAmt;
    const cashToClose = downPayment + (baseLoan * 0.03); // ~3% closing costs

    const monthlyIncome = grossIncome / 12;
    const dti = monthlyIncome > 0 ? (totalMonthly / monthlyIncome) * 100 : 0;

    let dtiColor, dtiBg, dtiLabel;
    if (dti <= 36) { dtiColor = 'text-green-700'; dtiBg = 'bg-green-50 border-green-200'; dtiLabel = 'Comfortable'; }
    else if (dti <= 45) { dtiColor = 'text-amber-700'; dtiBg = 'bg-amber-50 border-amber-200'; dtiLabel = 'Qualifying'; }
    else { dtiColor = 'text-red-700'; dtiBg = 'bg-red-50 border-red-200'; dtiLabel = 'Over limit'; }

    // Income benchmarks
    const incomeAt28 = monthlyIncome > 0 ? (totalMonthly / 0.28) * 12 : 0;
    const incomeAt36 = monthlyIncome > 0 ? (totalMonthly / 0.36) * 12 : 0;
    const incomeAt45 = monthlyIncome > 0 ? (totalMonthly / 0.45) * 12 : 0;

    // Max affordable price at 45% DTI
    let maxPrice = price;
    for (let i = 0; i < 20; i++) {
      const mLoan = maxPrice * (1 - dp);
      const mPI = pmt(mLoan + mLoan * (prog.upfrontFeeRate / 100), r, n);
      const mTax = (maxPrice * tax) / 12;
      let mPMI = 0;
      if (program === 'conventional') mPMI = dp < 0.2 ? (mLoan * (prog.pmiRate / 100)) / 12 : 0;
      else if (program === 'fha' || program === 'usda') mPMI = (mLoan * (prog.pmiRate / 100)) / 12;
      const mTotal = mPI + mTax + monthlyIns + mPMI + hoaAmt;
      const ratio = (monthlyIncome * 0.45) / mTotal;
      maxPrice = maxPrice * ratio;
      if (Math.abs(ratio - 1) < 0.001) break;
    }

    return {
      downPayment, baseLoan, loanAmount, upfrontFee, monthlyPI, monthlyTax, monthlyIns, monthlyPMI,
      totalMonthly, cashToClose, dti, dtiColor, dtiBg, dtiLabel, maxPrice, hoaAmt,
      incomeAt28, incomeAt36, incomeAt45,
    };
  }, [homePrice, downPct, rate, term, taxRate, insurance, hoa, income, program, prog]);

  const barSegments = results ? [
    { label: 'Principal & Interest', value: results.monthlyPI, color: 'bg-brand' },
    { label: 'Property Tax', value: results.monthlyTax, color: 'bg-go' },
    { label: 'Insurance', value: results.monthlyIns, color: 'bg-sky-400' },
    { label: results.monthlyPMI > 0 ? (program === 'fha' ? 'MIP' : 'PMI') : 'PMI', value: results.monthlyPMI, color: 'bg-amber-400' },
    { label: 'HOA', value: results.hoaAmt, color: 'bg-purple-400' },
  ] : [];

  return (
    <div className="min-h-screen bg-surface-page">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        {/* Header */}
        <div className="mb-6">
          <Link href="/tools" className="text-sm text-brand hover:underline">← Back to tools</Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink mt-3">Mortgage Calculator</h1>
          <p className="text-sm text-ink-subtle mt-1 max-w-xl">
            Estimate payments with PMI, taxes, and insurance. Toggle between Conventional, FHA, VA, and USDA loans.
          </p>
        </div>

        {/* Program Toggle */}
        <div className="flex flex-wrap gap-2 mb-8">
          {Object.entries(PROGRAMS).map(([key, p]) => (
            <button
              key={key}
              onClick={() => handleProgramChange(key)}
              className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-all ${
                program === key
                  ? 'border-brand bg-brand text-white'
                  : 'border-gray-200 bg-white text-ink-mid hover:border-brand/40'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Two-column layout */}
        <div className="flex flex-col lg:flex-row gap-8">

          {/* ── LEFT: Inputs ──────────────────────────────────── */}
          <div className="w-full lg:w-[380px] lg:shrink-0">
            <div className="lg:sticky lg:top-6 space-y-6">

              {/* Property & Loan */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-nr-sm">
                <h2 className="text-xs font-semibold text-ink-subtle uppercase tracking-wide mb-4">Property &amp; Loan</h2>
                <div className="space-y-5">
                  <SliderInput
                    label="Purchase Price"
                    prefix="$"
                    value={homePrice}
                    onChange={setHomePrice}
                    min={100000}
                    max={2000000}
                    step={5000}
                  />

                  <div>
                    <SliderInput
                      label="Down Payment"
                      suffix="%"
                      value={downPct}
                      onChange={setDownPct}
                      min={prog.minDown}
                      max={50}
                      step={0.5}
                    />
                    {/* Preset chips */}
                    <div className="flex gap-2 mt-2">
                      {DOWN_PRESETS.map(pct => (
                        <button
                          key={pct}
                          onClick={() => setDownPct(String(pct))}
                          className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                            parseFloat(downPct) === pct
                              ? 'border-brand bg-brand/10 text-brand'
                              : 'border-gray-200 text-ink-subtle hover:border-brand/30'
                          }`}
                        >
                          {pct}%
                          <span className="text-[10px] text-ink-subtle ml-1 hidden sm:inline">
                            {dollar((parseFloat(homePrice) || 0) * pct / 100)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <SliderInput
                    label="Interest Rate"
                    suffix="%"
                    value={rate}
                    onChange={setRate}
                    min={3}
                    max={12}
                    step={0.125}
                  />

                  {/* Term quick select */}
                  <div>
                    <span className="text-sm font-medium text-ink">Loan Term</span>
                    <div className="flex gap-2 mt-1.5">
                      {[15, 20, 25, 30].map(t => (
                        <button
                          key={t}
                          onClick={() => setTerm(String(t))}
                          className={`flex-1 py-2 rounded-nr-lg text-sm font-medium border transition-all ${
                            parseInt(term) === t
                              ? 'border-brand bg-brand/10 text-brand'
                              : 'border-gray-200 text-ink-mid hover:border-brand/30'
                          }`}
                        >
                          {t}yr
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Taxes, Insurance, HOA */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-nr-sm">
                <h2 className="text-xs font-semibold text-ink-subtle uppercase tracking-wide mb-4">Taxes, Insurance &amp; HOA</h2>
                <div className="space-y-3">
                  <TextInput label="Property Tax Rate" suffix="%" value={taxRate} onChange={setTaxRate} step="0.1" />
                  <TextInput label="Annual Insurance" prefix="$" value={insurance} onChange={setInsurance} step="100" />
                  <TextInput label="Monthly HOA" prefix="$" value={hoa} onChange={setHoa} step="25" />
                </div>
              </div>

              {/* Income */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-nr-sm">
                <h2 className="text-xs font-semibold text-ink-subtle uppercase tracking-wide mb-4">Your Income</h2>
                <TextInput label="Annual Gross Income" prefix="$" value={income} onChange={setIncome} step="1000" />
              </div>
            </div>
          </div>

          {/* ── RIGHT: Results ────────────────────────────────── */}
          {results && (
            <div className="flex-1 space-y-4">

              {/* Payment Hero */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-nr-sm">
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-xs text-ink-subtle uppercase tracking-wide">Monthly Payment</div>
                    <div className="text-4xl font-bold text-ink mt-1 tabular-nums">{dollar(results.totalMonthly)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-ink-subtle">{prog.label}</div>
                    <div className="text-sm font-medium text-ink-mid">{rate}% · {term}yr</div>
                  </div>
                </div>

                {/* Payment composition bar */}
                <div className="mt-4">
                  <PaymentBar segments={barSegments} />
                  {/* Legend */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                    {barSegments.filter(s => s.value > 0).map(seg => (
                      <div key={seg.label} className="flex items-center gap-1.5 text-xs text-ink-mid">
                        <span className={`w-2.5 h-2.5 rounded-full ${seg.color}`} />
                        {seg.label}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Breakdown Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="text-xs text-ink-subtle">Principal &amp; Interest</div>
                  <div className="text-base font-semibold text-ink mt-1 tabular-nums">{dollar(results.monthlyPI)}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="text-xs text-ink-subtle">Property Tax</div>
                  <div className="text-base font-semibold text-ink mt-1 tabular-nums">{dollar(results.monthlyTax)}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="text-xs text-ink-subtle">Insurance</div>
                  <div className="text-base font-semibold text-ink mt-1 tabular-nums">{dollar(results.monthlyIns)}</div>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="text-xs text-ink-subtle">
                    {results.monthlyPMI > 0
                      ? (program === 'fha' ? 'MIP' : program === 'usda' ? 'Annual Fee' : 'PMI')
                      : 'No PMI'}
                  </div>
                  <div className="text-base font-semibold text-ink mt-1 tabular-nums">
                    {results.monthlyPMI > 0 ? dollar(results.monthlyPMI) : '$0'}
                  </div>
                  {results.monthlyPMI > 0 && program === 'conventional' && (
                    <div className="text-[10px] text-ink-subtle mt-0.5">Drops at 20% equity</div>
                  )}
                  {results.monthlyPMI > 0 && prog.pmiLifeOfLoan && (
                    <div className="text-[10px] text-ink-subtle mt-0.5">Life of loan</div>
                  )}
                </div>
              </div>

              {/* Upfront fee callout (FHA/VA/USDA) */}
              {results.upfrontFee > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="text-xs text-amber-700 uppercase tracking-wide">{prog.fundingFeeLabel}</div>
                  <div className="text-lg font-semibold text-amber-800 mt-1">
                    {dollar(results.upfrontFee)}
                    <span className="text-xs font-normal text-amber-600 ml-2">({prog.upfrontFeeRate}% financed into loan)</span>
                  </div>
                  <div className="text-xs text-amber-600 mt-0.5">
                    Loan amount: {dollar(results.baseLoan)} + {dollar(results.upfrontFee)} = {dollar(results.loanAmount)}
                  </div>
                </div>
              )}

              {/* Cash to Close & DTI */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="text-xs text-ink-subtle uppercase tracking-wide">Cash to Close (est.)</div>
                  <div className="text-lg font-semibold text-ink mt-1 tabular-nums">{dollar(results.cashToClose)}</div>
                  <div className="text-xs text-ink-subtle mt-0.5">
                    {dollar(results.downPayment)} down + ~{dollar(results.baseLoan * 0.03)} closing
                  </div>
                </div>
                <div className={`rounded-xl border p-4 ${results.dtiBg}`}>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Debt-to-Income</div>
                  <div className={`text-lg font-semibold mt-1 tabular-nums ${results.dtiColor}`}>
                    {results.dti.toFixed(1)}%
                    <span className="text-xs font-normal ml-1.5">— {results.dtiLabel}</span>
                  </div>
                </div>
              </div>

              {/* Income Benchmarks */}
              {parseFloat(income) > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="text-xs text-ink-subtle uppercase tracking-wide mb-3">Income Needed for This Payment</div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <div className="text-[10px] text-ink-subtle uppercase">Conservative</div>
                      <div className="text-xs text-ink-subtle">28% ratio</div>
                      <div className="text-sm font-semibold text-ink mt-1 tabular-nums">{dollar(results.incomeAt28)}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-ink-subtle uppercase">Standard</div>
                      <div className="text-xs text-ink-subtle">36% ratio</div>
                      <div className="text-sm font-semibold text-ink mt-1 tabular-nums">{dollar(results.incomeAt36)}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-ink-subtle uppercase">Max Qualifying</div>
                      <div className="text-xs text-ink-subtle">45% ratio</div>
                      <div className="text-sm font-semibold text-ink mt-1 tabular-nums">{dollar(results.incomeAt45)}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Max Affordable */}
              <div className="bg-brand/5 border border-brand/10 rounded-xl p-4">
                <div className="text-xs text-brand uppercase tracking-wide">Max Affordable Home (at 45% DTI)</div>
                <div className="text-lg font-bold text-brand mt-1 tabular-nums">{dollar(results.maxPrice)}</div>
              </div>

              {/* Disclaimer */}
              <div className="bg-surface-alt border border-gray-200 rounded-xl p-4 text-xs text-ink-subtle">
                <strong>What&apos;s included:</strong> Principal &amp; interest, property tax, homeowner&apos;s insurance,
                {program === 'fha' ? ' MIP,' : program === 'usda' ? ' annual guarantee fee,' : program === 'conventional' ? ' PMI (if less than 20% down),' : ''}
                {' '}and HOA. {prog.fundingFeeLabel && `${prog.fundingFeeLabel} is financed into the loan amount. `}
                Closing costs estimated at 3% of base loan amount. Actual costs vary by lender, location, and loan type.
              </div>

              {/* CTAs */}
              <div className="flex gap-3 pt-2">
                <Link href="/portal/apply" className="inline-flex items-center px-5 py-2.5 bg-go text-white text-sm font-bold rounded-nr-md hover:bg-go-dark transition-colors">
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
    </div>
  );
}

export default function PurchaseCalculatorPage() {
  return <Suspense><PurchaseCalculatorContent /></Suspense>;
}
