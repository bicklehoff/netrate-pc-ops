'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

function dollar(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
function pmt(principal, annualRate, months) {
  const r = annualRate / 100 / 12;
  if (!r) return principal / months;
  return principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

function Input({ label, prefix, suffix, value, onChange, step, min, help }) {
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
      {help && <span className="text-xs text-gray-400 mt-0.5 block">{help}</span>}
    </label>
  );
}

const STRATEGY_META = [
  {
    key: 'balance',
    name: 'Balance-to-Balance',
    tag: 'Keep loan flat',
    color: 'border-emerald-500',
    tagBg: 'bg-emerald-50 text-emerald-700',
    desc: 'New loan = current payoff. Lender credit covers hard costs. You bring cash for escrow/prepaids (comes back within 30 days).',
  },
  {
    key: 'rollIn',
    name: 'Roll Everything In',
    tag: 'Zero out of pocket',
    color: 'border-blue-500',
    tagBg: 'bg-blue-50 text-blue-700',
    desc: 'All costs rolled into the loan. Higher balance, but zero cash to close. You keep missed payment + escrow refund.',
  },
  {
    key: 'split',
    name: 'Split the Difference',
    tag: 'Balanced approach',
    color: 'border-amber-500',
    tagBg: 'bg-amber-50 text-amber-700',
    desc: 'Bump rate slightly for a larger lender credit. Less (or no) cash to close, loan amount stays manageable.',
  },
  {
    key: 'buyDown',
    name: 'Buy the Rate Down',
    tag: 'Lowest payment',
    color: 'border-purple-500',
    tagBg: 'bg-purple-50 text-purple-700',
    desc: 'Pay points upfront for the lowest rate. Highest closing costs, but lowest monthly payment for the life of the loan.',
  },
];

export default function RefinanceCalculatorPage() {
  const [currentRate, setCurrentRate] = useState('7.500');
  const [currentBalance, setCurrentBalance] = useState('400000');
  const [newRate, setNewRate] = useState('6.500');
  const [propertyValue, setPropertyValue] = useState('550000');
  const [remainingTerm, setRemainingTerm] = useState('27');

  const results = useMemo(() => {
    const bal = parseFloat(currentBalance) || 0;
    const curRate = parseFloat(currentRate) || 0;
    const nRate = parseFloat(newRate) || 0;
    const propVal = parseFloat(propertyValue) || 0;
    const remYrs = parseFloat(remainingTerm) || 27;

    if (!bal || !curRate || !nRate || !propVal) return null;

    const newTermMonths = 360; // 30yr fixed
    const currentPmt = pmt(bal, curRate, remYrs * 12);

    // Estimated costs
    const hardCosts = 2500; // Sections A+B: appraisal, title, recording, etc.
    const escrowPrepaids = Math.round(propVal * 0.015); // ~1.5% of value for escrow setup + prepaids
    const totalClosingCosts = hardCosts + escrowPrepaids;

    // Points/credit pricing: rough model
    // At par rate: ~0 points. Each 0.125% bump = ~0.375% credit. Each 0.125% drop = ~0.5% cost.
    const parRate = nRate;

    // Strategy 1: Balance-to-Balance
    // Loan = current payoff (use balance as proxy). Lender credit covers hard costs.
    // Borrower brings escrow/prepaids to closing.
    const s1LoanAmt = bal;
    const s1Rate = parRate;
    const s1Pmt = pmt(s1LoanAmt, s1Rate, newTermMonths);
    const s1CashToClose = escrowPrepaids;
    const s1MonthlySavings = currentPmt - s1Pmt;

    // Strategy 2: Roll Everything In
    // All costs added to loan. Zero cash.
    const s2LoanAmt = bal + totalClosingCosts;
    const s2Rate = parRate;
    const s2Pmt = pmt(s2LoanAmt, s2Rate, newTermMonths);
    const s2CashToClose = 0;
    const s2MonthlySavings = currentPmt - s2Pmt;
    const s2Ltv = (s2LoanAmt / propVal) * 100;

    // Strategy 3: Split the Difference
    // Bump rate 0.125% for more credit. Covers most/all soft costs.
    const s3RateBump = 0.125;
    const s3Rate = parRate + s3RateBump;
    const s3ExtraCredit = Math.round(bal * 0.00375); // ~0.375% of loan for 0.125% rate bump
    const s3BorrowerCash = Math.max(0, escrowPrepaids - s3ExtraCredit);
    const s3FinalLoan = s3BorrowerCash === 0 ? bal + (escrowPrepaids - s3ExtraCredit) : bal;
    const s3Pmt = pmt(Math.max(s3FinalLoan, bal), s3Rate, newTermMonths);
    const s3MonthlySavings = currentPmt - s3Pmt;

    // Strategy 4: Buy the Rate Down
    // Pay 1 point (1% of loan) to drop rate 0.25%
    const s4RateDrop = 0.250;
    const s4Rate = Math.max(parRate - s4RateDrop, 2);
    const s4Points = Math.round(bal * 0.01); // 1 point
    const s4LoanAmt = bal;
    const s4CashToClose = escrowPrepaids + s4Points;
    const s4Pmt = pmt(s4LoanAmt, s4Rate, newTermMonths);
    const s4MonthlySavings = currentPmt - s4Pmt;

    const strategies = [
      {
        key: 'balance',
        rate: s1Rate,
        loanAmount: s1LoanAmt,
        payment: s1Pmt,
        cashToClose: s1CashToClose,
        monthlySavings: s1MonthlySavings,
        ltv: (s1LoanAmt / propVal) * 100,
        notes: 'Escrow/prepaids come back via missed payment + old escrow refund (~30 days)',
      },
      {
        key: 'rollIn',
        rate: s2Rate,
        loanAmount: s2LoanAmt,
        payment: s2Pmt,
        cashToClose: s2CashToClose,
        monthlySavings: s2MonthlySavings,
        ltv: s2Ltv,
        notes: 'Higher loan amount but zero out of pocket. Keep missed payment + escrow refund.',
      },
      {
        key: 'split',
        rate: s3Rate,
        loanAmount: Math.max(s3FinalLoan, bal),
        payment: s3Pmt,
        cashToClose: s3BorrowerCash,
        monthlySavings: s3MonthlySavings,
        ltv: (Math.max(s3FinalLoan, bal) / propVal) * 100,
        notes: `Rate bumped 0.125% to generate ~${dollar(s3ExtraCredit)} additional credit`,
      },
      {
        key: 'buyDown',
        rate: s4Rate,
        loanAmount: s4LoanAmt,
        payment: s4Pmt,
        cashToClose: s4CashToClose,
        monthlySavings: s4MonthlySavings,
        ltv: (s4LoanAmt / propVal) * 100,
        notes: `1 point (${dollar(s4Points)}) buys rate down 0.250%`,
      },
    ];

    // Add breakeven for each
    for (const s of strategies) {
      if (s.monthlySavings > 0 && s.cashToClose > 0) {
        s.breakeven = Math.ceil(s.cashToClose / s.monthlySavings);
      } else if (s.monthlySavings > 0) {
        s.breakeven = 0; // Immediate — no cash spent
      } else {
        s.breakeven = null; // No savings
      }
    }

    return { currentPmt, strategies };
  }, [currentBalance, currentRate, newRate, propertyValue, remainingTerm]);

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <Link href="/refinance-playbook" className="text-sm text-brand hover:underline">&larr; Back to Refinance Playbook</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-3">Refinance Calculator</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl">
            Four ways to structure a refinance — same borrower, same rate drop, different trade-offs.
            Enter your numbers and compare side by side.
          </p>
        </div>

        {/* Inputs */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <Input label="Current Rate" suffix="%" value={currentRate} onChange={setCurrentRate} step="0.125" />
            <Input label="Current Balance" prefix="$" value={currentBalance} onChange={setCurrentBalance} step="5000" />
            <Input label="New Rate" suffix="%" value={newRate} onChange={setNewRate} step="0.125" help="Par rate from rate tool" />
            <Input label="Property Value" prefix="$" value={propertyValue} onChange={setPropertyValue} step="5000" />
            <Input label="Remaining Term" suffix="yr" value={remainingTerm} onChange={setRemainingTerm} />
          </div>
          {results && (
            <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-500">
              Current payment: <span className="font-semibold text-gray-900">{dollar(results.currentPmt)}</span>/mo
            </div>
          )}
        </div>

        {/* Strategy Cards */}
        {results && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {results.strategies.map((s, i) => {
              const meta = STRATEGY_META[i];
              const savingsPositive = s.monthlySavings > 0;
              return (
                <div key={meta.key} className={`bg-white rounded-xl border-2 ${meta.color} p-6 shadow-sm`}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{meta.name}</h3>
                      <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mt-1 ${meta.tagBg}`}>
                        {meta.tag}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">{s.rate.toFixed(3)}%</div>
                      <div className="text-xs text-gray-400">rate</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
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
                      <div className="text-lg font-semibold text-gray-900">
                        {s.cashToClose === 0 ? '$0' : dollar(s.cashToClose)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm border-t border-gray-100 pt-3">
                    <div className="text-gray-500">
                      LTV: <span className="font-medium text-gray-700">{s.ltv.toFixed(1)}%</span>
                    </div>
                    <div className="text-gray-500">
                      Breakeven:{' '}
                      <span className="font-medium text-gray-700">
                        {s.breakeven === 0 ? 'Immediate' : s.breakeven === null ? 'N/A' : `${s.breakeven} mo`}
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
            <strong>Balance-to-balance</strong> keeps your loan flat. <strong>Roll everything in</strong> maximizes cash freedom.{' '}
            <strong>Split the difference</strong> finds the middle ground. <strong>Buy the rate down</strong> trades upfront cash for the lowest possible payment.
          </p>
          <p>
            These are estimates. Your actual numbers depend on the rate sheet, lender fees, property taxes, and insurance.{' '}
            <Link href="/refinance-playbook" className="text-brand hover:underline">Read the full playbook</Link> for how the cash flow works.
          </p>
        </div>

        {/* CTAs */}
        <div className="flex gap-3 mt-6">
          <Link href="/rates" className="inline-flex items-center px-5 py-2.5 bg-brand text-[#fff000] text-sm font-medium rounded-2xl hover:bg-brand-dark transition-colors">
            See today&apos;s rates
          </Link>
          <Link href="/contact" className="inline-flex items-center px-5 py-2.5 border-2 border-brand text-brand text-sm font-medium rounded-2xl hover:bg-brand/5 transition-colors">
            Talk to a loan officer
          </Link>
        </div>

        <p className="text-xs text-gray-400 mt-8 pt-4 border-t border-gray-100">
          This calculator provides estimates for educational purposes only. Actual closing costs, lender credits, and rates
          vary by lender, loan program, and market conditions. Licensed in CA, CO, OR, and TX. NMLS #1111861.
        </p>
      </div>
    </div>
  );
}
