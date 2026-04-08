'use client';

import { NumInput, SelectInput, Toggle, DateInput, STATE_DEFAULTS, dollar } from './shared';

export default function LoanInputs({ inputs, dispatch, derived }) {
  const { estimatedPayoff, accruedInterest, thirdPartyCosts, closeDateStr, effectiveTax, stateInfo } = derived;
  const set = (field) => (value) => dispatch({ type: 'SET', field, value });

  return (
    <div className="space-y-5">
      {/* Current Loan */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h2 className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-4">Your Current Loan</h2>
        <div className="space-y-3">
          <NumInput label="Principal Balance" prefix="$" value={inputs.currentBalance} onChange={set('currentBalance')} step="5000" help="From your latest statement" />
          <NumInput label="Current Rate" suffix="%" value={inputs.currentRate} onChange={set('currentRate')} step="0.125" />
          <NumInput label="Current Payment" prefix="$" value={inputs.currentPayment} onChange={set('currentPayment')} step="10" help="P&I only (exclude escrow)" />
          <NumInput label="Property Value" prefix="$" value={inputs.propertyValue} onChange={set('propertyValue')} step="5000" />

          {/* FICO slider */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Credit Score</span>
              <span className="text-sm font-bold text-gray-900">{inputs.fico}</span>
            </div>
            <input
              type="range"
              min="580"
              max="850"
              step="5"
              value={inputs.fico}
              onChange={e => dispatch({ type: 'SET', field: 'fico', value: e.target.value })}
              className="mt-1 w-full h-2 rounded-lg appearance-none cursor-pointer accent-brand"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>580</span>
              <span>850</span>
            </div>
          </div>

          <SelectInput label="State" value={inputs.state} onChange={set('state')}
            options={Object.entries(STATE_DEFAULTS).map(([k, v]) => ({ value: k, label: v.label }))} />
        </div>

        {/* Computed payoff */}
        {estimatedPayoff > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-100 text-sm text-gray-500 space-y-1">
            <div className="flex justify-between">
              <span>Estimated payoff</span>
              <span className="font-semibold text-gray-900">{dollar(estimatedPayoff)}</span>
            </div>
            <div className="text-xs text-gray-400">
              Balance + {dollar(accruedInterest)} accrued interest (30 days)
            </div>
            <div className="flex justify-between text-xs">
              <span>Est. close: {closeDateStr}</span>
              <span>Hard costs: {dollar(thirdPartyCosts)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Escrow & Insurance */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h2 className="text-xs font-semibold text-gray-900 uppercase tracking-wide mb-4">Escrow &amp; Insurance</h2>
        <div className="space-y-3">
          <Toggle label="Escrow for taxes/insurance?" checked={inputs.doesEscrow} onChange={set('doesEscrow')} help="Most loans require escrow" />
          {inputs.doesEscrow && (
            <NumInput label="Current Escrow Balance" prefix="$" value={inputs.escrowBalance} onChange={set('escrowBalance')} step="100" help="Refunded when your old loan closes" />
          )}
          <NumInput label="Annual Property Tax" prefix="$" value={inputs.annualTax || String(effectiveTax)} onChange={set('annualTax')} step="100"
            help={stateInfo.label + ' avg (' + (stateInfo.taxRate * 100).toFixed(2) + '% of value)'} />
          <NumInput label="Annual Insurance" prefix="$" value={inputs.annualInsurance} onChange={set('annualInsurance')} step="100" help="Homeowner's insurance premium" />
          <DateInput label="Insurance Renewal" value={inputs.insuranceRenewal || new Date(new Date().getFullYear(), new Date().getMonth() + 6, 1).toISOString().slice(0, 10)} onChange={set('insuranceRenewal')}
            help="Due within 60 days of close? Paid at closing." />
        </div>
        {inputs.doesEscrow && (
          <p className="mt-3 text-xs text-gray-400">
            Tax due dates: {stateInfo.taxDue.join(', ')} ({stateInfo.taxSchedule})
          </p>
        )}
      </div>
    </div>
  );
}
