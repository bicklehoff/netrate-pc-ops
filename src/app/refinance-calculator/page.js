'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

function dollar(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
function pmt(principal, annualRate, months) {
  const r = annualRate / 100 / 12;
  if (!r) return principal / months;
  return principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

const STATE_DEFAULTS = {
  CO: { label: 'Colorado', hardCosts: 2800, taxRate: 0.0055, taxSchedule: 'semi-annual', taxDue: ['Mar 1', 'Jun 15'] },
  CA: { label: 'California', hardCosts: 3500, taxRate: 0.0075, taxSchedule: 'semi-annual', taxDue: ['Nov 1', 'Feb 1'] },
  TX: { label: 'Texas', hardCosts: 3200, taxRate: 0.018, taxSchedule: 'annual', taxDue: ['Jan 31'] },
  OR: { label: 'Oregon', hardCosts: 2600, taxRate: 0.0098, taxSchedule: 'semi-annual', taxDue: ['Nov 15', 'May 15'] },
};

function ltvTier(ltv) {
  if (ltv <= 60) return { color: 'text-emerald-700', bg: 'bg-emerald-50' };
  if (ltv <= 70) return { color: 'text-emerald-600', bg: 'bg-emerald-50' };
  if (ltv <= 75) return { color: 'text-green-600', bg: 'bg-green-50' };
  if (ltv <= 80) return { color: 'text-gray-700', bg: 'bg-gray-50' };
  if (ltv <= 85) return { color: 'text-amber-700', bg: 'bg-amber-50' };
  if (ltv <= 90) return { color: 'text-orange-700', bg: 'bg-orange-50' };
  return { color: 'text-red-700', bg: 'bg-red-50' };
}

function NumInput({ label, prefix, suffix, value, onChange, step, min, help }) {
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
      {help && <span className="text-xs text-gray-400 mt-1 block leading-snug">{help}</span>}
    </label>
  );
}

function SelectInput({ label, value, onChange, options, help }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="mt-1 w-full border border-gray-200 rounded-lg py-2.5 px-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/10 outline-none transition-colors bg-white"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {help && <span className="text-xs text-gray-400 mt-1 block leading-snug">{help}</span>}
    </label>
  );
}

function Toggle({ label, checked, onChange, help }) {
  return (
    <div className="flex flex-col">
      <span className="text-sm font-medium text-gray-700 mb-1">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-brand' : 'bg-gray-200'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
      {help && <span className="text-xs text-gray-400 mt-1 block leading-snug">{help}</span>}
    </div>
  );
}

function DateInput({ label, value, onChange, help }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="mt-1 w-full border border-gray-200 rounded-lg py-2.5 px-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/10 outline-none transition-colors"
      />
      {help && <span className="text-xs text-gray-400 mt-1 block leading-snug">{help}</span>}
    </label>
  );
}

const STRATEGY_META = [
  { key: 'balance', name: 'Balance-to-Balance', tag: 'New loan = payoff', color: 'border-emerald-500', tagBg: 'bg-emerald-50 text-emerald-700' },
  { key: 'rollIn', name: 'Roll Everything In', tag: 'Zero out of pocket', color: 'border-blue-500', tagBg: 'bg-blue-50 text-blue-700' },
  { key: 'split', name: 'Split the Difference', tag: 'Balanced approach', color: 'border-amber-500', tagBg: 'bg-amber-50 text-amber-700' },
  { key: 'buyDown', name: 'Buy the Rate Down', tag: 'Lowest payment', color: 'border-purple-500', tagBg: 'bg-purple-50 text-purple-700' },
];

export default function RefinanceCalculatorPage() {
  const [currentBalance, setCurrentBalance] = useState('400000');
  const [currentRate, setCurrentRate] = useState('7.500');
  const [currentPayment, setCurrentPayment] = useState('2661');
  const [propertyValue, setPropertyValue] = useState('550000');
  const [state, setState] = useState('CO');
  const [doesEscrow, setDoesEscrow] = useState(true);
  const [escrowBalance, setEscrowBalance] = useState('4200');
  const [annualTax, setAnnualTax] = useState('');
  const [annualInsurance, setAnnualInsurance] = useState('2400');
  const [insuranceRenewal, setInsuranceRenewal] = useState('');
  const [newRate, setNewRate] = useState('6.500');

  const stateInfo = STATE_DEFAULTS[state];
  const effectiveTax = annualTax ? parseFloat(annualTax) : Math.round((parseFloat(propertyValue) || 0) * stateInfo.taxRate);

  const today = new Date();
  const defaultRenewal = new Date(today.getFullYear(), today.getMonth() + 6, 1).toISOString().slice(0, 10);
  const effectiveRenewal = insuranceRenewal || defaultRenewal;
  const closeDate = new Date(today.getTime() + 30 * 86400000);
  const closeDateStr = closeDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const results = useMemo(() => {
    const bal = parseFloat(currentBalance) || 0;
    const curRate = parseFloat(currentRate) || 0;
    const curPmt = parseFloat(currentPayment) || 0;
    const nRate = parseFloat(newRate) || 0;
    const propVal = parseFloat(propertyValue) || 0;
    const escBal = parseFloat(escrowBalance) || 0;
    const ins = parseFloat(annualInsurance) || 0;

    if (!bal || !curRate || !nRate || !propVal || !curPmt) return null;

    const newTermMonths = 360;
    const si = STATE_DEFAULTS[state];

    // Payoff: balance + 30 days accrued interest (offsets prepaid interest at closing)
    const dailyInterest = bal * (curRate / 100) / 365;
    const accruedInterest = Math.round(dailyInterest * 30);
    const estimatedPayoff = bal + accruedInterest;

    // Hard closing costs (Sections A+B) — state-dependent
    const hardCosts = si.hardCosts;

    // Escrow setup (soft costs)
    let escrowSetup = 0;
    const escrowBreakdown = [];

    if (doesEscrow) {
      const monthlyTax = effectiveTax / 12;
      const taxReserves = Math.round(monthlyTax * 3);
      escrowBreakdown.push({ label: 'Tax reserves (3 mo)', amount: taxReserves });

      const monthlyIns = ins / 12;
      const insReserves = Math.round(monthlyIns * 2);
      escrowBreakdown.push({ label: 'Insurance reserves (2 mo)', amount: insReserves });

      const sixtyDaysOut = new Date(closeDate.getTime() + 60 * 86400000);
      const renewalDate = new Date(effectiveRenewal);
      if (renewalDate <= sixtyDaysOut && renewalDate >= closeDate) {
        escrowBreakdown.push({ label: 'Insurance premium (due within 60 days)', amount: Math.round(ins) });
      }

      const taxDueThisYear = si.taxDue.map(function (d) { return new Date(d + ', ' + closeDate.getFullYear()); });
      for (let t = 0; t < taxDueThisYear.length; t++) {
        const td = taxDueThisYear[t];
        if (td <= sixtyDaysOut && td >= closeDate) {
          const installmentAmt = si.taxSchedule === 'annual' ? effectiveTax : Math.round(effectiveTax / 2);
          escrowBreakdown.push({ label: 'Tax installment (due ' + si.taxDue[t] + ')', amount: installmentAmt });
        }
      }

      escrowSetup = escrowBreakdown.reduce(function (sum, item) { return sum + item.amount; }, 0);
    } else {
      const sixtyDaysOut = new Date(closeDate.getTime() + 60 * 86400000);
      const renewalDate = new Date(effectiveRenewal);
      if (renewalDate <= sixtyDaysOut && renewalDate >= closeDate) {
        escrowBreakdown.push({ label: 'Insurance premium (due within 60 days)', amount: Math.round(ins) });
        escrowSetup = Math.round(ins);
      }
    }

    const totalSoftCosts = escrowSetup;

    // Cash flow back
    const skippedPayment = curPmt;
    const escrowRefund = doesEscrow ? escBal : 0;
    const totalCashBack = skippedPayment + escrowRefund;

    // Strategy 1: Balance-to-Balance
    const s1LoanAmt = estimatedPayoff;
    const s1Pmt = pmt(s1LoanAmt, nRate, newTermMonths);
    const s1CashToClose = totalSoftCosts;
    const s1NetCashFlow = s1CashToClose - totalCashBack;

    // Strategy 2: Roll Everything In
    const s2LoanAmt = estimatedPayoff + totalSoftCosts;
    const s2Pmt = pmt(s2LoanAmt, nRate, newTermMonths);
    const s2NetCashFlow = -totalCashBack;

    // Strategy 3: Split the Difference
    const s3Rate = nRate + 0.125;
    const s3ExtraCredit = Math.round(estimatedPayoff * 0.00375);
    const s3RemainingCosts = Math.max(0, totalSoftCosts - s3ExtraCredit);
    const s3LoanAmt = s3RemainingCosts > 0 ? estimatedPayoff : estimatedPayoff + (totalSoftCosts - s3ExtraCredit);
    const s3FinalLoan = Math.max(s3LoanAmt, estimatedPayoff);
    const s3Pmt = pmt(s3FinalLoan, s3Rate, newTermMonths);
    const s3NetCashFlow = s3RemainingCosts - totalCashBack;

    // Strategy 4: Buy the Rate Down
    const s4Rate = Math.max(nRate - 0.250, 2);
    const s4Points = Math.round(estimatedPayoff * 0.01);
    const s4CashToClose = totalSoftCosts + s4Points;
    const s4Pmt = pmt(estimatedPayoff, s4Rate, newTermMonths);
    const s4NetCashFlow = s4CashToClose - totalCashBack;

    const strategies = [
      {
        key: 'balance', rate: nRate, loanAmount: s1LoanAmt, payment: s1Pmt,
        cashToClose: s1CashToClose, netCashFlow: s1NetCashFlow,
        monthlySavings: curPmt - s1Pmt, ltv: (s1LoanAmt / propVal) * 100,
        notes: doesEscrow
          ? 'Cash to close comes back: ' + dollar(skippedPayment) + ' skipped payment + ' + dollar(escrowRefund) + ' escrow refund = ' + dollar(totalCashBack)
          : dollar(skippedPayment) + ' skipped payment comes back within 30 days',
      },
      {
        key: 'rollIn', rate: nRate, loanAmount: s2LoanAmt, payment: s2Pmt,
        cashToClose: 0, netCashFlow: s2NetCashFlow,
        monthlySavings: curPmt - s2Pmt, ltv: (s2LoanAmt / propVal) * 100,
        notes: 'Zero out of pocket. You keep ' + dollar(totalCashBack) + ' (skipped payment + escrow refund).',
      },
      {
        key: 'split', rate: s3Rate, loanAmount: s3FinalLoan, payment: s3Pmt,
        cashToClose: s3RemainingCosts, netCashFlow: s3NetCashFlow,
        monthlySavings: curPmt - s3Pmt, ltv: (s3FinalLoan / propVal) * 100,
        notes: 'Rate bumped 0.125% to generate ' + dollar(s3ExtraCredit) + ' additional credit' +
          (s3RemainingCosts > 0 ? '. ' + dollar(s3RemainingCosts) + ' still due at close.' : '. Covers all soft costs.'),
      },
      {
        key: 'buyDown', rate: s4Rate, loanAmount: estimatedPayoff, payment: s4Pmt,
        cashToClose: s4CashToClose, netCashFlow: s4NetCashFlow,
        monthlySavings: curPmt - s4Pmt, ltv: (estimatedPayoff / propVal) * 100,
        notes: '1 point (' + dollar(s4Points) + ') buys rate down 0.250%. Cash to close includes points + soft costs.',
      },
    ];

    for (const s of strategies) {
      const netSpend = Math.max(0, s.netCashFlow);
      if (s.monthlySavings > 0 && netSpend > 0) {
        s.breakeven = Math.ceil(netSpend / s.monthlySavings);
      } else if (s.monthlySavings > 0) {
        s.breakeven = 0;
      } else {
        s.breakeven = null;
      }
    }

    return { estimatedPayoff, accruedInterest, hardCosts, escrowSetup, escrowBreakdown, totalCashBack, skippedPayment, escrowRefund, strategies };
  }, [currentBalance, currentRate, currentPayment, newRate, propertyValue, state, doesEscrow, escrowBalance, annualInsurance, effectiveRenewal, effectiveTax]);

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <Link href="/refinance-playbook" className="text-sm text-brand hover:underline">&larr; Back to Refinance Playbook</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-3">Refinance Calculator</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            Four ways to structure a refinance — same borrower, same rate drop, different trade-offs.
            Enter your numbers and see how the cash flow actually works.
          </p>
        </div>

        {/* Section 1: Current Loan */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-6">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Your Current Loan</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <NumInput label="Principal Balance" prefix="$" value={currentBalance} onChange={setCurrentBalance} step="5000" help="From your latest statement" />
            <NumInput label="Current Rate" suffix="%" value={currentRate} onChange={setCurrentRate} step="0.125" />
            <NumInput label="Current Payment" prefix="$" value={currentPayment} onChange={setCurrentPayment} step="10" help="P&I only (exclude escrow)" />
            <NumInput label="Property Value" prefix="$" value={propertyValue} onChange={setPropertyValue} step="5000" />
            <SelectInput label="State" value={state} onChange={setState}
              options={Object.entries(STATE_DEFAULTS).map(([k, v]) => ({ value: k, label: v.label }))} />
          </div>
          {results && (
            <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-500 flex flex-wrap gap-x-6 gap-y-1">
              <span>Estimated payoff: <span className="font-semibold text-gray-900">{dollar(results.estimatedPayoff)}</span></span>
              <span className="text-gray-300">|</span>
              <span className="text-xs text-gray-400">Balance + {dollar(results.accruedInterest)} accrued interest (30 days)</span>
            </div>
          )}
        </div>

        {/* Section 2: Escrow & Insurance */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-6">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">Escrow &amp; Insurance</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 items-start">
            <Toggle label="Escrow for taxes/insurance?" checked={doesEscrow} onChange={setDoesEscrow} help="Most loans require escrow" />
            {doesEscrow && (
              <NumInput label="Current Escrow Balance" prefix="$" value={escrowBalance} onChange={setEscrowBalance} step="100" help="This gets refunded when your old loan closes" />
            )}
            <NumInput label="Annual Property Tax" prefix="$" value={annualTax || String(effectiveTax)} onChange={setAnnualTax} step="100"
              help={'Default: ' + stateInfo.label + ' avg (' + (stateInfo.taxRate * 100).toFixed(2) + '% of value)'} />
            <NumInput label="Annual Insurance" prefix="$" value={annualInsurance} onChange={setAnnualInsurance} step="100" help="Homeowner's insurance premium" />
            <DateInput label="Insurance Renewal" value={effectiveRenewal} onChange={setInsuranceRenewal}
              help="Anything due within 60 days of close must be paid at closing" />
          </div>
          {doesEscrow && (
            <p className="mt-3 text-xs text-gray-400">
              Tax due dates in {stateInfo.label}: {stateInfo.taxDue.join(', ')} ({stateInfo.taxSchedule})
            </p>
          )}
        </div>

        {/* Section 3: New Rate */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-6">
          <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">New Rate</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <NumInput label="Par Rate" suffix="%" value={newRate} onChange={setNewRate} step="0.125" help="The rate where lender credit covers hard costs" />
            <div className="flex flex-col justify-end text-sm text-gray-500 pb-1">
              <span>Estimated close: <span className="font-medium text-gray-700">{closeDateStr}</span></span>
              <span className="text-xs text-gray-400">30 days from today</span>
            </div>
            {results && (
              <div className="flex flex-col justify-end text-sm text-gray-500 pb-1">
                <span>Hard closing costs: <span className="font-medium text-gray-700">{dollar(results.hardCosts)}</span></span>
                <span className="text-xs text-gray-400">Sections A+B ({stateInfo.label} estimate)</span>
              </div>
            )}
          </div>
        </div>

        {/* Cost Breakdown */}
        {results && results.escrowBreakdown.length > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6 text-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700">Closing Cost Breakdown</h3>
              <span className="text-xs text-gray-400">These numbers feed into each strategy below</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-white rounded-lg p-3 border border-gray-100">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Hard Costs (A+B)</div>
                <div className="font-semibold text-gray-900">{dollar(results.hardCosts)}</div>
                <div className="text-xs text-gray-400">Covered by lender credit at par</div>
              </div>
              {results.escrowBreakdown.map((item, i) => (
                <div key={i} className="bg-white rounded-lg p-3 border border-gray-100">
                  <div className="text-xs text-gray-500 uppercase tracking-wide">{item.label}</div>
                  <div className="font-semibold text-gray-900">{dollar(item.amount)}</div>
                </div>
              ))}
              <div className="bg-white rounded-lg p-3 border border-gray-100">
                <div className="text-xs text-gray-500 uppercase tracking-wide">Total Soft Costs</div>
                <div className="font-semibold text-gray-900">{dollar(results.escrowSetup)}</div>
                <div className="text-xs text-gray-400">This is what varies by strategy</div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Cash Flow Back (within 30 days)</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                  <div className="text-xs text-emerald-600 uppercase tracking-wide">Skipped Payment</div>
                  <div className="font-semibold text-emerald-800">{dollar(results.skippedPayment)}</div>
                  <div className="text-xs text-emerald-500">One current payment you don&apos;t make</div>
                </div>
                {doesEscrow && (
                  <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                    <div className="text-xs text-emerald-600 uppercase tracking-wide">Escrow Refund</div>
                    <div className="font-semibold text-emerald-800">{dollar(results.escrowRefund)}</div>
                    <div className="text-xs text-emerald-500">Old escrow account closes, balance returned</div>
                  </div>
                )}
                <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                  <div className="text-xs text-emerald-600 uppercase tracking-wide">Total Cash Back</div>
                  <div className="font-semibold text-emerald-800">{dollar(results.totalCashBack)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Strategy Cards */}
        {results && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {results.strategies.map((s, i) => {
              const meta = STRATEGY_META[i];
              const savingsPositive = s.monthlySavings > 0;
              const tier = ltvTier(s.ltv);
              const needsPmi = s.ltv > 80;
              return (
                <div key={meta.key} className={`bg-white rounded-xl border-2 ${meta.color} p-6 shadow-sm`}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{meta.name}</h3>
                      <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${meta.tagBg}`}>{meta.tag}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">{s.rate.toFixed(3)}%</div>
                      <div className="text-xs text-gray-400">rate</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500 uppercase tracking-wide">New Payment</div>
                      <div className="text-lg font-semibold text-gray-900">{dollar(s.payment)}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500 uppercase tracking-wide">Monthly Savings</div>
                      <div className={`text-lg font-semibold ${savingsPositive ? 'text-emerald-700' : 'text-red-600'}`}>
                        {savingsPositive ? '+' : ''}{dollar(s.monthlySavings)}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500 uppercase tracking-wide">New Loan Amount</div>
                      <div className="text-lg font-semibold text-gray-900">{dollar(s.loanAmount)}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500 uppercase tracking-wide">Cash to Close</div>
                      <div className="text-lg font-semibold text-gray-900">{s.cashToClose === 0 ? '$0' : dollar(s.cashToClose)}</div>
                    </div>
                  </div>

                  {/* Net cash flow */}
                  <div className={`rounded-lg p-3 mb-3 ${s.netCashFlow <= 0 ? 'bg-emerald-50 border border-emerald-100' : 'bg-amber-50 border border-amber-100'}`}>
                    <div className="flex items-center justify-between">
                      <div className={`text-xs font-medium uppercase tracking-wide ${s.netCashFlow <= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                        Net Out-of-Pocket (after cash back)
                      </div>
                      <div className={`text-lg font-bold ${s.netCashFlow <= 0 ? 'text-emerald-800' : 'text-amber-800'}`}>
                        {s.netCashFlow <= 0 ? '+' + dollar(Math.abs(s.netCashFlow)) + ' in pocket' : dollar(s.netCashFlow)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm border-t border-gray-100 pt-3">
                    <div>
                      <span className="text-gray-500">LTV: </span>
                      <span className={`font-semibold px-1.5 py-0.5 rounded ${needsPmi ? 'bg-red-50 text-red-700' : tier.bg + ' ' + tier.color}`}>
                        {s.ltv.toFixed(1)}%
                      </span>
                      {needsPmi && <span className="ml-1.5 text-xs font-medium text-red-600">PMI required</span>}
                    </div>
                    <div className="text-gray-500">
                      Breakeven:{' '}
                      <span className="font-medium text-gray-700">
                        {s.breakeven === 0 ? 'Immediate' : s.breakeven === null ? 'N/A' : s.breakeven + ' mo'}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-gray-400 mt-3">{s.notes}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Explanation */}
        <div className="mt-8 bg-gray-50 border border-gray-200 rounded-xl p-6 text-sm text-gray-600 space-y-3">
          <p>
            <strong>How to read this:</strong> All four options start from the same rate drop.
            The difference is how you handle closing costs — who pays, and where the money comes from.
          </p>
          <p>
            <strong>Balance-to-balance</strong> means your new loan equals your current payoff — you don&apos;t add to your debt.{' '}
            <strong>Roll everything in</strong> maximizes cash freedom.{' '}
            <strong>Split the difference</strong> finds the middle ground.{' '}
            <strong>Buy the rate down</strong> trades upfront cash for the lowest possible payment.
          </p>
          <p>
            &ldquo;Net out-of-pocket&rdquo; accounts for the skipped payment and escrow refund you receive within ~30 days of closing.
            This is the real number — not the Loan Estimate &ldquo;cash to close&rdquo; that scares most borrowers away.{' '}
            <Link href="/refinance-playbook" className="text-brand hover:underline">Read the full playbook</Link> for how the cash flow works.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex gap-3 mt-6">
          <Link href="/rates" className="inline-flex items-center px-5 py-2.5 bg-brand text-white text-sm font-medium rounded-2xl hover:bg-brand-dark transition-colors">
            See today&apos;s rates
          </Link>
          <Link href="/contact" className="inline-flex items-center px-5 py-2.5 border-2 border-brand text-brand text-sm font-medium rounded-2xl hover:bg-brand/5 transition-colors">
            Talk to a loan officer
          </Link>
        </div>

        <p className="text-xs text-gray-400 mt-8 pt-4 border-t border-gray-100">
          This calculator provides estimates for educational purposes only. Actual closing costs, lender credits, rates,
          escrow requirements, and insurance timing vary by lender, loan program, and market conditions.
          Licensed in CA, CO, OR, and TX. NMLS #1111861.
        </p>
      </div>
    </div>
  );
}
