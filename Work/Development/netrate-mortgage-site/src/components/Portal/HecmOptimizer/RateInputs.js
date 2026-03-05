'use client';

import { useState } from 'react';
import { useScenario } from './ScenarioContext';

function NumInput({ label, value, onChange, step = 0.001, min, className = '', inputClass = '', suffix = '', ...rest }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-500 mb-0.5">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value || ''}
          onChange={onChange}
          step={step}
          min={min}
          className={`w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none ${inputClass}`}
          {...rest}
        />
        {suffix && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">{suffix}</span>
        )}
      </div>
    </div>
  );
}

function DollarInput({ label, value, onChange, className = '', inputClass = '', ...rest }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-500 mb-0.5">{label}</label>
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
        <input
          type="number"
          value={value || ''}
          onChange={onChange}
          min={0}
          step={100}
          className={`w-full pl-5 pr-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none ${inputClass}`}
          {...rest}
        />
      </div>
    </div>
  );
}

export default function RateInputs() {
  const { state, setField } = useScenario();
  const [refreshing, setRefreshing] = useState(false);

  const handleNum = (field) => (e) => setField(field, parseFloat(e.target.value) || 0);
  const handleDollar = (field) => (e) => setField(field, parseFloat(e.target.value) || 0);

  const refreshRates = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/portal/mlo/treasury-rates');
      if (res.ok) {
        const data = await res.json();
        if (data.oneYear) setField('oneYearCMT', data.oneYear);
        if (data.tenYear) setField('tenYearCMT', data.tenYear);
      }
    } catch {
      // silently fail — user can enter manually
    }
    setRefreshing(false);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Rates & Costs</h3>
        <button
          onClick={refreshRates}
          disabled={refreshing}
          className="text-xs text-cyan-600 hover:text-cyan-700 font-medium disabled:opacity-50"
        >
          {refreshing ? 'Refreshing...' : 'Refresh CMT Rates'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <NumInput
          label="1yr CMT"
          value={state.oneYearCMT}
          onChange={handleNum('oneYearCMT')}
          suffix="%"
          inputClass="bg-yellow-50"
        />
        <NumInput
          label="10yr CMT"
          value={state.tenYearCMT}
          onChange={handleNum('tenYearCMT')}
          suffix="%"
          inputClass="bg-yellow-50"
        />
        <NumInput
          label="MIP Rate"
          value={state.mipRate}
          onChange={handleNum('mipRate')}
          suffix="%"
          step={0.01}
        />
        <DollarInput
          label="FHA Limit"
          value={state.fhaLimit}
          onChange={handleDollar('fhaLimit')}
          step={1000}
        />
        <DollarInput
          label="Existing Liens"
          value={state.existingLiens}
          onChange={handleDollar('existingLiens')}
          inputClass="bg-yellow-50"
        />
        <DollarInput
          label="Orig Fee"
          value={state.origFee}
          onChange={(e) => {
            setField('origFeeOverride', true);
            setField('origFee', parseFloat(e.target.value) || 0);
          }}
          inputClass={state.origFeeOverride ? 'bg-yellow-50' : 'bg-emerald-50'}
        />
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-0.5">3rd Party Costs</label>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
            <input
              type="number"
              value={state.thirdPartyCosts || ''}
              readOnly
              tabIndex={-1}
              className="w-full pl-5 pr-2 py-1.5 text-sm border border-gray-300 rounded bg-emerald-50 cursor-default outline-none"
              title="Auto-calculated from Fee Calculation section"
            />
          </div>
        </div>
        <DollarInput
          label="Lender Credit"
          value={state.lenderCredit}
          onChange={handleDollar('lenderCredit')}
        />
      </div>

      {state.origFeeOverride && (
        <button
          onClick={() => setField('origFeeOverride', false)}
          className="text-xs text-gray-400 hover:text-gray-600 mt-1"
        >
          Reset orig fee to auto-calc
        </button>
      )}
    </div>
  );
}
