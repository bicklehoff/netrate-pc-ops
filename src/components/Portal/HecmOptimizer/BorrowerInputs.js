'use client';

import { useState } from 'react';
import { useScenario } from './ScenarioContext';

function Input({ label, value, onChange, type = 'text', className = '', inputClass = '', required = false, tooltip, ...rest }) {
  const [showTooltip, setShowTooltip] = useState(false);
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-500 mb-0.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
        {tooltip && (
          <span className="relative inline-block ml-1">
            <button
              type="button"
              onClick={() => setShowTooltip(!showTooltip)}
              className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-gray-200 text-gray-500 text-[9px] font-bold hover:bg-brand hover:text-white transition-colors"
            >
              ?
            </button>
            {showTooltip && (
              <span className="absolute z-20 left-1/2 -translate-x-1/2 top-5 w-56 p-2 text-xs text-gray-700 bg-white border border-gray-200 rounded-lg shadow-lg">
                {tooltip}
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white border-l border-t border-gray-200 rotate-45" />
              </span>
            )}
          </span>
        )}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        className={`w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none ${inputClass} ${required && !value ? 'border-amber-300' : ''}`}
        {...rest}
      />
    </div>
  );
}

function CalcField({ label, value, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-500 mb-0.5">{label}</label>
      <div className="px-2 py-1.5 text-sm bg-emerald-50 border border-emerald-200 rounded text-emerald-800 font-medium">
        {value}
      </div>
    </div>
  );
}

export default function BorrowerInputs() {
  const { state, setField, age } = useScenario();
  const [showCoBorrower, setShowCoBorrower] = useState(!!(state.co_borrower_name || state.coBorrowerDOB));

  const handleChange = (field) => (e) => {
    const val = e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
    setField(field, val);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Borrower & Property</h3>

      {/* Row 1: Primary Borrower */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-3">
        <Input
          label="Borrower Name"
          value={state.borrower_name}
          onChange={handleChange('borrower_name')}
          className="lg:col-span-2"
          inputClass="bg-yellow-50"
        />
        <Input
          label="Date of Birth"
          type="date"
          value={state.borrowerDOB}
          onChange={handleChange('borrowerDOB')}
          inputClass="bg-yellow-50"
          required
          tooltip="Your age determines how much equity you can access. Reverse mortgage payouts use age-based Principal Limit Factors — the older you are, the more you can borrow."
        />
        <CalcField label="Age" value={age || '—'} />
        {!showCoBorrower && (
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setShowCoBorrower(true)}
              className="text-xs font-medium text-brand hover:text-brand-dark transition-colors px-3 py-1.5 border border-brand/30 rounded hover:bg-brand/5"
            >
              + Add Co-Borrower
            </button>
          </div>
        )}
      </div>

      {/* Co-Borrower (hidden by default) */}
      {showCoBorrower && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-3 pt-2 border-t border-gray-100">
          <Input
            label="Co-Borrower Name"
            value={state.co_borrower_name}
            onChange={handleChange('co_borrower_name')}
            className="lg:col-span-2"
            inputClass="bg-yellow-50"
          />
          <Input
            label="Co-Borrower DOB"
            type="date"
            value={state.coBorrowerDOB}
            onChange={handleChange('coBorrowerDOB')}
            inputClass="bg-yellow-50"
            required
            tooltip="The youngest borrower's age determines the payout. If one spouse is younger, the available equity will be lower — but both borrowers are protected and can stay in the home."
          />
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setShowCoBorrower(false);
                setField('co_borrower_name', '');
                setField('coBorrowerDOB', '');
              }}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1.5"
            >
              Remove co-borrower
            </button>
          </div>
        </div>
      )}

      {/* Row 2: Property */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <Input
          label="Address"
          value={state.address}
          onChange={handleChange('address')}
          className="lg:col-span-2"
          inputClass="bg-yellow-50"
        />
        <Input
          label="City"
          value={state.city}
          onChange={handleChange('city')}
          inputClass="bg-yellow-50"
        />
        <Input
          label="State"
          value={state.state}
          onChange={handleChange('state')}
          inputClass="bg-yellow-50"
          maxLength={2}
        />
        <Input
          label="ZIP"
          value={state.zip}
          onChange={handleChange('zip')}
          inputClass="bg-yellow-50"
          maxLength={5}
        />
        <Input
          label="Home Value"
          type="number"
          value={state.home_value || ''}
          onChange={handleChange('home_value')}
          inputClass="bg-yellow-50 font-medium"
          min={0}
          step={1000}
        />
      </div>
    </div>
  );
}
