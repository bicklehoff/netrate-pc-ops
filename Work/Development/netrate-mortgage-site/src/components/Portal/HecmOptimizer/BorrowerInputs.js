'use client';

import { useScenario } from './ScenarioContext';

function Input({ label, value, onChange, type = 'text', className = '', inputClass = '', ...rest }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-500 mb-0.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        className={`w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none ${inputClass}`}
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

  const handleChange = (field) => (e) => {
    const val = e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
    setField(field, val);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Borrower & Property</h3>

      {/* Row 1: Names and DOBs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-3">
        <Input
          label="Borrower Name"
          value={state.borrowerName}
          onChange={handleChange('borrowerName')}
          className="lg:col-span-2"
          inputClass="bg-yellow-50"
        />
        <Input
          label="DOB"
          type="date"
          value={state.borrowerDOB}
          onChange={handleChange('borrowerDOB')}
          inputClass="bg-yellow-50"
        />
        <CalcField label="Age" value={age || '—'} />
        <Input
          label="Co-Borrower Name"
          value={state.coBorrowerName}
          onChange={handleChange('coBorrowerName')}
          inputClass="bg-yellow-50"
        />
        <Input
          label="Co-Borrower DOB"
          type="date"
          value={state.coBorrowerDOB}
          onChange={handleChange('coBorrowerDOB')}
          inputClass="bg-yellow-50"
        />
      </div>

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
          value={state.homeValue || ''}
          onChange={handleChange('homeValue')}
          inputClass="bg-yellow-50 font-medium"
          min={0}
          step={1000}
        />
      </div>
    </div>
  );
}
