/**
 * refinance-calculator v1 — StandaloneView.
 *
 * Replaces src/components/RefinanceCalc/RefinanceCalc.js + the
 * useRefinanceEngine hook. Sub-component views (LoanInputs, PresetBar,
 * MiniRateStrip, ResultsPanel, shared inputs) stay in
 * src/components/RefinanceCalc/ for this PR — they're imported here.
 * v2 or a follow-up can colocate them in v1/ if desired.
 *
 * Owns input reducer state. Builds a {scenario, config} object from
 * state and passes it to useCompute. Renders LoanInputs (left col) +
 * PresetBar/MiniRateStrip/ResultsPanel (right col) using the result
 * shape returned by compute (strategies + apiRates + effectiveDate).
 */

'use client';

import { useReducer, useMemo } from 'react';
import Link from 'next/link';
import LoanInputs from '@/components/RefinanceCalc/LoanInputs';
import PresetBar from '@/components/RefinanceCalc/PresetBar';
import ResultsPanel from '@/components/RefinanceCalc/ResultsPanel';
import MiniRateStrip from '@/components/RefinanceCalc/MiniRateStrip';
import { useCompute } from '../../useCompute.js';
import { compute } from './compute.js';
import { schema } from './schema.js';

// Mini stub for useCompute. Importing the full module def from
// `./index.js` would create a circular dep — same pattern as
// cost-of-waiting/refi-analyzer/purchase-calculator.
const moduleStub = {
  id: 'refinance-calculator',
  version: 1,
  inputSchema: schema,
  compute,
  capabilities: { needsRates: true, needsToday: false, attachable: true },
};

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

export default function StandaloneView() {
  const [inputs, dispatch] = useReducer(reducer, INITIAL_STATE);

  // Build the schema-shape input from the reducer state. Numbers are
  // parsed; null/empty values match the schema's nullable defaults.
  const computeInput = useMemo(() => {
    const bal = parseFloat(inputs.currentBalance) || 0;
    const propVal = parseFloat(inputs.propertyValue) || 0;
    const curRate = parseFloat(inputs.currentRate) || 0;
    if (!bal || !propVal || !curRate) return null;
    return {
      scenario: {
        current_balance: bal,
        current_rate: curRate,
        current_payment: parseFloat(inputs.currentPayment) || 0,
        property_value: propVal,
        fico: parseInt(inputs.fico, 10) || 780,
        state: inputs.state,
        does_escrow: inputs.doesEscrow,
        escrow_balance: parseFloat(inputs.escrowBalance) || 0,
        annual_tax: inputs.annualTax ? parseFloat(inputs.annualTax) : null,
        annual_insurance: parseFloat(inputs.annualInsurance) || 0,
        insurance_renewal: inputs.insuranceRenewal || null,
      },
      config: {
        active_preset: inputs.activePreset,
        custom_selected_rate: inputs.customSelectedRate,
      },
    };
  }, [inputs]);

  // Default 600ms debounce — same as old useRefinanceEngine. Aborts
  // in-flight fetches on input change via useCompute's signal injection.
  const { result, loading, error } = useCompute(moduleStub, computeInput, { debounceMs: 600 });

  // The "active" strategy from the result, indexed by activePreset.
  const active = useMemo(() => {
    if (!result?.strategies) return null;
    const map = {
      noCost: result.strategies.noCost,
      zeroOop: result.strategies.zeroOop,
      lowestRate: result.strategies.lowest,
      custom: result.strategies.custom,
    };
    return map[inputs.activePreset] || null;
  }, [result, inputs.activePreset]);

  // Derived display values for LoanInputs's right-rail summary.
  // Lifted from the old useRefinanceEngine pure-derivation path so
  // the panel renders even before compute has returned.
  const derived = useMemo(() => {
    const bal = parseFloat(inputs.currentBalance) || 0;
    const curRate = parseFloat(inputs.currentRate) || 0;
    const propVal = parseFloat(inputs.propertyValue) || 0;
    const dailyInterest = (bal * (curRate / 100)) / 365;
    const accruedInterest = Math.round(dailyInterest * 30);
    const estimatedPayoff = bal + accruedInterest;
    const today = new Date();
    const closeDate = new Date(today.getTime() + 30 * 86400000);
    const closeDateStr = closeDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    // STATE_DEFAULTS resolved via shared.js — re-import lazily.
    // Effective tax used by LoanInputs as a placeholder, not the
    // final compute. Kept simple here; compute() owns the real value.
    const taxRate = ({ CO: 0.0055, CA: 0.0075, TX: 0.018, OR: 0.0098 }[inputs.state]) || 0.006;
    const effectiveTax = inputs.annualTax
      ? parseFloat(inputs.annualTax)
      : Math.round(propVal * taxRate);
    const stateInfo = (
      ({ CO: { label: 'Colorado', taxRate: 0.0055, hardCosts: 2800, taxSchedule: 'semi-annual', taxDue: ['Mar 1', 'Jun 15'] },
         CA: { label: 'California', taxRate: 0.0075, hardCosts: 3500, taxSchedule: 'semi-annual', taxDue: ['Nov 1', 'Feb 1'] },
         TX: { label: 'Texas', taxRate: 0.018, hardCosts: 3200, taxSchedule: 'annual', taxDue: ['Jan 31'] },
         OR: { label: 'Oregon', taxRate: 0.0098, hardCosts: 2600, taxSchedule: 'semi-annual', taxDue: ['Nov 15', 'May 15'] } })[inputs.state]
    ) || { label: 'Colorado', taxRate: 0.0055, hardCosts: 2800, taxSchedule: 'semi-annual', taxDue: ['Mar 1', 'Jun 15'] };
    const thirdPartyCosts = stateInfo.hardCosts;
    return { estimatedPayoff, accruedInterest, thirdPartyCosts, closeDateStr, effectiveTax, stateInfo };
  }, [inputs.currentBalance, inputs.currentRate, inputs.propertyValue, inputs.state, inputs.annualTax]);

  return (
    <div>
      <div className="mb-6">
        <Link href="/refinance-playbook" className="text-sm text-brand hover:underline">&larr; Back to Refinance Playbook</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-3">Refinance Calculator</h1>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
          Powered by today&apos;s wholesale rates. Enter your loan details, pick a strategy, and see how the cash flow actually works.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <LoanInputs inputs={inputs} dispatch={dispatch} derived={derived} />
        </div>

        <div className="lg:col-span-2 space-y-4">
          <PresetBar
            activePreset={inputs.activePreset}
            onPresetChange={(preset) => dispatch({ type: 'SET_PRESET', preset })}
          />

          {inputs.activePreset === 'custom' && (
            <MiniRateStrip
              rates={result?.apiRates}
              selectedRate={inputs.customSelectedRate ?? result?.strategies?.custom?.rate}
              onSelect={(rate) => dispatch({ type: 'SET_CUSTOM_RATE', rate })}
            />
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Couldn&apos;t pull rates: {error.message}
            </div>
          )}

          <ResultsPanel
            active={active}
            loading={loading}
            escrow={result?.escrow ?? { breakdown: [], total: 0 }}
            effectiveDate={result?.effectiveDate}
          />

          {active && (
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
