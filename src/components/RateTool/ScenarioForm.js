'use client';

import { useMemo, useState, useCallback } from 'react';
import { getFicoBand } from '@/lib/rates/engine';
import { STATE_DEFAULTS, getThirdPartyCosts } from '@/lib/rates/closing-costs';
import { getCountiesByState, classifyLoan, getLoanLimits, BASELINE_1UNIT } from '@/data/county-loan-limits';

const DEFAULT_COUNTIES = { CO: 'Denver', CA: 'Los Angeles', TX: 'Dallas', OR: 'Multnomah' };

const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:border-brand focus:ring-2 focus:ring-brand/10 outline-none transition-colors";
const selectCls = "w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:border-brand focus:ring-2 focus:ring-brand/10 outline-none transition-colors";
const labelCls = "block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1";

function SectionCard({ title, children }) {
  return (
    <div className="mb-2">
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-1 h-3 bg-brand rounded-full" />
        <span className="text-[10px] font-bold text-brand uppercase tracking-widest">{title}</span>
      </div>
      <div className="bg-white rounded-xl p-3 shadow-[0_2px_12px_rgba(2,76,79,0.05)] border border-gray-100">
        {children}
      </div>
    </div>
  );
}

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

  const loanClassConfig = (() => {
    if (isVa) return { bg: 'bg-brand/10 border-brand/10', text: 'text-brand', label: 'VA' };
    if (isFha) return { bg: 'bg-brand/10 border-brand/10', text: 'text-brand', label: 'FHA' };
    if (!loanLimitInfo) return null;
    return {
      conforming:  { bg: 'bg-brand/10 border-brand/10', text: 'text-brand', label: 'Conventional'  },
      highBalance: { bg: 'bg-brand/10 border-brand/10', text: 'text-brand', label: 'High Balance'  },
      jumbo:       { bg: 'bg-brand/10 border-brand/10', text: 'text-brand', label: 'Jumbo'         },
    }[loanLimitInfo.classification] || null;
  })();

  return (
    <div className="my-3">

      {/* ── Header ── */}
      <div className="mb-3">
        <h2 className="text-xl font-bold text-gray-900">Your Scenario</h2>
        <p className="text-xs text-gray-500 mt-0.5">Configure your loan details to see real-time wholesale rates.</p>
      </div>

      {/* ── Live Stats Bar ── */}
      {loanAmount > 0 && (
        <div className="flex gap-1.5 mb-3 w-full">
          <div className="flex-1 bg-brand/10 border border-brand/10 rounded-lg px-2.5 py-1.5">
            <div className="text-[9px] font-bold text-brand uppercase tracking-wider">Loan Amt</div>
            <div className="text-sm font-semibold text-gray-900 tabular-nums">
              ${loanAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </div>
          </div>
          {isFha && (
            <div className="flex-1 bg-brand/10 border border-brand/10 rounded-lg px-2.5 py-1.5">
              <div className="text-[9px] font-bold text-brand uppercase tracking-wider">w/ UFMIP</div>
              <div className="text-sm font-semibold text-gray-900 tabular-nums">
                ${Math.floor(loanAmount * 1.0175).toLocaleString('en-US')}
              </div>
            </div>
          )}
          <div className="flex-1 bg-brand/10 border border-brand/10 rounded-lg px-2.5 py-1.5">
            <div className="text-[9px] font-bold text-brand uppercase tracking-wider">LTV</div>
            <div className="text-sm font-semibold text-gray-900 tabular-nums">{ltv.toFixed(1)}%</div>
          </div>
          <div className="flex-1 bg-brand/10 border border-brand/10 rounded-lg px-2.5 py-1.5">
            <div className="text-[9px] font-bold text-brand uppercase tracking-wider">FICO</div>
            <div className="text-sm font-semibold text-gray-900 tabular-nums">{scenario.fico || 780}</div>
          </div>
          {loanClassConfig && (
            <div className={`flex-1 rounded-lg px-2.5 py-1.5 border ${loanClassConfig.bg}`}>
              <div className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">Class</div>
              <div className={`text-sm font-semibold ${loanClassConfig.text}`}>{loanClassConfig.label}</div>
            </div>
          )}
        </div>
      )}

      {/* ── FHA Over-Limit Warning ── */}
      {fhaOverLimit && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-3.5 mb-3">
          <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-sm text-red-800">
            This loan amount exceeds the FHA limit of{' '}
            <strong>${loanLimitInfo.fhaLimit.toLocaleString()}</strong> for {scenario.county} County.
            FHA financing is not available above this limit.{' '}
            <a href="/contact" className="font-semibold underline hover:text-red-900 transition-colors">
              Contact us to discuss your options &rarr;
            </a>
          </p>
        </div>
      )}

      {/* ── Section 1: Loan Details ── */}
      <SectionCard title="Loan Details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>Loan Purpose</label>
            <select value={scenario.purpose} onChange={e => update('purpose', e.target.value)} className={selectCls}>
              <option value="purchase">Purchase</option>
              <option value="refi">Rate/Term Refinance</option>
              <option value="cashout">Cash-Out Refinance</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Loan Type</label>
            <select value={scenario.loanType || 'conventional'} onChange={e => {
              const lt = e.target.value;
              const newDown = lt === 'fha' ? 3.5 : lt === 'va' ? 0 : 25;
              const newFico = lt === 'fha' ? 680 : lt === 'va' ? 720 : 780;
              const newPV = lt === 'fha' ? 400000 : lt === 'va' ? 400000 : 533334;
              onChange({ ...scenario, loanType: lt, downPaymentPct: newDown, fico: newFico, propertyValue: newPV, vaFundingFeeExempt: false, vaSubsequentUse: false });
              setLastEdited('pct');
            }} className={selectCls}>
              <option value="conventional">Conventional</option>
              <option value="fha">FHA</option>
              <option value="va">VA</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Term</label>
            <select value={scenario.term || 30} onChange={e => update('term', parseInt(e.target.value, 10))} className={selectCls}>
              <option value={30}>30 Year</option>
              <option value={15}>15 Year</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Amortization Type</label>
            <select value={scenario.productType || 'fixed'} onChange={e => update('productType', e.target.value)} className={selectCls}>
              <option value="fixed">Fixed</option>
              <option value="arm">ARM</option>
            </select>
          </div>

          {/* VA-specific */}
          {scenario.loanType === 'va' && (
            <>
              <div className="flex items-center gap-3 py-1 sm:col-span-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={scenario.vaFundingFeeExempt || false}
                    onChange={e => update('vaFundingFeeExempt', e.target.checked)}
                    className="rounded border-gray-300 text-brand focus:ring-brand/30" />
                  <span className="text-sm text-gray-700">Exempt from VA Funding Fee</span>
                </label>
                <div className="group relative">
                  <span className="text-gray-400 cursor-help text-xs">ⓘ</span>
                  <div className="hidden group-hover:block absolute bottom-full left-0 mb-1 w-56 bg-gray-800 text-white text-xs rounded-lg p-2 z-50">
                    Veterans with a service-connected disability (10%+) are exempt from the VA funding fee.
                  </div>
                </div>
              </div>
              {!scenario.vaFundingFeeExempt && (
                <div className="flex items-center gap-3 py-1 sm:col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={scenario.vaSubsequentUse || false}
                      onChange={e => update('vaSubsequentUse', e.target.checked)}
                      className="rounded border-gray-300 text-brand focus:ring-brand/30" />
                    <span className="text-sm text-gray-700">Have you used a VA loan before?</span>
                  </label>
                  <div className="group relative">
                    <span className="text-gray-400 cursor-help text-xs">ⓘ</span>
                    <div className="hidden group-hover:block absolute bottom-full left-0 mb-1 w-64 bg-gray-800 text-white text-xs rounded-lg p-2 z-50">
                      If you&apos;ve previously purchased a home with a VA loan and haven&apos;t fully restored your entitlement, the funding fee is higher.
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* First-time buyer */}
          {isPurchase && (
            <div className="flex items-center gap-3 py-1 sm:col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={scenario.firstTimeBuyer || false}
                  onChange={e => update('firstTimeBuyer', e.target.checked)}
                  className="rounded border-gray-300 text-brand focus:ring-brand/30" />
                <span className="text-sm text-gray-700">First-Time Home Buyer</span>
              </label>
              <div className="group relative">
                <span className="text-gray-400 cursor-help text-xs">ⓘ</span>
                <div className="hidden group-hover:block absolute bottom-full left-0 mb-1 w-64 bg-gray-800 text-white text-xs rounded-lg p-2 z-50">
                  Includes HomeReady and Home Possible products with reduced down payment and flexible income requirements.
                </div>
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Section 2: Property & Financials ── */}
      <SectionCard title="Property & Financials">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">

          {/* Property type — button toggles */}
          <div>
            <label className={labelCls}>Property Type</label>
            <div className="flex gap-2 flex-wrap">
              {[['sfr', 'Single Family'], ['condo', 'Condo'], ['townhome', 'Townhome']].map(([val, label]) => (
                <button key={val} type="button" onClick={() => update('propertyType', val)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    scenario.propertyType === val
                      ? 'bg-brand text-white border-brand'
                      : 'bg-white text-ink-mid border-gray-200 hover:border-brand/40 hover:text-brand'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Number of units — button toggles */}
          <div>
            <label className={labelCls}>Number of Units</label>
            <div className="flex gap-2 flex-wrap">
              {[['1', '1 Unit'], ['2', '2 Units'], ['3-4', '3–4 Units'], ['5+', '5+ Units']].map(([val, label]) => (
                <button key={val} type="button" onClick={() => update('units', val)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    (scenario.units || '1') === val
                      ? val === '5+' ? 'bg-gray-400 text-white border-gray-400 cursor-default'
                        : 'bg-brand text-white border-brand'
                      : 'bg-white text-ink-mid border-gray-200 hover:border-brand/40 hover:text-brand'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
            {(scenario.units === '5+') && (
              <div className="mt-3 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3.5">
                <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <p className="text-sm text-amber-800">
                  5+ unit properties are commercial loans and don&apos;t qualify for residential mortgage pricing.{' '}
                  <a href="/contact" className="font-semibold underline hover:text-amber-900 transition-colors">
                    Contact us to discuss commercial financing options &rarr;
                  </a>
                </p>
              </div>
            )}
          </div>

          <div>
            <label className={labelCls}>{isPurchase ? 'Purchase Price' : 'Property Value'}</label>
            <input type="number" value={scenario.propertyValue || ''} placeholder="$"
              onChange={e => update('propertyValue', Number(e.target.value))}
              className={inputCls} />
          </div>

          {/* Purchase: three interlinked fields */}
          {isPurchase && (
            <>
              <div>
                <label className={labelCls}>Down Payment %</label>
                <input type="number" step="0.5" min="0" max="99"
                  value={lastEdited === 'pct' ? (scenario.downPaymentPct ?? '') : (purchaseCalc.downPct ?? '')}
                  placeholder="%" onChange={e => handleDownPct(Number(e.target.value))}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Down Payment $</label>
                <input type="number" step="1000"
                  value={lastEdited === 'dollars' ? (scenario.downPaymentDollars ?? '') : (purchaseCalc.downDollars ?? '')}
                  placeholder="$" onChange={e => handleDownDollars(Number(e.target.value))}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Loan Amount</label>
                <input type="number" step="1000"
                  value={lastEdited === 'loan' ? (scenario.manualLoanAmount || '') : (purchaseCalc.loanAmount || '')}
                  placeholder="$" onChange={e => handleLoanAmount(Number(e.target.value))}
                  className={inputCls} />
              </div>
            </>
          )}

          {/* Refi fields */}
          {!isPurchase && (
            <>
              <div>
                <label className={labelCls}>New Loan Amount</label>
                <input type="number" value={scenario.newLoanAmount || scenario.currentPayoff || ''} placeholder="$"
                  onChange={e => update('newLoanAmount', Number(e.target.value))}
                  className={inputCls} />
                <p className="text-xs text-gray-400 mt-1">Your new mortgage balance</p>
              </div>
              <div>
                <label className={labelCls}>Current Rate</label>
                <input type="number" step="0.125" value={scenario.currentRate || ''} placeholder="%"
                  onChange={e => update('currentRate', Number(e.target.value))}
                  className={inputCls} />
                <p className="text-xs text-gray-400 mt-1">Used to calculate savings</p>
              </div>
            </>
          )}

          {/* State + County */}
          <div>
            <label className={labelCls}>State</label>
            <select value={scenario.state || 'CO'} onChange={e => {
              const st = e.target.value;
              onChange({ ...scenario, state: st, county: DEFAULT_COUNTIES[st] || '', thirdPartyCosts: getThirdPartyCosts(st) });
            }} className={selectCls}>
              {Object.entries(STATE_DEFAULTS).map(([code, { label }]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>County</label>
            <select value={scenario.county || ''} onChange={e => update('county', e.target.value)} className={selectCls}>
              <option value="">All counties</option>
              {counties.map(c => (
                <option key={c.fips} value={c.name}>
                  {c.name}{c.oneUnitLimit > BASELINE_1UNIT ? ` ($${(c.oneUnitLimit / 1000).toFixed(0)}K)` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Credit Score — full width, bottom of section */}
          <div className="sm:col-span-2">
            <label className={labelCls}>
              Credit Score: <span className="text-gray-800 font-bold normal-case tracking-normal">{scenario.fico || 780}</span>
              <span className="ml-1 text-gray-400 normal-case tracking-normal font-normal">({getFicoBand(scenario.fico)})</span>
            </label>
            <input type="range" min={580} max={850} step={5} value={scenario.fico || 780}
              onChange={e => update('fico', parseInt(e.target.value, 10))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand mt-1" />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1">
              <span>580</span><span>660</span><span>740</span><span>850</span>
            </div>
          </div>

        </div>
      </SectionCard>

      {/* ── Get My Rates ── */}
      <button
        onClick={onSubmit}
        disabled={loading || !loanAmount || scenario.units === '5+'}
        className="w-full bg-accent text-ink py-3 rounded-nr-md font-bold text-base hover:bg-accent-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
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
