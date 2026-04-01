'use client';

import { useMemo, useState, useCallback } from 'react';
import { getCountiesByState, classifyLoan, getLoanLimits } from '@/data/county-loan-limits';

const STATES = ['CA', 'CO', 'OR', 'TX'];
const LOAN_TYPES = [
  { value: 'conventional', label: 'Conventional' },
  { value: 'fha', label: 'FHA' },
  { value: 'va', label: 'VA' },
  { value: 'dscr', label: 'DSCR' },
  { value: 'bankstatement', label: 'Bank Statement' },
];
const PURPOSES = [
  { value: 'purchase', label: 'Purchase' },
  { value: 'refinance', label: 'Rate/Term Refi' },
  { value: 'cashout', label: 'Cash-Out Refi' },
];
const TERMS = [30, 25, 20, 15];
const LOCK_DAYS = [15, 30, 45, 60];

export default function QuoteScenarioForm({ scenario, onChange, onSubmit, loading }) {
  const update = (field, value) => onChange({ ...scenario, [field]: value });
  const [lastEdited, setLastEdited] = useState('pct');

  const isPurchase = scenario.purpose === 'purchase';

  // Purchase: interlinked property value / down payment / loan amount
  const purchaseCalc = useMemo(() => {
    const pv = Number(scenario.propertyValue) || 0;
    if (!pv) return { loanAmount: 0, downPct: 0, downDollars: 0, ltv: 0 };

    let loanAmount, downPct, downDollars;
    if (lastEdited === 'pct') {
      downPct = Number(scenario.downPaymentPct) || 0;
      loanAmount = Math.floor(pv * (1 - downPct / 100));
      downDollars = pv - loanAmount;
    } else if (lastEdited === 'loan') {
      loanAmount = Math.floor(Number(scenario.loanAmount) || 0);
      downDollars = pv - loanAmount;
      downPct = pv > 0 ? Math.round((downDollars / pv) * 10000) / 100 : 0;
    }

    const ltv = pv > 0 ? Math.floor((loanAmount / pv) * 10000) / 100 : 0;
    return { loanAmount, downPct, downDollars, ltv };
  }, [scenario.propertyValue, scenario.downPaymentPct, scenario.loanAmount, lastEdited]);

  // Refi: loan amount direct
  const refiCalc = useMemo(() => {
    const pv = Number(scenario.propertyValue) || 0;
    const loan = Math.floor(Number(scenario.loanAmount) || 0);
    const ltv = pv > 0 ? Math.floor((loan / pv) * 10000) / 100 : 0;
    return { loanAmount: loan, ltv };
  }, [scenario.propertyValue, scenario.loanAmount]);

  const effectiveLoan = isPurchase ? purchaseCalc.loanAmount : refiCalc.loanAmount;
  const effectiveLtv = isPurchase ? purchaseCalc.ltv : refiCalc.ltv;

  const counties = useMemo(() => getCountiesByState(scenario.state || 'CO').map(c => c.name), [scenario.state]);

  const loanLimitInfo = useMemo(() => {
    if (!scenario.county || !effectiveLoan) return null;
    const limits = getLoanLimits(scenario.state, scenario.county);
    if (!limits) return null;
    return { ...limits, classification: classifyLoan(effectiveLoan, scenario.state, scenario.county) };
  }, [scenario.state, scenario.county, effectiveLoan]);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    onSubmit({
      ...scenario,
      loanAmount: effectiveLoan,
      ltv: effectiveLtv,
    });
  }, [scenario, effectiveLoan, effectiveLtv, onSubmit]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Borrower Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Borrower</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Name" value={scenario.borrowerName} onChange={v => update('borrowerName', v)} placeholder="John Smith" />
          <Field label="Email" value={scenario.borrowerEmail} onChange={v => update('borrowerEmail', v)} placeholder="john@example.com" type="email" />
          <Field label="Phone" value={scenario.borrowerPhone} onChange={v => update('borrowerPhone', v)} placeholder="303-555-1234" type="tel" />
        </div>
      </div>

      {/* Loan Scenario */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Loan Scenario</h3>

        {/* Purpose + Type */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <SelectField label="Purpose" value={scenario.purpose} options={PURPOSES} onChange={v => update('purpose', v)} />
          <SelectField label="Loan Type" value={scenario.loanType} options={LOAN_TYPES} onChange={v => update('loanType', v)} />
          <SelectField label="Term" value={scenario.term} options={TERMS.map(t => ({ value: t, label: `${t} Year` }))} onChange={v => update('term', Number(v))} />
        </div>

        {/* Property + Down Payment / Loan Amount */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <DollarField
            label="Property Value"
            value={scenario.propertyValue}
            onChange={v => update('propertyValue', v)}
          />
          {isPurchase ? (
            <>
              <Field
                label="Down Payment %"
                value={scenario.downPaymentPct}
                onChange={v => { setLastEdited('pct'); update('downPaymentPct', v); }}
                type="number"
                suffix="%"
              />
              <DollarField
                label="Down Payment $"
                value={purchaseCalc.downDollars}
                disabled
              />
              <DollarField
                label="Loan Amount"
                value={purchaseCalc.loanAmount}
                onChange={v => { setLastEdited('loan'); update('loanAmount', v); }}
              />
            </>
          ) : (
            <>
              <DollarField
                label="Loan Amount"
                value={scenario.loanAmount}
                onChange={v => update('loanAmount', v)}
              />
              <Field label="LTV" value={`${refiCalc.ltv}%`} disabled />
            </>
          )}
        </div>

        {/* FICO + State + County + Lock */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <Field label="Credit Score" value={scenario.fico} onChange={v => update('fico', Number(v))} type="number" />
          <SelectField label="State" value={scenario.state} options={STATES.map(s => ({ value: s, label: s }))} onChange={v => { update('state', v); update('county', ''); }} />
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">County</label>
            <select
              value={scenario.county}
              onChange={e => update('county', e.target.value)}
              className="w-full rounded-lg border-gray-300 text-sm focus:ring-cyan-500 focus:border-cyan-500"
            >
              <option value="">Select county...</option>
              {counties.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <SelectField label="Lock Days" value={scenario.lockDays} options={LOCK_DAYS.map(d => ({ value: d, label: `${d} Days` }))} onChange={v => update('lockDays', Number(v))} />
        </div>

        {/* Loan limit badge */}
        {loanLimitInfo && (
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
            loanLimitInfo.classification === 'conforming' ? 'bg-green-50 text-green-700' :
            loanLimitInfo.classification === 'highBalance' ? 'bg-amber-50 text-amber-700' :
            'bg-red-50 text-red-700'
          }`}>
            {loanLimitInfo.classification === 'conforming' ? 'Conforming' :
             loanLimitInfo.classification === 'highBalance' ? 'High Balance' : 'Jumbo'}
            {' '}| Limit: ${loanLimitInfo.conforming1Unit?.toLocaleString()}
          </div>
        )}
      </div>

      {/* Refi-specific */}
      {!isPurchase && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Current Loan</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Field label="Current Rate" value={scenario.currentRate} onChange={v => update('currentRate', v)} type="number" step="0.125" suffix="%" />
            <DollarField label="Current Balance" value={scenario.currentBalance} onChange={v => update('currentBalance', v)} />
            <DollarField label="Current Payment" value={scenario.currentPayment} onChange={v => update('currentPayment', v)} />
            <Field label="Current Lender" value={scenario.currentLender} onChange={v => update('currentLender', v)} />
          </div>
        </div>
      )}

      {/* LTV display + Submit */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          <span className="font-medium">LTV:</span> {effectiveLtv}% |{' '}
          <span className="font-medium">Loan:</span> ${effectiveLoan?.toLocaleString()} |{' '}
          <span className="font-medium">FICO:</span> {scenario.fico}
        </div>
        <button
          type="submit"
          disabled={loading || !effectiveLoan}
          className="px-6 py-2.5 bg-cyan-600 text-white rounded-lg font-medium hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Pricing...' : 'Get Rates'}
        </button>
      </div>
    </form>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder, disabled, suffix, step }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value ?? ''}
          onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          step={step}
          className="w-full rounded-lg border-gray-300 text-sm focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-gray-50 disabled:text-gray-400"
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{suffix}</span>}
      </div>
    </div>
  );
}

function DollarField({ label, value, onChange, disabled }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
        <input
          type="number"
          value={value ?? ''}
          onChange={e => onChange?.(e.target.value)}
          disabled={disabled}
          className="w-full pl-7 rounded-lg border-gray-300 text-sm focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-gray-50 disabled:text-gray-400"
        />
      </div>
    </div>
  );
}

function SelectField({ label, value, options, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg border-gray-300 text-sm focus:ring-cyan-500 focus:border-cyan-500"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}
