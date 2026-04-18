'use client';

/**
 * Equity Access Comparison — 2nd lien vs cash-out refi.
 *
 * Standalone calculator. User enters rates. Pure math — no pricer calls, no
 * invented LLPA adjustments. When 2nd-lien pricing lands in the engine, swap
 * the rate inputs for pricer-sourced defaults with user override.
 */

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { calculateMonthlyPI } from '@/lib/mortgage-math';
import { fmtDollars, fmtRate, fmtPct } from '@/lib/formatters';

function Input({ label, prefix, suffix, value, onChange, placeholder, step }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
            {prefix}
          </span>
        )}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          step={step}
          className={`w-full py-2 border border-gray-300 rounded-lg text-sm focus:border-brand focus:ring-2 focus:ring-brand/10 outline-none transition-colors ${
            prefix ? 'pl-7' : 'pl-3'
          } ${suffix ? 'pr-8' : 'pr-3'}`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

export default function SubFinancingComparison() {
  const [inputs, setInputs] = useState({
    firstBalance: '',
    firstRate: '',
    firstRemainingYears: '27',
    propertyValue: '',
    cashDesired: '',
    secondType: 'heloan', // 'heloan' (fixed, P&I) | 'heloc' (variable, I/O draw)
    heloanRate: '',
    heloanTerm: '30', // HELOAN term OR HELOC draw period
    cashoutRate: '',
    cashoutTerm: '30',
    holdYears: '7',
  });

  const update = (field, value) => setInputs((prev) => ({ ...prev, [field]: value }));

  // Toggling 2nd-lien type flips term + hold-period defaults. HELOCs are
  // short-term instruments (pay off or refi within the draw period);
  // HELOANs amortize over 30y like a traditional 2nd mortgage.
  const setSecondType = (type) => {
    setInputs((prev) => ({
      ...prev,
      secondType: type,
      heloanTerm: type === 'heloc' ? '5' : '30',
      holdYears: type === 'heloc' ? '5' : prev.holdYears,
    }));
  };

  const result = useMemo(() => {
    const firstBalance = Number(inputs.firstBalance) || 0;
    const firstRate = Number(inputs.firstRate) || 0;
    const firstRemainingYears = Number(inputs.firstRemainingYears) || 30;
    const propertyValue = Number(inputs.propertyValue) || 0;
    const cashDesired = Number(inputs.cashDesired) || 0;
    const secondType = inputs.secondType;
    const heloanRate = Number(inputs.heloanRate) || 0;
    const heloanTerm = Number(inputs.heloanTerm) || (secondType === 'heloc' ? 5 : 30);
    const cashoutRate = Number(inputs.cashoutRate) || 0;
    const cashoutTerm = Number(inputs.cashoutTerm) || 30;
    const holdYears = Number(inputs.holdYears) || 7;

    if (!firstBalance || !firstRate || !propertyValue || !cashDesired || !heloanRate || !cashoutRate) {
      return null;
    }

    // Option A — Open a new 2nd lien. First mortgage stays as-is.
    const firstMonthlyPI = calculateMonthlyPI(firstRate, firstBalance, firstRemainingYears) || 0;
    // HELOC = interest-only during draw: balance × annual rate / 12. No principal paydown.
    // HELOAN = fully amortizing P&I like a traditional 2nd mortgage.
    const heloanMonthlyPI =
      secondType === 'heloc'
        ? (cashDesired * heloanRate) / 100 / 12
        : calculateMonthlyPI(heloanRate, cashDesired, heloanTerm) || 0;
    const helocHoldExceedsDraw = secondType === 'heloc' && holdYears > heloanTerm;
    const optionATotalBalance = firstBalance + cashDesired;
    const optionACltv = (optionATotalBalance / propertyValue) * 100;
    const optionATotalMonthly = firstMonthlyPI + heloanMonthlyPI;
    const optionAHoldCashPaid = optionATotalMonthly * 12 * holdYears;
    const optionABlendedRate =
      optionATotalBalance > 0
        ? (firstBalance * firstRate + cashDesired * heloanRate) / optionATotalBalance
        : 0;
    const optionACltvWarn = optionACltv > 85;

    // Option B — Cash-out refi. Single new loan at cash-out rate.
    const optionBLoanAmount = firstBalance + cashDesired;
    const optionBLtv = (optionBLoanAmount / propertyValue) * 100;
    const optionBMonthlyPI = calculateMonthlyPI(cashoutRate, optionBLoanAmount, cashoutTerm) || 0;
    const optionBHoldCashPaid = optionBMonthlyPI * 12 * holdYears;
    const optionBLtvWarn = optionBLtv > 80;

    const monthlyDelta = optionBMonthlyPI - optionATotalMonthly;
    const holdCostDelta = optionBHoldCashPaid - optionAHoldCashPaid;

    let winner, reason;
    if (optionBLtvWarn) {
      winner = 'heloan';
      reason = `Cash-out refinancing above 80% LTV is restricted for conventional loans — a new 2nd lien is your path to this cash.`;
    } else if (monthlyDelta > 50) {
      winner = 'heloan';
      const productLabel = secondType === 'heloc' ? 'a HELOC' : 'a new 2nd lien';
      reason = `Opening ${productLabel} is ${fmtDollars(monthlyDelta)}/mo cheaper because you keep your ${fmtRate(firstRate)} first mortgage rate instead of replacing it at ${fmtRate(cashoutRate)}.`;
    } else if (monthlyDelta < -50) {
      winner = 'cashout';
      reason = `Cash-out refinancing is ${fmtDollars(Math.abs(monthlyDelta))}/mo cheaper. Your current first rate is high enough that replacing the whole balance at ${fmtRate(cashoutRate)} still saves money.`;
    } else {
      winner = 'close';
      reason = `Both options are within ~$50/mo. Consider simplicity (one payment vs. two) and whether you want to preserve your current first rate.`;
    }

    return {
      firstBalance,
      firstRate,
      propertyValue,
      cashDesired,
      holdYears,
      secondType,
      heloanTerm,
      optionA: {
        firstMonthlyPI,
        heloanMonthlyPI,
        totalMonthly: optionATotalMonthly,
        cltv: optionACltv,
        cltvWarn: optionACltvWarn,
        blendedRate: optionABlendedRate,
        holdCashPaid: optionAHoldCashPaid,
        helocHoldExceedsDraw,
      },
      optionB: {
        loanAmount: optionBLoanAmount,
        ltv: optionBLtv,
        monthlyPI: optionBMonthlyPI,
        holdCashPaid: optionBHoldCashPaid,
        ltvWarn: optionBLtvWarn,
      },
      comparison: { monthlyDelta, holdCostDelta, winner, reason },
    };
  }, [inputs]);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
        Tap Your Equity: 2nd Lien vs. Cash-Out Refi
      </h1>
      <p className="text-gray-600 mb-6 text-sm sm:text-base">
        If you have a low first mortgage rate from the last few years, cash-out refinancing
        replaces it at today&apos;s rates — on the whole balance. Opening a new 2nd lien keeps
        your low first rate and only puts today&apos;s rate on the new borrowing. Here&apos;s
        the math on both.
      </p>

      {/* Inputs */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Your Situation</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Input
            label="First Mortgage Balance"
            prefix="$"
            value={inputs.firstBalance}
            onChange={(v) => update('firstBalance', v)}
            placeholder="e.g. 350000"
          />
          <Input
            label="Current First Rate"
            suffix="%"
            value={inputs.firstRate}
            onChange={(v) => update('firstRate', v)}
            placeholder="e.g. 3.5"
            step="0.125"
          />
          <Input
            label="First Remaining Years"
            value={inputs.firstRemainingYears}
            onChange={(v) => update('firstRemainingYears', v)}
            placeholder="27"
          />
          <Input
            label="Property Value"
            prefix="$"
            value={inputs.propertyValue}
            onChange={(v) => update('propertyValue', v)}
            placeholder="e.g. 600000"
          />
          <Input
            label="Cash Desired"
            prefix="$"
            value={inputs.cashDesired}
            onChange={(v) => update('cashDesired', v)}
            placeholder="e.g. 75000"
          />
          <Input
            label="How Long You'll Keep This Loan"
            suffix="yr"
            value={inputs.holdYears}
            onChange={(v) => update('holdYears', v)}
            placeholder="7"
          />
        </div>
        <p className="text-xs text-gray-500 mt-3">
          If you plan to refinance or sell within your chosen window, that&apos;s the period this
          comparison uses for total-cost math.
        </p>
      </div>

      {/* Rate inputs */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-6">
        <h2 className="font-semibold text-gray-900 mb-1">Today&apos;s Rates</h2>
        <p className="text-xs text-gray-500 mb-4">
          Enter the rates you&apos;d expect on each option.{' '}
          {inputs.secondType === 'heloc'
            ? 'HELOC rates typically run ~8–10% (variable, tied to Prime).'
            : 'HELOAN (fixed 2nd lien) rates typically run ~8–10%.'}{' '}
          Cash-out refi rates typically run ~6.5–7.5%.{' '}
          <Link href="/rates" className="text-brand hover:underline">
            Check NetRate&apos;s current pricing →
          </Link>
        </p>

        {/* 2nd lien type toggle */}
        <div className="mb-4">
          <div className="text-xs font-medium text-gray-600 mb-2">2nd Lien Type</div>
          <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden text-sm">
            <button
              type="button"
              onClick={() => setSecondType('heloan')}
              className={`px-4 py-2 transition-colors ${
                inputs.secondType === 'heloan'
                  ? 'bg-brand text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              HELOAN (fixed, amortizing)
            </button>
            <button
              type="button"
              onClick={() => setSecondType('heloc')}
              className={`px-4 py-2 border-l border-gray-300 transition-colors ${
                inputs.secondType === 'heloc'
                  ? 'bg-brand text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              HELOC (variable, I/O draw)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Input
            label={inputs.secondType === 'heloc' ? 'HELOC Rate' : 'HELOAN Rate'}
            suffix="%"
            value={inputs.heloanRate}
            onChange={(v) => update('heloanRate', v)}
            placeholder="e.g. 8.5"
            step="0.125"
          />
          <Input
            label={inputs.secondType === 'heloc' ? 'HELOC Draw Period' : 'HELOAN Term'}
            suffix="yr"
            value={inputs.heloanTerm}
            onChange={(v) => update('heloanTerm', v)}
            placeholder={inputs.secondType === 'heloc' ? '5' : '30'}
          />
          <Input
            label="Cash-Out Refi Rate"
            suffix="%"
            value={inputs.cashoutRate}
            onChange={(v) => update('cashoutRate', v)}
            placeholder="e.g. 6.75"
            step="0.125"
          />
          <Input
            label="Cash-Out Refi Term"
            suffix="yr"
            value={inputs.cashoutTerm}
            onChange={(v) => update('cashoutTerm', v)}
            placeholder="30"
          />
        </div>
      </div>

      {!result && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center text-gray-500 text-sm">
          Enter your scenario above to see the comparison.
        </div>
      )}

      {result && (
        <>
          {/* Side by side comparison */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            {/* Option A — New 2nd Lien */}
            <div
              className={`rounded-xl border-2 p-6 ${
                result.comparison.winner === 'heloan'
                  ? 'border-brand bg-brand/5'
                  : 'border-gray-200 bg-white'
              }`}
            >
              {result.comparison.winner === 'heloan' && (
                <span className="inline-block bg-brand text-white text-xs font-bold px-2 py-1 rounded mb-3">
                  BETTER OPTION
                </span>
              )}
              {result.optionA.cltvWarn && (
                <span className="inline-block bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded mb-3 ml-2">
                  CLTV {'>'} 85% — may exceed lender limits
                </span>
              )}
              <h3 className="font-semibold text-gray-900 mb-1">
                {result.secondType === 'heloc' ? 'Open a HELOC' : 'Open a new HELOAN'}
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                {result.secondType === 'heloc'
                  ? 'Keep your low first mortgage rate. Add a variable-rate line of credit with interest-only payments during the draw period.'
                  : 'Keep your low first mortgage rate. Add a fixed-rate 2nd for the cash you need.'}
              </p>

              {result.optionA.helocHoldExceedsDraw && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-800">
                  <strong>Heads up:</strong> your planned hold ({result.holdYears}yr) exceeds the
                  HELOC draw period ({result.heloanTerm}yr). After the draw ends, the HELOC
                  converts to a fully amortizing payment — monthly cost can jump significantly.
                  Plan to refinance or pay off before conversion.
                </div>
              )}

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">First mortgage (unchanged)</span>
                  <span className="font-medium">
                    {fmtDollars(result.firstBalance)} @ {fmtRate(result.firstRate)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">
                    {result.secondType === 'heloc' ? 'New HELOC' : 'New 2nd lien'}
                  </span>
                  <span className="font-medium">
                    {fmtDollars(result.cashDesired)} @ {fmtRate(Number(inputs.heloanRate) || 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">CLTV</span>
                  <span className="font-medium">{fmtPct(result.optionA.cltv)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Effective blended rate</span>
                  <span className="font-medium">{fmtRate(result.optionA.blendedRate)}</span>
                </div>

                <div className="border-t border-gray-100 pt-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">First mortgage P&amp;I</span>
                    <span className="font-medium">{fmtDollars(result.optionA.firstMonthlyPI)}/mo</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {result.secondType === 'heloc' ? 'HELOC interest-only' : '2nd lien P&I'}
                    </span>
                    <span className="font-medium">{fmtDollars(result.optionA.heloanMonthlyPI)}/mo</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-gray-900 mt-1">
                    <span>Total monthly</span>
                    <span>{fmtDollars(result.optionA.totalMonthly)}/mo</span>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      Cash paid over {result.holdYears} years
                    </span>
                    <span className="font-medium">
                      {fmtDollars(result.optionA.holdCashPaid)}
                    </span>
                  </div>
                  {result.secondType === 'heloc' && (
                    <p className="text-xs text-gray-500 mt-2">
                      Interest-only during draw — your HELOC balance ({fmtDollars(result.cashDesired)})
                      is still owed at the end of the period. Plan to refinance or pay off before
                      the draw ends.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Option B — Cash-Out Refi */}
            <div
              className={`rounded-xl border-2 p-6 ${
                result.comparison.winner === 'cashout'
                  ? 'border-brand bg-brand/5'
                  : 'border-gray-200 bg-white'
              }`}
            >
              {result.comparison.winner === 'cashout' && (
                <span className="inline-block bg-brand text-white text-xs font-bold px-2 py-1 rounded mb-3">
                  BETTER OPTION
                </span>
              )}
              {result.optionB.ltvWarn && (
                <span className="inline-block bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded mb-3 ml-2">
                  LTV {'>'} 80% — may not be available
                </span>
              )}
              <h3 className="font-semibold text-gray-900 mb-1">Cash-Out Refinance</h3>
              <p className="text-xs text-gray-500 mb-4">
                Replace your first mortgage with a new, larger loan. One payment — but your low
                first rate goes away.
              </p>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">New loan amount</span>
                  <span className="font-medium">{fmtDollars(result.optionB.loanAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">New rate</span>
                  <span className="font-medium">
                    {fmtRate(Number(inputs.cashoutRate) || 0)}{' '}
                    <span className="text-xs text-gray-400">
                      (was {fmtRate(result.firstRate)})
                    </span>
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">LTV</span>
                  <span className="font-medium">{fmtPct(result.optionB.ltv)}</span>
                </div>

                <div className="border-t border-gray-100 pt-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">New P&amp;I</span>
                    <span className="font-medium">{fmtDollars(result.optionB.monthlyPI)}/mo</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">2nd lien payment</span>
                    <span className="text-gray-400 font-medium">{fmtDollars(0)}/mo (none)</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-gray-900 mt-1">
                    <span>Total monthly</span>
                    <span>{fmtDollars(result.optionB.monthlyPI)}/mo</span>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      Cash paid over {result.holdYears} years
                    </span>
                    <span className="font-medium">
                      {fmtDollars(result.optionB.holdCashPaid)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Verdict */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">The Math</h3>
            <p className="text-gray-700 mb-4 text-sm">{result.comparison.reason}</p>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-xs text-gray-500">Monthly Difference</div>
                <div
                  className={`text-lg font-bold ${
                    result.comparison.monthlyDelta > 0
                      ? 'text-emerald-700'
                      : result.comparison.monthlyDelta < 0
                      ? 'text-red-700'
                      : 'text-gray-700'
                  }`}
                >
                  {result.comparison.monthlyDelta > 0
                    ? `${result.secondType === 'heloc' ? 'HELOC' : '2nd lien'} saves ${fmtDollars(result.comparison.monthlyDelta)}`
                    : result.comparison.monthlyDelta < 0
                    ? `Cash-out saves ${fmtDollars(Math.abs(result.comparison.monthlyDelta))}`
                    : 'About equal'}
                </div>
                <div className="text-xs text-gray-500">per month</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">
                  {result.holdYears}-Year Total Difference
                </div>
                <div
                  className={`text-lg font-bold ${
                    result.comparison.holdCostDelta > 0
                      ? 'text-emerald-700'
                      : result.comparison.holdCostDelta < 0
                      ? 'text-red-700'
                      : 'text-gray-700'
                  }`}
                >
                  {fmtDollars(Math.abs(result.comparison.holdCostDelta))}
                </div>
                <div className="text-xs text-gray-500">
                  {result.comparison.holdCostDelta > 0
                    ? `saved with ${result.secondType === 'heloc' ? 'HELOC' : '2nd lien'}`
                    : result.comparison.holdCostDelta < 0
                    ? 'saved with cash-out'
                    : 'about equal'}
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="bg-brand/5 border border-brand/20 rounded-xl p-6 mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">Want real rates for your situation?</h3>
            <p className="text-sm text-gray-700 mb-4">
              The numbers above are based on the rates you entered. NetRate Mortgage can show you
              actual pricing from our wholesale lender partners — no guessing.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/rates"
                className="inline-flex items-center bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-dark transition-colors"
              >
                See live rates →
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center bg-white text-brand border border-brand px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand/5 transition-colors"
              >
                Talk to us
              </Link>
            </div>
          </div>
        </>
      )}

      {/* Education section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h3 className="font-semibold text-gray-900 mb-3">The &quot;Don&apos;t Lose Your Rate&quot; Math</h3>
        <div className="space-y-4 text-sm text-gray-700">
          <p>
            Most homeowners who bought or refinanced between 2019 and 2022 have a first mortgage
            rate well below today&apos;s market. If you need cash from your equity, cash-out
            refinancing forces you to replace that rate on the <strong>entire</strong> balance at
            today&apos;s higher rate — not just on the new money.
          </p>
          <p>
            A second lien (HELOAN or HELOC) only puts today&apos;s rate on the new borrowing. Your
            first mortgage stays exactly as it is. The tradeoff: two payments instead of one, and
            2nd-lien rates are higher than first-lien rates because the lender sits in second
            position.
          </p>
          <div>
            <p className="font-medium text-gray-900 mb-1">When a 2nd lien usually wins</p>
            <ul className="list-disc pl-5 space-y-1 text-gray-600">
              <li>You have a first mortgage below ~5% and don&apos;t want to lose it</li>
              <li>You only need a modest cash amount relative to your first balance</li>
              <li>Your CLTV stays within 2nd-lien program limits (typically 80–85%)</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-gray-900 mb-1">When cash-out refi usually wins</p>
            <ul className="list-disc pl-5 space-y-1 text-gray-600">
              <li>Your current first rate is close to or above today&apos;s rates (no low rate to preserve)</li>
              <li>You want one payment instead of two</li>
              <li>You need a large cash amount and your LTV after cash-out stays under 80%</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-gray-900 mb-1">HELOAN vs HELOC</p>
            <p className="text-gray-600 mb-2">
              A <strong>HELOAN</strong> is a fixed-rate, fully amortizing 2nd mortgage — one lump
              sum with a fixed monthly payment, like a traditional mortgage in 2nd position.
              Principal pays down every month. The calculator models it like any other amortizing
              loan.
            </p>
            <p className="text-gray-600">
              A <strong>HELOC</strong> is a revolving line of credit tied to Prime rate. During
              the <strong>draw period</strong> (typically 5 years for newer programs, 10 years
              for traditional bank HELOCs), you pay interest only — no principal paydown. After
              the draw ends, the full balance converts to a fully amortizing payment over the
              remaining term, and payments can jump significantly. Because HELOC rates are
              variable, the payment can also move as Prime moves. For most borrowers, a HELOC
              makes sense only as a short-term tool — plan to refinance or pay off the balance
              before the draw period ends.
            </p>
          </div>
        </div>
      </div>

      <div className="text-xs text-gray-500 space-y-2">
        <p>
          This calculator is for illustration only. It does not use NetRate Mortgage&apos;s live
          pricing engine — it performs pure payment math on rates you enter. HELOC mode models
          interest-only payments during the draw period only; the post-draw amortizing payment
          can be materially higher and depends on the then-current variable rate. Actual rates
          and payments depend on credit, LTV/CLTV, property type, occupancy, state, and other
          factors. Contact us for a real quote.
        </p>
      </div>
    </div>
  );
}
