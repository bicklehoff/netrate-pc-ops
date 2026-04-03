'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
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

// Format number with commas (e.g., 400000 → "400,000")
function fmt(n) {
  if (n == null || n === '') return '';
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

// Parse formatted number back (e.g., "400,000" → 400000)
function unfmt(s) {
  if (!s) return '';
  return s.replace(/,/g, '');
}

// Add N business days (skip weekends)
function addBusinessDays(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d.toISOString().split('T')[0];
}

/**
 * Default closing date: 4 business days before the last business day of the current month.
 */
function getDefaultClosingDate() {
  const now = new Date();
  // Try current month first, then next month if date has already passed
  for (let offset = 0; offset <= 1; offset++) {
    const target = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0); // last calendar day
    // Walk backward to find the last business day
    while (target.getDay() === 0 || target.getDay() === 6) target.setDate(target.getDate() - 1);
    // Walk back 4 more business days
    let count = 0;
    const d = new Date(target);
    while (count < 4) {
      d.setDate(d.getDate() - 1);
      if (d.getDay() !== 0 && d.getDay() !== 6) count++;
    }
    // If this date is in the future (or today), use it
    if (d >= new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      return d.toISOString().split('T')[0];
    }
  }
  // Fallback: next month
  const next = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() - 1);
  let c = 0;
  while (c < 4) { next.setDate(next.getDate() - 1); if (next.getDay() !== 0 && next.getDay() !== 6) c++; }
  return next.toISOString().split('T')[0];
}

/**
 * From a closing date, derive funding date and first payment date.
 * CO + TX purchase: same day. CA + OR purchase: +3 biz days. All refis: +3 biz days.
 * firstPaymentDate: 1st of 2nd month after closing (estimate; fee editor refines from funding day).
 */
function deriveFromClosing(closing, state, purpose) {
  if (!closing) return {};
  const isRefi = purpose === 'refinance' || purpose === 'cashout';
  const needsDelay = isRefi || state === 'CA' || state === 'OR';
  const fundingDate = needsDelay ? addBusinessDays(closing, 3) : closing;
  const [y, m] = closing.split('-').map(Number);
  const fp = new Date(y, m + 1, 1);
  const firstPaymentDate = `${fp.getFullYear()}-${String(fp.getMonth() + 1).padStart(2, '0')}-01`;
  return { fundingDate, firstPaymentDate };
}

export default function QuoteScenarioForm({ scenario, onChange, onSubmit, loading }) {
  const update = (field, value) => onChange({ ...scenario, [field]: value });
  const [lastEdited, setLastEdited] = useState('pct');
  // Persist zip from scenario so it survives back-navigation
  const [zipCode, setZipCode] = useState(scenario.zipCode || '');
  const [zipLoading, setZipLoading] = useState(false);

  // Auto-set default closing date if not yet set
  useEffect(() => {
    if (!scenario.closingDate) {
      const closing = getDefaultClosingDate();
      onChange({ ...scenario, closingDate: closing, ...deriveFromClosing(closing, scenario.state, scenario.purpose) });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isPurchase = scenario.purpose === 'purchase';

  // Zip → state + county lookup (zippopotam for lat/lon + state, then FCC for county)
  const handleZipLookup = useCallback(async (zip) => {
    setZipCode(zip);
    if (zip.length !== 5) return;
    setZipLoading(true);
    try {
      const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
      if (!res.ok) return;
      const data = await res.json();
      const place = data.places?.[0];
      if (!place) return;

      const st = place['state abbreviation'];
      if (!st || !STATES.includes(st)) return;

      // Use FCC Census Block API with lat/lon to get county name
      const lat = place.latitude;
      const lon = place.longitude;
      let countyName = '';
      try {
        const fccRes = await fetch(`https://geo.fcc.gov/api/census/area?lat=${lat}&lon=${lon}&format=json`);
        if (fccRes.ok) {
          const fccData = await fccRes.json();
          const fccCounty = fccData?.results?.[0]?.county_name;
          if (fccCounty) {
            // Match against our county data (FCC returns "Boulder" not "Boulder County")
            const countyList = getCountiesByState(st).map(c => c.name);
            const fccClean = fccCounty.toLowerCase().replace(' county', '').replace(' parish', '');
            countyName = countyList.find(c =>
              c.toLowerCase() === fccCounty.toLowerCase() ||
              c.toLowerCase() === fccClean
            ) || '';
          }
        }
      } catch { /* FCC lookup failed, just set state */ }

      onChange({
        ...scenario,
        state: st,
        county: countyName,
        zipCode: zip,
      });
    } catch { /* ignore lookup failures */ } finally {
      setZipLoading(false);
    }
  }, [scenario, onChange]);

  // Purchase: interlinked property value / down payment / loan amount
  const purchaseCalc = useMemo(() => {
    const pv = Number(scenario.propertyValue) || 0;
    if (!pv) return { loanAmount: 0, downPct: 0, downDollars: 0, ltv: 0 };

    let loanAmount, downPct, downDollars;
    if (lastEdited === 'pct') {
      downPct = Number(scenario.downPaymentPct) || 0;
      loanAmount = Math.floor(pv * (1 - downPct / 100));
      downDollars = pv - loanAmount;
    } else if (lastEdited === 'dollars') {
      downDollars = Math.floor(Number(scenario.downPaymentDollars) || 0);
      loanAmount = pv - downDollars;
      downPct = pv > 0 ? Math.round((downDollars / pv) * 10000) / 100 : 0;
    } else if (lastEdited === 'loan') {
      loanAmount = Math.floor(Number(scenario.loanAmount) || 0);
      downDollars = pv - loanAmount;
      downPct = pv > 0 ? Math.round((downDollars / pv) * 10000) / 100 : 0;
    }

    const ltv = pv > 0 ? Math.floor((loanAmount / pv) * 10000) / 100 : 0;
    return { loanAmount, downPct, downDollars, ltv };
  }, [scenario.propertyValue, scenario.downPaymentPct, scenario.downPaymentDollars, scenario.loanAmount, lastEdited]);

  // Refi: loan amount or LTV — bidirectional
  const [refiLastEdited, setRefiLastEdited] = useState('loan');
  const refiCalc = useMemo(() => {
    const pv = Number(scenario.propertyValue) || 0;
    if (refiLastEdited === 'ltv') {
      const ltv = Number(scenario.refiLtv) || 0;
      const loan = Math.floor(pv * (ltv / 100));
      return { loanAmount: loan, ltv };
    }
    const loan = Math.floor(Number(scenario.loanAmount) || 0);
    const ltv = pv > 0 ? Math.floor((loan / pv) * 10000) / 100 : 0;
    return { loanAmount: loan, ltv };
  }, [scenario.propertyValue, scenario.loanAmount, scenario.refiLtv, refiLastEdited]);

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
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Borrower Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-4">Borrower</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Name" value={scenario.borrowerName} onChange={v => update('borrowerName', v)} placeholder="Borrower name" />
          <Field label="Email" value={scenario.borrowerEmail} onChange={v => update('borrowerEmail', v)} placeholder="email@example.com" type="email" />
          <Field label="Phone" value={scenario.borrowerPhone} onChange={v => update('borrowerPhone', v)} placeholder="303-555-1234" type="tel" />
        </div>
      </div>

      {/* Loan Scenario */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-4">Loan Scenario</h3>

        {/* Purpose + Type + Term + Product Type */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <SelectField label="Purpose" value={scenario.purpose} options={PURPOSES} onChange={v => {
            onChange({ ...scenario, purpose: v, ...deriveFromClosing(scenario.closingDate, scenario.state, v) });
          }} />
          <SelectField label="Loan Type" value={scenario.loanType} options={LOAN_TYPES} onChange={v => update('loanType', v)} />
          <SelectField label="Term" value={scenario.term} options={TERMS.map(t => ({ value: t, label: `${t} Year` }))} onChange={v => update('term', Number(v))} />
          <SelectField label="Amortization" value={scenario.productType || 'fixed'} options={[{ value: 'fixed', label: 'Fixed' }, { value: 'arm', label: 'ARM' }]} onChange={v => update('productType', v)} />
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
                value={lastEdited === 'dollars' ? scenario.downPaymentDollars : purchaseCalc.downDollars}
                onChange={v => { setLastEdited('dollars'); update('downPaymentDollars', v); }}
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
                value={refiLastEdited === 'loan' ? scenario.loanAmount : refiCalc.loanAmount}
                onChange={v => { setRefiLastEdited('loan'); update('loanAmount', v); }}
              />
              <Field
                label="LTV"
                value={refiLastEdited === 'ltv' ? scenario.refiLtv : refiCalc.ltv}
                onChange={v => { setRefiLastEdited('ltv'); update('refiLtv', v); }}
                type="number"
                suffix="%"
              />
            </>
          )}
        </div>

        {/* FICO + Zip + State + County + Lock */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
          <Field label="Credit Score" value={scenario.fico || ''} onChange={v => update('fico', v === '' ? '' : Number(v))} type="number" />
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              Zip Code {zipLoading && <span className="text-cyan-500 ml-1">...</span>}
            </label>
            <input
              type="text"
              maxLength={5}
              value={zipCode}
              onChange={e => handleZipLookup(e.target.value.replace(/\D/g, ''))}
              placeholder="80027"
              className="w-full rounded-lg border-gray-300 text-sm focus:ring-cyan-500 focus:border-cyan-500"
            />
            {scenario.county && <div className="text-[10px] text-cyan-600 mt-0.5">{scenario.county} County, {scenario.state}</div>}
          </div>
          <SelectField label="State" value={scenario.state} options={STATES.map(s => ({ value: s, label: s }))} onChange={v => {
            onChange({ ...scenario, state: v, county: '', ...deriveFromClosing(scenario.closingDate, v, scenario.purpose) });
          }} />
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

        {/* Closing dates */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Field
            label="Closing Date"
            value={scenario.closingDate || ''}
            onChange={v => onChange({ ...scenario, closingDate: v, ...deriveFromClosing(v, scenario.state, scenario.purpose) })}
            type="date"
          />
          <Field label="Funding Date" value={scenario.fundingDate || ''} onChange={v => update('fundingDate', v)} type="date" />
          <Field label="First Payment" value={scenario.firstPaymentDate || ''} onChange={v => update('firstPaymentDate', v)} type="date" />
          <Field label="Loan Payoff (Refi)" value={scenario.currentBalance || ''} onChange={v => update('currentBalance', v)} type="number" placeholder="Existing balance" disabled={isPurchase} />
        </div>

        {/* Loan limit badge */}
        {loanLimitInfo && (
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
            loanLimitInfo.classification === 'conforming' ? 'bg-green-50 text-green-700 border border-green-200' :
            loanLimitInfo.classification === 'highBalance' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
            'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {loanLimitInfo.classification === 'conforming' ? 'Conforming' :
             loanLimitInfo.classification === 'highBalance' ? 'High Balance' : 'Jumbo'}
            {' '} | Limit: ${loanLimitInfo.conforming1Unit?.toLocaleString()}
          </div>
        )}
      </div>

      {/* Refi-specific */}
      {!isPurchase && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-4">Current Loan</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Field label="Current Rate" value={scenario.currentRate} onChange={v => update('currentRate', v)} type="number" step="0.125" suffix="%" />
            <DollarField label="Current Balance" value={scenario.currentBalance} onChange={v => update('currentBalance', v)} />
            <DollarField label="Monthly Payment" value={scenario.currentPayment} onChange={v => update('currentPayment', v)} />
            <Field label="Current Lender" value={scenario.currentLender} onChange={v => update('currentLender', v)} />
          </div>
        </div>
      )}

      {/* Summary bar + Submit */}
      <div className="flex items-center justify-between bg-gray-900 text-white rounded-xl px-6 py-4">
        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="text-gray-400 text-xs">Loan</span>
            <div className="font-mono font-bold">${fmt(effectiveLoan)}</div>
          </div>
          <div>
            <span className="text-gray-400 text-xs">LTV</span>
            <div className="font-mono font-bold">{effectiveLtv}%</div>
          </div>
          <div>
            <span className="text-gray-400 text-xs">FICO</span>
            <div className="font-mono font-bold">{scenario.fico}</div>
          </div>
          <div>
            <span className="text-gray-400 text-xs">Type</span>
            <div className="font-bold uppercase text-xs">{scenario.loanType}</div>
          </div>
          <div className="border-l border-gray-700 pl-4 flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={scenario.borrowerPaid || false}
                onChange={e => update('borrowerPaid', e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
              />
              <span className="text-xs text-gray-300">Borrower-Paid</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={scenario.firstTimeBuyer || false}
                onChange={e => update('firstTimeBuyer', e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-emerald-400 focus:ring-emerald-400"
              />
              <span className="text-xs text-gray-300">First-Time Buyer</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={scenario.escrowsWaived || false}
                onChange={e => update('escrowsWaived', e.target.checked)}
                className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-800 text-orange-400 focus:ring-orange-400"
              />
              <span className="text-xs text-gray-300">Waive Escrows</span>
            </label>
          </div>
        </div>
        <button
          type="submit"
          disabled={loading || !effectiveLoan}
          className="px-8 py-2.5 bg-cyan-500 text-white rounded-lg font-bold text-sm hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors tracking-wide"
        >
          {loading ? 'PRICING...' : 'GET RATES'}
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
  const [focused, setFocused] = useState(false);
  const display = focused ? (value ?? '') : fmt(value);

  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
        <input
          type={focused ? 'number' : 'text'}
          value={display}
          onChange={e => onChange?.(unfmt(e.target.value))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={disabled}
          className="w-full pl-7 rounded-lg border-gray-300 text-sm font-mono focus:ring-cyan-500 focus:border-cyan-500 disabled:bg-gray-50 disabled:text-gray-400"
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
