'use client';

import { useEffect, useState, useMemo, useRef } from 'react';

// ── Broker comp (not lender pricing — applied client-side after API) ──
const COMP_RATE = 0.02;
const COMP_CAP_PURCHASE = 4595;
const COMP_CAP_REFI = 3595;

// Defaults the borrower never picks (per AD-4 — drop loan-officer controls).
// 7/6 ARM is the most-common DSCR program; 30-day lock is the standard. MLO calc
// at /portal/mlo/dscr (D9d.1, future) will expose these as selectors.
const DEFAULT_ARM_FIXED_PERIOD = 7;
const DEFAULT_LOCK_DAYS = 30;

// Wholesale lender names + lender-coined tier names are confidential and not
// shown on the public calc (per 2026-04-27 product call). The badge is gone;
// the "Your Rate" card displays only product shape + lock days.

const UNITS_TO_PROPERTY = {
  1: 'sfr',
  2: '2unit',
  3: '3unit',
  4: '4unit',
};

const PURPOSE_TO_API = {
  purchase: 'purchase',
  refinance: 'rate_term',
  cashout: 'cashout',
};

function fmtD(n) { return '$' + Math.round(n).toLocaleString(); }

// ── Design system classes ──
const labelCls = 'block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1';
const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:border-brand focus:ring-2 focus:ring-brand/10 outline-none transition-colors tabular-nums';
const cardCls = 'bg-white rounded-2xl border border-gray-100 shadow-[0_4px_24px_rgba(2,76,79,0.06)] p-5';

function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <div className="w-1 h-3 bg-brand rounded-full" />
      <span className="text-[10px] font-bold text-brand uppercase tracking-widest">{children}</span>
    </div>
  );
}

function DSCRGauge({ dscr }) {
  const cx = 100, cy = 90, r = 72;
  const arcLen = Math.PI * r;
  const fillPct = Math.min(1, Math.max(0, (dscr - 0.75) / 1.0));
  const fillLen = fillPct * arcLen;
  const color = dscr >= 1.30 ? '#16a34a' : dscr >= 1.00 ? '#d97706' : '#dc2626';
  const status = dscr >= 1.30 ? 'Strong' : dscr >= 1.25 ? 'Qualifying' : dscr >= 1.00 ? 'Minimum' : 'Below Min';

  const arcPoint = (f, radius) => {
    const theta = (1 - f) * Math.PI;
    return { x: cx + radius * Math.cos(theta), y: cy - radius * Math.sin(theta) };
  };

  const ticks = [0.25, 0.50, 0.55];

  return (
    <svg viewBox="0 0 200 108" className="w-full max-w-[300px] mx-auto">
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="#e5e7eb" strokeWidth="16" strokeLinecap="round"
      />
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke={color} strokeWidth="16" strokeLinecap="round"
        strokeDasharray={`${fillLen} ${arcLen}`}
        style={{ transition: 'stroke-dasharray 0.4s ease, stroke 0.3s ease' }}
      />
      {ticks.map(f => {
        const inner = arcPoint(f, r - 9);
        const outer = arcPoint(f, r + 1);
        return (
          <line key={f} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
            stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" />
        );
      })}
      <text x={cx} y={cy - 20} textAnchor="middle" fontSize="40" fontWeight="700"
        fill={color} fontFamily="Inter,sans-serif" style={{ transition: 'fill 0.3s ease' }}>
        {dscr.toFixed(2)}
      </text>
      <text x={cx} y={cy + 2} textAnchor="middle" fontSize="10" fontWeight="600"
        fill="#9ca3af" fontFamily="Inter,sans-serif" letterSpacing="2">DSCR</text>
      <text x={cx} y={cy + 18} textAnchor="middle" fontSize="11" fontWeight="600"
        fill={color} fontFamily="Inter,sans-serif" style={{ transition: 'fill 0.3s ease' }}>{status}</text>
    </svg>
  );
}

export default function DSCRCalculator() {
  // Inputs
  const [purchasePrice, setPurchasePrice] = useState(380000);
  const [downPayment, setDownPayment] = useState(95000);
  const [fico, setFico] = useState(760);
  const [units, setUnits] = useState(1);
  const [state, setState] = useState('CO');
  const [purpose, setPurpose] = useState('purchase');
  const [monthlyRent, setMonthlyRent] = useState(2600);
  const [monthlyTaxes, setMonthlyTaxes] = useState(350);
  const [monthlyInsurance, setMonthlyInsurance] = useState(150);
  const [monthlyHoa, setMonthlyHoa] = useState(0);
  // Slider index walks the eligible ladder; auto-defaults to par when scenario
  // changes (see effect below). Replaces the old per-rate click selector.
  const [sliderIndex, setSliderIndex] = useState(0);

  // API state
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Derived
  const loanAmount = purchasePrice - downPayment;
  const ltv = purchasePrice > 0 ? (loanAmount / purchasePrice) * 100 : 0;
  const compCap = purpose === 'purchase' ? COMP_CAP_PURCHASE : COMP_CAP_REFI;
  const compDollar = Math.min(loanAmount * COMP_RATE, compCap);
  const compPts = loanAmount > 0 ? (compDollar / loanAmount) * 100 : 0;
  const monthlyEscrow = monthlyTaxes + monthlyInsurance;

  // Debounced API call
  const abortRef = useRef(null);
  useEffect(() => {
    if (!loanAmount || loanAmount < 50000 || ltv > 80) {
      setData(null);
      return;
    }
    const timer = setTimeout(async () => {
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/pricing/dscr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: ctrl.signal,
          body: JSON.stringify({
            // Per AD-4: borrower calc auto-picks tier and ARM period. Pricer
            // returns the full ladder across all tiers and lenders; calc picks
            // par and lets the borrower walk via the slider.
            product_type: 'arm',
            term: 30,
            arm_fixed_period: DEFAULT_ARM_FIXED_PERIOD,
            lock_days: DEFAULT_LOCK_DAYS,
            fico,
            cltv: Math.round(ltv * 100) / 100,
            state,
            occupancy: 'investment',
            loan_purpose: PURPOSE_TO_API[purpose] || 'purchase',
            property_type: UNITS_TO_PROPERTY[units] || 'sfr',
            loan_size: loanAmount,
            prepay_years: 5,
            prepay_structure: 'fixed_5',
            dscr_inputs: {
              monthly_rent: monthlyRent,
              monthly_escrow: monthlyEscrow,
              monthly_hoa: monthlyHoa,
              loan_amount: loanAmount,
            },
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        const json = await res.json();
        setData(json);
      } catch (e) {
        if (e.name !== 'AbortError') setError(e.message);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [loanAmount, ltv, fico, state, purpose, units, monthlyRent, monthlyEscrow, monthlyHoa]);

  // Apply broker comp + compute display-ready rows.
  //
  // The public API projection (`/api/pricing/dscr` POST) deliberately strips
  // lender_code / tier / raw_product_name — wholesale lender names + lender-
  // coined tier names are confidential. The calc renders product shape only.
  //
  // Core-tier filter (Everstream's Core DSCR products): the pricer flags
  // those rows with a `core_llpas_missing` warning because LLPAs haven't been
  // ingested for that tier — the row carries base price only. Surfacing
  // would be misleading; drop here. When Core LLPAs land in a future ingest,
  // this filter becomes a no-op (no rows will carry the warning).
  const rows = useMemo(() => {
    if (!data?.priced) return [];
    return data.priced
      .filter(r => !(r.warnings || []).some(w => w.code === 'core_llpas_missing'))
      .map(r => {
        const lenderPrice = r.final_price;
        const netPrice = lenderPrice - compPts;
        const netDollar = (netPrice - 100) / 100 * loanAmount;
        return {
          rate: r.note_rate,
          pi: r.pi,
          pitia: r.pitia,
          dscr: r.dscr,
          netPrice,
          netDollar,
          warnings: r.warnings || [],
        };
      });
  }, [data, compPts, loanAmount]);

  // Trade-points slider walks displayRows (sorted highest→lowest rate, since
  // pricer returns final_price desc and final_price tracks note_rate). Index 0
  // is left thumb (highest rate, most rebate). Last index is right thumb
  // (lowest rate, most points paid). Par is in between.
  const displayRows = rows.filter(r => Math.abs(r.netPrice - 100) < 3.0);

  // Par index = closest net price to 100
  const parIndex = displayRows.length
    ? displayRows.reduce(
        (bestIdx, r, idx) =>
          Math.abs(r.netPrice - 100) < Math.abs(displayRows[bestIdx].netPrice - 100) ? idx : bestIdx,
        0
      )
    : 0;

  // Auto-recenter to par whenever the ladder shape changes (new scenario)
  useEffect(() => {
    setSliderIndex(parIndex);
  }, [parIndex, displayRows.length]);

  const activeRow = displayRows[Math.min(sliderIndex, displayRows.length - 1)] || null;

  // Slider bounds
  const dpMin = Math.round(purchasePrice * 0.20 / 1000) * 1000;
  const dpMax = Math.round(purchasePrice * 0.50 / 1000) * 1000;
  const dpPct = dpMax > dpMin ? ((downPayment - dpMin) / (dpMax - dpMin) * 100).toFixed(1) : 0;

  // The public API meta returns `as_of` (max effective date across all
  // active wholesale sheets, name-stripped per the lender-confidentiality
  // boundary). The calc surfaces it as the "live wholesale pricing as of
  // <date>" trust signal in the header.
  const sheetDate = data?.meta?.as_of
    ? new Date(data.meta.as_of).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  // Guidelines
  const guidelines = activeRow ? [
    { pass: ltv <= (units > 1 ? 75 : 80), warn: ltv <= 80, text: `LTV ${ltv.toFixed(1)}% — max ${units > 1 ? '75%' : '80%'} for ${units}-unit DSCR` },
    { pass: activeRow.dscr >= 1.25, warn: activeRow.dscr >= 1.00, text: `DSCR ${activeRow.dscr.toFixed(2)} — min 1.00 required · 1.25+ preferred` },
    { pass: fico >= 700, warn: fico >= 660, text: `FICO ${fico} — min 660 for most LTV bands` },
    { pass: activeRow.dscr >= 1.30, warn: false, text: activeRow.dscr >= 1.30 ? `DSCR > 1.30 — earns ratio credit` : `DSCR below 1.30 — no ratio bonus` },
    { pass: units === 1, warn: units > 1, text: `${units}-unit — ${units > 1 ? 'LLPA applies on 2–4 unit properties' : 'SFR is par'}` },
    { pass: false, warn: true, text: `Verify ${units > 1 ? '12' : '6'} months PITIA reserves required` },
  ] : [];

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      {/* Header */}
      <div className="bg-brand border-b border-brand-dark">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <h1 className="text-white font-bold text-base">DSCR Loan Calculator</h1>
          <span className="bg-accent text-ink text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Investor</span>
          <span className="ml-auto text-white/60 text-xs hidden sm:block">
            Live wholesale pricing · as of {sheetDate}
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[320px_1fr_210px] gap-5 items-start">

        {/* ── LEFT: Inputs ── */}
        <div className="flex flex-col gap-4">
          <div className={cardCls}>
            <SectionLabel>Loan Scenario</SectionLabel>

            {/* Purchase Price */}
            <div className="mb-3">
              <label className={labelCls}>Purchase Price</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" value={purchasePrice} onChange={e => setPurchasePrice(+e.target.value || 0)}
                  step={5000} className={inputCls + ' pl-6'} />
              </div>
            </div>

            {/* Down Payment Slider */}
            <div className="mb-4">
              <div className="flex justify-between items-baseline mb-1">
                <label className={labelCls}>Down Payment</label>
                <span className="text-base font-bold text-brand tabular-nums">
                  {fmtD(downPayment)} <span className="text-xs font-medium text-gray-400">({(downPayment / purchasePrice * 100).toFixed(1)}%)</span>
                </span>
              </div>
              <input
                type="range"
                min={dpMin} max={dpMax} step={1000}
                value={Math.min(Math.max(downPayment, dpMin), dpMax)}
                onChange={e => setDownPayment(+e.target.value)}
                className="w-full h-1.5 rounded-full outline-none cursor-pointer appearance-none
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                  [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
                  [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-brand
                  [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #2E6BA8 0%, #2E6BA8 ${dpPct}%, #e5e7eb ${dpPct}%, #e5e7eb 100%)`
                }}
              />
              <div className="flex justify-between text-[11px] text-gray-400 mt-1">
                <span>20% — {fmtD(dpMin)}</span>
                <span>50% — {fmtD(dpMax)}</span>
              </div>
            </div>

            {/* Derived: Loan Amount + LTV */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className={labelCls}>Loan Amount <span className="text-gray-300 normal-case font-normal tracking-normal">auto</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="text" readOnly value={loanAmount.toLocaleString()}
                    className={inputCls + ' pl-6 bg-gray-50 text-gray-500 cursor-default'} />
                </div>
              </div>
              <div>
                <label className={labelCls}>LTV <span className="text-gray-300 normal-case font-normal tracking-normal">auto</span></label>
                <input type="text" readOnly value={ltv.toFixed(1) + '%'}
                  className={inputCls + ' bg-gray-50 text-gray-500 cursor-default'} />
              </div>
            </div>

            {/* FICO + Units */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className={labelCls}>FICO Score</label>
                <input type="number" value={fico} onChange={e => setFico(+e.target.value)}
                  min={620} max={850} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Units</label>
                <select value={units} onChange={e => setUnits(+e.target.value)} className={inputCls}>
                  <option value={1}>1 Unit (SFR)</option>
                  <option value={2}>2 Units</option>
                  <option value={3}>3 Units</option>
                  <option value={4}>4 Units</option>
                </select>
              </div>
            </div>

            {/* State + Purpose */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className={labelCls}>State</label>
                <select value={state} onChange={e => setState(e.target.value)} className={inputCls}>
                  <option value="CO">Colorado</option>
                  <option value="CA">California</option>
                  <option value="TX">Texas</option>
                  <option value="OR">Oregon</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Purpose</label>
                <select value={purpose} onChange={e => setPurpose(e.target.value)} className={inputCls}>
                  <option value="purchase">Purchase</option>
                  <option value="refinance">Refinance</option>
                  <option value="cashout">Cash-Out</option>
                </select>
              </div>
            </div>

          </div>

          {/* Income & Expenses */}
          <div className={cardCls}>
            <SectionLabel>Monthly Income &amp; Expenses</SectionLabel>

            <div className="mb-3">
              <label className={labelCls}>Gross Monthly Rent</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" value={monthlyRent} onChange={e => setMonthlyRent(+e.target.value)}
                  step={50} className={inputCls + ' pl-6'} />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">Market rent — use lease or appraisal</p>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className={labelCls}>Property Taxes (mo.)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" value={monthlyTaxes} onChange={e => setMonthlyTaxes(+e.target.value)}
                    step={25} className={inputCls + ' pl-6'} />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">Annual ÷ 12</p>
              </div>
              <div>
                <label className={labelCls}>Insurance (mo.)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" value={monthlyInsurance} onChange={e => setMonthlyInsurance(+e.target.value)}
                    step={10} className={inputCls + ' pl-6'} />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">Hazard + landlord</p>
              </div>
            </div>

            <div className="mb-4">
              <label className={labelCls}>HOA (monthly, if any)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" value={monthlyHoa} onChange={e => setMonthlyHoa(+e.target.value)}
                  step={25} className={inputCls + ' pl-6'} />
              </div>
            </div>
          </div>
        </div>

        {/* ── CENTER: Payment + Rates ── */}
        <div className="flex flex-col gap-4">

          {/* Loading / error / empty states above the payment card */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              Pricing error: {error}
            </div>
          )}
          {!error && ltv > 80 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              LTV over 80% — DSCR programs cap at 80%. Increase down payment to see pricing.
            </div>
          )}
          {!error && !loading && !activeRow && ltv <= 80 && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600">
              {data && data.priced?.length === 0
                ? "This scenario doesn't qualify with our DSCR programs today. Try increasing down payment, lowering loan size, or adjusting the rent assumption."
                : 'Enter a scenario to see live pricing.'}
            </div>
          )}

          {activeRow && (
            <>
              {/* Payment breakdown */}
              <div className={cardCls}>
                <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                  <SectionLabel>Your Rate — {activeRow.rate.toFixed(3)}%</SectionLabel>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
                    Investor DSCR · {DEFAULT_ARM_FIXED_PERIOD}/6 ARM · {DEFAULT_LOCK_DAYS}-day lock
                  </span>
                </div>

                <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5 mb-2">
                  {[
                    { val: activeRow.pi, color: '#2E6BA8' },
                    { val: monthlyTaxes, color: '#f59e0b' },
                    { val: monthlyInsurance, color: '#10b981' },
                    { val: monthlyHoa, color: '#8b5cf6' },
                  ].map(({ val, color }, i) => (
                    <div key={i} style={{ width: (val / activeRow.pitia * 100).toFixed(1) + '%', background: color }}
                      className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-300" />
                  ))}
                </div>
                <div className="flex flex-wrap gap-3 mb-4">
                  {[
                    { color: '#2E6BA8', label: 'P&I' },
                    { color: '#f59e0b', label: 'Taxes' },
                    { color: '#10b981', label: 'Insurance' },
                    ...(monthlyHoa > 0 ? [{ color: '#8b5cf6', label: 'HOA' }] : []),
                  ].map(({ color, label }) => (
                    <div key={label} className="flex items-center gap-1.5 text-[11px] text-gray-500">
                      <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                      {label}
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  {[
                    { dot: '#2E6BA8', label: 'Principal & Interest', val: fmtD(activeRow.pi) + '/mo' },
                    { dot: '#f59e0b', label: 'Property Taxes', val: fmtD(monthlyTaxes) + '/mo' },
                    { dot: '#10b981', label: 'Insurance', val: fmtD(monthlyInsurance) + '/mo' },
                    ...(monthlyHoa > 0 ? [{ dot: '#8b5cf6', label: 'HOA', val: fmtD(monthlyHoa) + '/mo' }] : []),
                  ].map(({ dot, label, val }) => (
                    <div key={label} className="flex justify-between items-center py-2 border-b border-gray-50 text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <div className="w-2 h-2 rounded-full" style={{ background: dot }} />
                        {label}
                      </div>
                      <span className="font-semibold text-gray-900 tabular-nums">{val}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 bg-brand/5 border border-brand/10 rounded-xl px-4 py-3 flex justify-between items-center">
                  <div>
                    <div className="text-xs font-bold text-brand uppercase tracking-wider">Total Monthly (PITIA)</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      DSCR: <span className={`font-bold ${activeRow.dscr >= 1.30 ? 'text-green-600' : activeRow.dscr >= 1.00 ? 'text-amber-500' : 'text-red-500'}`}>
                        {activeRow.dscr.toFixed(2)}
                      </span>
                      {' '}({fmtD(monthlyRent)} rent ÷ {fmtD(activeRow.pitia)} PITIA)
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-brand tabular-nums">{fmtD(activeRow.pitia)}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-3">
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <div className="text-[10px] text-gray-400 font-medium">Annual</div>
                    <div className="text-sm font-bold text-gray-900 tabular-nums">{fmtD(activeRow.pitia * 12)}/yr</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-3 py-2">
                    <div className="text-[10px] text-gray-400 font-medium">Total interest (30 yr)</div>
                    <div className="text-sm font-bold text-gray-900 tabular-nums">{fmtD(activeRow.pi * 360 - loanAmount)}</div>
                  </div>
                </div>
              </div>

              {/* Trade-points slider — walk the eligible ladder */}
              {displayRows.length > 1 && (() => {
                const isCredit = activeRow.netDollar >= 0;
                const sliderPct = ((sliderIndex / (displayRows.length - 1)) * 100).toFixed(1);
                return (
                  <div className={cardCls}>
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <SectionLabel>Adjust Your Rate</SectionLabel>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-md tabular-nums ${isCredit ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                        {isCredit
                          ? fmtD(activeRow.netDollar) + ' rebate at closing'
                          : fmtD(Math.abs(activeRow.netDollar)) + ' to buy down'}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 mb-3">
                      Slide left for a higher rate with rebate at closing. Slide right to pay points up front for a lower rate.
                      {loading && <span className="ml-2 text-brand">· updating…</span>}
                    </p>
                    <input
                      type="range"
                      min={0}
                      max={displayRows.length - 1}
                      step={1}
                      value={sliderIndex}
                      onChange={e => setSliderIndex(+e.target.value)}
                      className="w-full h-1.5 rounded-full outline-none cursor-pointer appearance-none
                        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                        [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
                        [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-brand
                        [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer"
                      style={{ background: `linear-gradient(to right, #2E6BA8 0%, #2E6BA8 ${sliderPct}%, #e5e7eb ${sliderPct}%, #e5e7eb 100%)` }}
                    />
                    <div className="flex justify-between text-[11px] text-gray-400 mt-1">
                      <span>Higher rate · rebate</span>
                      {sliderIndex !== parIndex && (
                        <button
                          type="button"
                          onClick={() => setSliderIndex(parIndex)}
                          className="text-brand font-semibold hover:underline"
                        >
                          ★ Reset to par
                        </button>
                      )}
                      {sliderIndex === parIndex && <span className="text-green-600 font-semibold">★ At par</span>}
                      <span>Lower rate · pay points</span>
                    </div>
                  </div>
                );
              })()}

              {/* Talk to an MLO CTA */}
              <div className="bg-brand text-white rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[0_4px_24px_rgba(46,107,168,0.18)]">
                <div>
                  <div className="text-base font-bold">Ready to lock this in?</div>
                  <div className="text-white/80 text-xs mt-1">
                    Talk to a NetRate Mortgage MLO — wholesale pricing, no retail markup, fast prequals.
                  </div>
                </div>
                <a
                  href="/contact"
                  className="bg-accent text-ink rounded-lg px-4 py-2 text-sm font-bold hover:opacity-90 transition-opacity whitespace-nowrap"
                >
                  Get a personalized quote
                </a>
              </div>
            </>
          )}
        </div>

        {/* ── RIGHT: Gauge + Summary ── */}
        <div className="flex flex-col gap-4">

          {/* DSCR Gauge */}
          {activeRow && (
            <div className={cardCls + ' text-center'}>
              <DSCRGauge dscr={activeRow.dscr} />
              <div className="text-[11px] text-gray-400 mt-1 border-t border-gray-100 pt-2">
                <span className="font-semibold text-brand tabular-nums">{fmtD(monthlyRent)}</span>
                <span className="text-gray-300 mx-1">÷</span>
                <span className="font-semibold text-brand tabular-nums">{fmtD(activeRow.pitia)}</span>
              </div>
            </div>
          )}

          {/* Scenario chips */}
          <div className={cardCls}>
            <SectionLabel>Scenario</SectionLabel>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                ['LTV', ltv.toFixed(1) + '%'],
                ['DSCR', activeRow ? activeRow.dscr.toFixed(2) : '—'],
                ['FICO', fico],
                ['Units', units + '-unit'],
                ['State', state],
                ['Purpose', purpose === 'purchase' ? 'Purchase' : purpose === 'refinance' ? 'Refi' : 'Cash-Out'],
              ].map(([label, value]) => (
                <div key={label} className="bg-brand/10 border border-brand/10 rounded-lg px-2 py-1.5">
                  <div className="text-[9px] font-bold text-brand uppercase tracking-wider">{label}</div>
                  <div className="text-sm font-semibold text-gray-900 tabular-nums">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Eligibility check */}
          {activeRow && (
            <div className={cardCls}>
              <SectionLabel>Eligibility</SectionLabel>
              <ul className="space-y-2">
                {guidelines.map((g, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <span className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
                      g.pass ? 'bg-green-100 text-green-700' : g.warn ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'
                    }`}>
                      {g.pass ? '✓' : g.warn ? '!' : '✗'}
                    </span>
                    <span className="text-gray-600 leading-tight">{g.text}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-gray-400 mt-3">{sheetDate}</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
