'use client';

import { useReducer } from 'react';
import Link from 'next/link';
import { useRefinanceEngine } from './useRefinanceEngine';
import LoanInputs from './LoanInputs';
import PresetBar from './PresetBar';
import ResultsPanel from './ResultsPanel';
import MiniRateStrip from './MiniRateStrip';

const INITIAL_STATE = {
  currentBalance: '400000',
  currentRate: '7.500',
  currentPayment: '2661',
  propertyValue: '550000',
  fico: '780',
  state: 'CO',
  doesEscrow: true,
  escrowBalance: '4200',
  annualTax: '',
  annualInsurance: '2400',
  insuranceRenewal: '',
  activePreset: 'noCost',
  customSelectedRate: null,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET':
      return { ...state, [action.field]: action.value };
    case 'SET_PRESET':
      return { ...state, activePreset: action.preset };
    case 'SET_CUSTOM_RATE':
      return { ...state, customSelectedRate: action.rate, activePreset: 'custom' };
    default:
      return state;
  }
}

export default function RefinanceCalc() {
  const [inputs, dispatch] = useReducer(reducer, INITIAL_STATE);

  const engine = useRefinanceEngine(inputs);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link href="/refinance-playbook" className="text-sm text-brand hover:underline">&larr; Back to Refinance Playbook</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-3">Refinance Calculator</h1>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
          Powered by today&apos;s wholesale rates. Enter your loan details, pick a strategy, and see how the cash flow actually works.
        </p>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: inputs */}
        <div className="lg:col-span-1">
          <LoanInputs
            inputs={inputs}
            dispatch={dispatch}
            derived={{
              estimatedPayoff: engine.estimatedPayoff,
              accruedInterest: engine.accruedInterest,
              thirdPartyCosts: engine.thirdPartyCosts,
              closeDateStr: engine.closeDateStr,
              effectiveTax: engine.effectiveTax,
              stateInfo: engine.stateInfo,
            }}
          />
        </div>

        {/* Right column: presets + results */}
        <div className="lg:col-span-2 space-y-4">
          <PresetBar
            activePreset={inputs.activePreset}
            onPresetChange={(preset) => dispatch({ type: 'SET_PRESET', preset })}
          />

          {inputs.activePreset === 'custom' && (
            <MiniRateStrip
              rates={engine.apiRates}
              selectedRate={inputs.customSelectedRate ?? engine.strategies?.custom?.rate}
              onSelect={(rate) => dispatch({ type: 'SET_CUSTOM_RATE', rate })}
            />
          )}

          <ResultsPanel
            active={engine.active}
            loading={engine.loading}
            escrow={engine.escrow}
            effectiveDate={engine.effectiveDate}
          />

          {/* Explanation footer */}
          {engine.active && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-sm text-gray-600 space-y-2">
              <p>
                <strong>How to read this:</strong> Each preset picks a different rate from today&apos;s wholesale rate sheet based on your scenario.
                The rate determines how much lender credit (or points cost) applies to your closing costs.
              </p>
              <p>
                &ldquo;Net out-of-pocket&rdquo; accounts for the skipped payment and escrow refund you receive within ~30 days of closing.
                This is the real number — not the Loan Estimate &ldquo;cash to close&rdquo; that scares most borrowers away.{' '}
                <Link href="/refinance-playbook" className="text-brand hover:underline">Read the full playbook</Link>
              </p>
            </div>
          )}

          {/* CTAs */}
          <div className="flex gap-3">
            <Link href="/rates" className="inline-flex items-center px-5 py-2.5 bg-brand text-white text-sm font-medium rounded-2xl hover:bg-brand-dark transition-colors">
              See today&apos;s rates
            </Link>
            <Link href="/contact" className="inline-flex items-center px-5 py-2.5 border-2 border-brand text-brand text-sm font-medium rounded-2xl hover:bg-brand/5 transition-colors">
              Talk to a loan officer
            </Link>
          </div>

          <p className="text-xs text-gray-400 pt-4 border-t border-gray-100">
            This calculator provides estimates for educational purposes only. Actual closing costs, lender credits, rates,
            escrow requirements, and insurance timing vary by lender, loan program, and market conditions.
            Licensed in CA, CO, OR, and TX. NMLS #1111861.
          </p>
        </div>
      </div>
    </div>
  );
}
