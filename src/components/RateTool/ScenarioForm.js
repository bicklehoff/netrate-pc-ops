'use client';

import { useMemo, useState, useCallback } from 'react';
import { getFicoBand } from '@/lib/rates/engine';
import { STATE_DEFAULTS, getThirdPartyCosts } from '@/lib/rates/closing-costs';
import { getCountiesByState, classifyLoan, getLoanLimits, BASELINE_1UNIT } from '@/data/county-loan-limits';

const DEFAULT_COUNTIES = { CO: 'Denver', CA: 'Los Angeles', TX: 'Dallas', OR: 'Multnomah' };

/* ── Design System Option A — shared styles ──────────────────────── */
const inputCls = "w-full border border-gray-200 rounded-nr-lg px-3 py-2.5 text-sm font-semibold text-ink bg-white focus:border-brand focus:ring-2 focus:ring-brand/10 outline-none transition-colors tabular-nums";
const selectCls = "w-full border border-gray-200 rounded-nr-lg px-3 py-2.5 text-sm bg-white focus:border-brand focus:ring-2 focus:ring-brand/10 outline-none transition-colors";
const labelCls = "text-sm font-medium text-ink";
const sectionLabelCls = "text-xs font-semibold text-ink-subtle uppercase tracking-wide mb-4";

/* ── Pill Toggle ─────────────────────────────────────────────────── */
function PillToggle({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-all ${
            value === opt.value
              ? 'border-brand bg-brand text-white'
              : 'border-gray-200 bg-white text-ink-mid hover:border-brand/40'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ── Segment Toggle (equal-width) ────────────────────────────────── */
function SegmentToggle({ options, value, onChange }) {
  return (
    <div className="flex gap-2">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 py-2 rounded-nr-lg text-sm font-medium border transition-all ${
            value === opt.value
              ? 'border-brand bg-brand/10 text-brand'
              : 'border-gray-200 text-ink-mid hover:border-brand/30'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ── Slider + Text Input ─────────────────────────────────────────── */
function SliderInput({ label, value, onChange, min, max, step, prefix, suffix }) {
  return (
    <div>
      <span className={labelCls}>{label}</span>
      <div className="mt-1.5 relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle text-sm pointer-events-none">{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          step={step}
          min={min}
          max={max}
          className={`${inputCls} ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-10' : ''}`}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle text-sm pointer-events-none">{suffix}</span>}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value || min}
        onChange={e => onChange(Number(e.target.value))}
        className="mt-2 w-full h-2 rounded-lg appearance-none cursor-pointer accent-brand bg-gray-200"
      />
      <div className="flex justify-between text-[10px] text-ink-subtle mt-0.5">
        <span>{prefix}{typeof min === 'number' ? min.toLocaleString() : min}</span>
        <span>{prefix}{typeof max === 'number' ? max.toLocaleString() : max}</span>
      </div>
    </div>
  );
}

/* ── Main Form ───────────────────────────────────────────────────── */
export default function ScenarioForm({ scenario, onChange, onSubmit, loading }) {
  const update = (field, value) => onChange({ ...scenario, [field]: value });

  const [lastEdited, setLastEdited] = useState('pct');

  const purchaseCalc = useMemo(() => {
    const pv = scenario.propertyValue || 0;
    if (!pv) return { loanAmount: 0, downPct: 0, downDollars: 0, ltv: 0 };

    let loanAmount, downPct, downDollars;

    if (lastEdited === 'pct') {
      downPct = scenario.downPaymentPct || 0;
      loanAmount = Math.floor(pv * (1 - downPct / 100));
      downDollars = pv - loanAmount;
    } else if (lastEdited === 'dollars') {
      downDollars = scenario.downPaymentDollars || 0;
      downPct = pv > 0 ? Math.round((downDollars / pv) * 10000) / 100 : 0;
      loanAmount = Math.floor(pv - downDollars);
    } else if (lastEdited === 'loan') {
      loanAmount = Math.floor(scenario.manualLoanAmount || 0);
      downDollars = pv - loanAmount;
      downPct = pv > 0 ? Math.round((downDollars / pv) * 10000) / 100 : 0;
    }

    const ltv = pv > 0 ? Math.floor((loanAmount / pv) * 10000) / 100 : 0;
    return { loanAmount, downPct, downDollars, ltv };
  }, [scenario.propertyValue, scenario.downPaymentPct, scenario.downPaymentDollars, scenario.manualLoanAmount, lastEdited]);

  const refiCalc = useMemo(() => {
    const pv = scenario.propertyValue || 0;
    const loan = Math.floor(scenario.newLoanAmount || scenario.currentPayoff || 0);
    const ltv = pv > 0 ? Math.floor((loan / pv) * 10000) / 100 : 0;
    return { loanAmount: loan, ltv };
  }, [scenario.propertyValue, scenario.newLoanAmount, scenario.currentPayoff]);

  const isPurchase = scenario.purpose === 'purchase';
  const isFha = scenario.loanType === 'fha';
  const isVa = scenario.loanType === 'va';
  const loanAmount = isPurchase ? purchaseCalc.loanAmount : refiCalc.loanAmount;
  const ltv = isPurchase ? purchaseCalc.ltv : refiCalc.ltv;

  const counties = useMemo(() => getCountiesByState(scenario.state || 'CO'), [scenario.state]);

  const loanLimitInfo = useMemo(() => {
    if (!scenario.county || !loanAmount) return null;
    const limits = getLoanLimits(scenario.state, scenario.county);
    if (!limits) return null;
    const classification = classifyLoan(loanAmount, scenario.state, scenario.county);
    return { ...limits, classification };
  }, [scenario.state, scenario.county, loanAmount]);

  useMemo(() => {
    if (scenario.loanAmount !== loanAmount || scenario.ltv !== ltv) {
      onChange({ ...scenario, loanAmount: loanAmount, ltv });
    }
  }, [loanAmount, ltv]);

  const handleDownPct = useCallback((val) => {
    setLastEdited('pct');
    onChange({ ...scenario, downPaymentPct: val });
  }, [scenario, onChange]);

  const handleDownDollars = useCallback((val) => {
    setLastEdited('dollars');
    onChange({ ...scenario, downPaymentDollars: val });
  }, [scenario, onChange]);

  const handleLoanAmount = useCallback((val) => {
    setLastEdited('loan');
    onChange({ ...scenario, manualLoanAmount: val });
  }, [scenario, onChange]);

  const fhaOverLimit = isFha && loanLimitInfo && loanAmount > loanLimitInfo.fhaLimit;

  const loanClassLabel = (() => {
    if (isVa) return 'VA';
    if (isFha) return 'FHA';
    if (!loanLimitInfo) return null;
    return { conforming: 'Conventional', highBalance: 'High Balance', jumbo: 'Jumbo' }[loanLimitInfo.classification] || null;
  })();

  const DOWN_PRESETS = isFha ? [3.5, 5, 10, 20] : isVa ? [0, 5, 10, 20] : [3, 5, 10, 20];

  return (
    <div className="space-y-4">

      {/* ── Loan Program (pill toggle) ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-nr-sm">
        <h2 className={sectionLabelCls}>Loan Program</h2>
        <div className="space-y-4">
          <div>
            <span className={`${labelCls} block mb-2`}>Purpose</span>
            <PillToggle
              value={scenario.purpose}
              onChange={v => update('purpose', v)}
              options={[
                { value: 'purchase', label: 'Purchase' },
                { value: 'refi', label: 'Rate/Term Refi' },
                { value: 'cashout', label: 'Cash-Out Refi' },
              ]}
            />
          </div>
          <div>
            <span className={`${labelCls} block mb-2`}>Loan Type</span>
            <PillToggle
              value={scenario.loanType || 'conventional'}
              onChange={lt => {
                const newDown = lt === 'fha' ? 3.5 : lt === 'va' ? 0 : 25;
                const newFico = lt === 'fha' ? 680 : lt === 'va' ? 720 : 780;
                const newPV = lt === 'fha' ? 400000 : lt === 'va' ? 400000 : 533334;
                onChange({ ...scenario, loanType: lt, downPaymentPct: newDown, fico: newFico, propertyValue: newPV, vaFundingFeeExempt: false, vaSubsequentUse: false });
                setLastEdited('pct');
              }}
              options={[
                { value: 'conventional', label: 'Conventional' },
                { value: 'fha', label: 'FHA' },
                { value: 'va', label: 'VA' },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className={`${labelCls} block mb-2`}>Term</span>
              <SegmentToggle
                value={scenario.term || 30}
                onChange={v => update('term', v)}
                options={[
                  { value: 30, label: '30yr' },
                  { value: 15, label: '15yr' },
                ]}
              />
            </div>
            <div>
              <span className={`${labelCls} block mb-2`}>Amortization</span>
              <SegmentToggle
                value={scenario.productType || 'fixed'}
                onChange={v => update('productType', v)}
                options={[
                  { value: 'fixed', label: 'Fixed' },
                  { value: 'arm', label: 'ARM' },
                ]}
              />
            </div>
          </div>

          {/* VA-specific */}
          {isVa && (
            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={scenario.vaFundingFeeExempt || false}
                  onChange={e => update('vaFundingFeeExempt', e.target.checked)}
                  className="rounded border-gray-300 text-brand focus:ring-brand/30" />
                <span className="text-sm text-ink-mid">Exempt from VA Funding Fee</span>
              </label>
              {!scenario.vaFundingFeeExempt && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={scenario.vaSubsequentUse || false}
                    onChange={e => update('vaSubsequentUse', e.target.checked)}
                    className="rounded border-gray-300 text-brand focus:ring-brand/30" />
                  <span className="text-sm text-ink-mid">Have you used a VA loan before?</span>
                </label>
              )}
            </div>
          )}

          {/* First-time buyer */}
          {isPurchase && (
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input type="checkbox" checked={scenario.firstTimeBuyer || false}
                onChange={e => update('firstTimeBuyer', e.target.checked)}
                className="rounded border-gray-300 text-brand focus:ring-brand/30" />
              <span className="text-sm text-ink-mid">First-Time Home Buyer</span>
            </label>
          )}
        </div>
      </div>

      {/* ── Property & Financials ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-nr-sm">
        <h2 className={sectionLabelCls}>Property &amp; Financials</h2>
        <div className="space-y-5">

          {/* Property type toggles */}
          <div>
            <span className={`${labelCls} block mb-2`}>Property Type</span>
            <div className="flex gap-2 flex-wrap">
              {[['sfr', 'Single Family'], ['condo', 'Condo'], ['townhome', 'Townhome']].map(([val, label]) => (
                <button key={val} type="button" onClick={() => update('propertyType', val)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-all ${
                    scenario.propertyType === val
                      ? 'border-brand bg-brand text-white'
                      : 'border-gray-200 bg-white text-ink-mid hover:border-brand/40'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Units */}
          <div>
            <span className={`${labelCls} block mb-2`}>Units</span>
            <SegmentToggle
              value={scenario.units || '1'}
              onChange={v => update('units', v)}
              options={[
                { value: '1', label: '1' },
                { value: '2', label: '2' },
                { value: '3-4', label: '3-4' },
                { value: '5+', label: '5+' },
              ]}
            />
            {scenario.units === '5+' && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-sm text-amber-800">
                5+ unit properties are commercial loans.{' '}
                <a href="/contact" className="font-semibold underline">Contact us &rarr;</a>
              </div>
            )}
          </div>

          {/* Property Value / Purchase Price — slider */}
          <SliderInput
            label={isPurchase ? 'Purchase Price' : 'Property Value'}
            prefix="$"
            value={scenario.propertyValue || 0}
            onChange={v => update('propertyValue', v)}
            min={100000}
            max={2000000}
            step={5000}
          />

          {/* Purchase: down payment with presets */}
          {isPurchase && (
            <>
              <div>
                <SliderInput
                  label="Down Payment"
                  suffix="%"
                  value={lastEdited === 'pct' ? (scenario.downPaymentPct ?? 0) : (purchaseCalc.downPct ?? 0)}
                  onChange={handleDownPct}
                  min={isVa ? 0 : isFha ? 3.5 : 3}
                  max={50}
                  step={0.5}
                />
                <div className="flex gap-2 mt-2">
                  {DOWN_PRESETS.map(pct => {
                    const currentPct = lastEdited === 'pct' ? scenario.downPaymentPct : purchaseCalc.downPct;
                    return (
                      <button key={pct} type="button"
                        onClick={() => handleDownPct(pct)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                          currentPct === pct
                            ? 'border-brand bg-brand/10 text-brand'
                            : 'border-gray-200 text-ink-subtle hover:border-brand/30'
                        }`}
                      >
                        {pct}%
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Down Payment $</label>
                  <div className="mt-1.5 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle text-sm pointer-events-none">$</span>
                    <input type="number" step="1000"
                      value={lastEdited === 'dollars' ? (scenario.downPaymentDollars ?? '') : (purchaseCalc.downDollars ?? '')}
                      onChange={e => handleDownDollars(Number(e.target.value))}
                      className={`${inputCls} pl-7`} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Loan Amount</label>
                  <div className="mt-1.5 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle text-sm pointer-events-none">$</span>
                    <input type="number" step="1000"
                      value={lastEdited === 'loan' ? (scenario.manualLoanAmount || '') : (purchaseCalc.loanAmount || '')}
                      onChange={e => handleLoanAmount(Number(e.target.value))}
                      className={`${inputCls} pl-7`} />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Refi fields */}
          {!isPurchase && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>New Loan Amount</label>
                <div className="mt-1.5 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-subtle text-sm pointer-events-none">$</span>
                  <input type="number" value={scenario.newLoanAmount || scenario.currentPayoff || ''}
                    onChange={e => update('newLoanAmount', Number(e.target.value))}
                    className={`${inputCls} pl-7`} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Current Rate</label>
                <div className="mt-1.5 relative">
                  <input type="number" step="0.125" value={scenario.currentRate || ''}
                    onChange={e => update('currentRate', Number(e.target.value))}
                    className={`${inputCls} pr-8`} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle text-sm pointer-events-none">%</span>
                </div>
              </div>
            </div>
          )}

          {/* State + County */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>State</label>
              <select value={scenario.state || 'CO'} onChange={e => {
                const st = e.target.value;
                onChange({ ...scenario, state: st, county: DEFAULT_COUNTIES[st] || '', thirdPartyCosts: getThirdPartyCosts(st) });
              }} className={`${selectCls} mt-1.5`}>
                {Object.entries(STATE_DEFAULTS).map(([code, { label }]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>County</label>
              <select value={scenario.county || ''} onChange={e => update('county', e.target.value)} className={`${selectCls} mt-1.5`}>
                <option value="">All counties</option>
                {counties.map(c => (
                  <option key={c.fips} value={c.name}>
                    {c.name}{c.oneUnitLimit > BASELINE_1UNIT ? ` ($${(c.oneUnitLimit / 1000).toFixed(0)}K)` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Credit Score — slider */}
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className={labelCls}>Credit Score</span>
              <span className="text-sm font-semibold text-ink tabular-nums">
                {scenario.fico || 780}
                <span className="text-xs font-normal text-ink-subtle ml-1">({getFicoBand(scenario.fico)})</span>
              </span>
            </div>
            <input type="range" min={580} max={850} step={5} value={scenario.fico || 780}
              onChange={e => update('fico', parseInt(e.target.value, 10))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand" />
            <div className="flex justify-between text-[10px] text-ink-subtle mt-0.5">
              <span>580</span><span>660</span><span>740</span><span>850</span>
            </div>
          </div>

        </div>
      </div>

      {/* ── Live Stats Bar ── */}
      {loanAmount > 0 && (
        <div className="flex gap-1.5">
          <div className="flex-1 bg-brand/10 border border-brand/10 rounded-lg px-2.5 py-1.5">
            <div className="text-[9px] font-bold text-brand uppercase tracking-wider">Loan Amt</div>
            <div className="text-sm font-semibold text-ink tabular-nums">
              ${loanAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
          </div>
          {isFha && (
            <div className="flex-1 bg-brand/10 border border-brand/10 rounded-lg px-2.5 py-1.5">
              <div className="text-[9px] font-bold text-brand uppercase tracking-wider">w/ UFMIP</div>
              <div className="text-sm font-semibold text-ink tabular-nums">
                ${Math.floor(loanAmount * 1.0175).toLocaleString('en-US')}
              </div>
            </div>
          )}
          <div className="flex-1 bg-brand/10 border border-brand/10 rounded-lg px-2.5 py-1.5">
            <div className="text-[9px] font-bold text-brand uppercase tracking-wider">LTV</div>
            <div className="text-sm font-semibold text-ink tabular-nums">{ltv.toFixed(1)}%</div>
          </div>
          <div className="flex-1 bg-brand/10 border border-brand/10 rounded-lg px-2.5 py-1.5">
            <div className="text-[9px] font-bold text-brand uppercase tracking-wider">FICO</div>
            <div className="text-sm font-semibold text-ink tabular-nums">{scenario.fico || 780}</div>
          </div>
          {loanClassLabel && (
            <div className="flex-1 bg-brand/10 border border-brand/10 rounded-lg px-2.5 py-1.5">
              <div className="text-[9px] font-bold text-brand uppercase tracking-wider">Class</div>
              <div className="text-sm font-semibold text-brand">{loanClassLabel}</div>
            </div>
          )}
        </div>
      )}

      {/* ── FHA Over-Limit Warning ── */}
      {fhaOverLimit && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-sm text-red-800">
          This loan amount exceeds the FHA limit of{' '}
          <strong>${loanLimitInfo.fhaLimit.toLocaleString()}</strong> for {scenario.county} County.{' '}
          <a href="/contact" className="font-semibold underline">Contact us &rarr;</a>
        </div>
      )}

      {/* ── Get My Rates ── */}
      <button
        onClick={onSubmit}
        disabled={loading || !loanAmount || scenario.units === '5+'}
        className="w-full bg-go text-white py-3 rounded-nr-md font-bold text-base hover:bg-go-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Fetching Your Rates...
          </>
        ) : 'Get My Rates →'}
      </button>

    </div>
  );
}
