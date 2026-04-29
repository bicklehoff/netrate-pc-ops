/**
 * purchase-calculator v1 — StandaloneView.
 *
 * Full-page UI for /tools/purchase-calculator. Replaces
 * src/app/tools/purchase-calculator/content.js. Same inputs, same
 * numbers, same UI; uses useCompute hook with the local moduleStub.
 */

'use client';

import { useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { fmtDollars, fmtPct } from '@/lib/formatters';
import { useCompute } from '../../useCompute.js';
import { compute } from './compute.js';
import { schema } from './schema.js';

const moduleStub = {
  id: 'purchase-calculator',
  version: 1,
  inputSchema: schema,
  compute,
  capabilities: { needsRates: false, needsToday: false, attachable: true },
};

const DEFAULT_CONFIG = {
  pmi_annual_rate: 0.005,
  closing_cost_pct: 0.03,
  dti_comfortable: 36,
  dti_qualifying: 45,
};

const DTI_STYLE = {
  good: { color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  neutral: { color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  bad: { color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
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

const FALLBACK_RATE = '6.875';

function PurchaseCalculatorContent({ parRate }) {
  const sp = useSearchParams();
  const defaultRate = parRate != null ? parRate.toFixed(3) : FALLBACK_RATE;
  const [homePrice, setHomePrice] = useState(sp.get('homePrice') || '450000');
  const [downPct, setDownPct] = useState(sp.get('downPct') || '3');
  const [rate, setRate] = useState(sp.get('rate') || defaultRate);
  const [term, setTerm] = useState(sp.get('term') || '30');
  const [taxRate, setTaxRate] = useState('0.6');
  const [insurance, setInsurance] = useState('1200');
  const [hoa, setHoa] = useState('0');
  const [income, setIncome] = useState('95000');

  const computeInput = useMemo(() => {
    const price = parseFloat(homePrice) || 0;
    const dp = parseFloat(downPct);
    const r = parseFloat(rate) || 0;
    const t = parseFloat(term) || 30;
    if (!price || !r || Number.isNaN(dp)) return null;
    return {
      scenario: {
        home_price: price,
        down_payment_pct: dp,
        rate: r,
        term_years: t,
        property_tax_rate_pct: parseFloat(taxRate) || 0.6,
        annual_insurance: parseFloat(insurance) || 1200,
        monthly_hoa: parseFloat(hoa) || 0,
        annual_income: parseFloat(income) || 0,
      },
      config: DEFAULT_CONFIG,
    };
  }, [homePrice, downPct, rate, term, taxRate, insurance, hoa, income]);

  const { result, error } = useCompute(moduleStub, computeInput, { debounceMs: 0 });

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <Link href="/tools" className="text-sm text-brand hover:underline">← Back to tools</Link>
          <div className="text-2xl font-bold text-gray-900 mt-3">Purchase Calculator</div>
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

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Couldn&apos;t compute: {error.message}
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
              <div className="text-xs text-gray-500 uppercase tracking-wide">Estimated Monthly Payment</div>
              <div className="text-4xl font-bold text-gray-900 mt-1 tabular-nums">{fmtDollars(result.totalMonthly)}</div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs text-gray-500">Principal &amp; Interest</div>
                <div className="text-base font-semibold text-gray-900 mt-1">{fmtDollars(result.monthlyPI)}</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs text-gray-500">Property Tax</div>
                <div className="text-base font-semibold text-gray-900 mt-1">{fmtDollars(result.monthlyTax)}</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs text-gray-500">Insurance</div>
                <div className="text-base font-semibold text-gray-900 mt-1">{fmtDollars(result.monthlyIns)}</div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs text-gray-500">{result.monthlyPMI > 0 ? 'PMI' : 'No PMI'}</div>
                <div className="text-base font-semibold text-gray-900 mt-1">{fmtDollars(result.monthlyPMI)}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Cash to Close (est.)</div>
                <div className="text-lg font-semibold text-gray-900 mt-1">{fmtDollars(result.cashToClose)}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {fmtDollars(result.downPayment)} down + ~{fmtDollars(result.closingCostsEstimate)} closing
                </div>
              </div>
              <div className={`rounded-xl border p-4 ${DTI_STYLE[result.dtiTone].bg}`}>
                <div className="text-xs text-gray-500 uppercase tracking-wide">Debt-to-Income Ratio</div>
                <div className={`text-lg font-semibold mt-1 ${DTI_STYLE[result.dtiTone].color}`}>
                  {fmtPct(result.dti)}
                  <span className="text-xs font-normal ml-1">— {result.dtiLabel}</span>
                </div>
              </div>
            </div>

            <div className="bg-brand/5 border border-brand/10 rounded-xl p-4">
              <div className="text-xs text-brand uppercase tracking-wide">Max Affordable Home (at 45% DTI)</div>
              <div className="text-lg font-bold text-brand mt-1">{fmtDollars(result.maxPrice)}</div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-500">
              <strong>What&apos;s included:</strong> Principal &amp; interest, property tax, homeowner&apos;s insurance, PMI
              (if less than 20% down), and HOA. Closing costs estimated at 3% of loan amount.
              Actual costs vary by lender, location, and loan type.
            </div>

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
  );
}

export default function StandaloneView({ parRate = null }) {
  return (
    <Suspense>
      <PurchaseCalculatorContent parRate={parRate} />
    </Suspense>
  );
}
