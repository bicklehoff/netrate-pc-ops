'use client';

import { useState, useEffect } from 'react';

// ── Rate data: Everstream DSCR Core 7/6 ARM, 30-day lock, April 6 2026 ──
const RATES = [
  { rate: 5.500, base: 94.2360 },
  { rate: 5.625, base: 94.9860 },
  { rate: 5.750, base: 95.7360 },
  { rate: 5.875, base: 96.4860 },
  { rate: 6.000, base: 97.2360 },
  { rate: 6.125, base: 97.9230 },
  { rate: 6.250, base: 98.6110 },
  { rate: 6.375, base: 99.2990 },
  { rate: 6.500, base: 99.9240 },
  { rate: 6.625, base: 100.5490 },
  { rate: 6.750, base: 101.1110 },
  { rate: 6.875, base: 101.6740 },
  { rate: 7.000, base: 102.1740 },
  { rate: 7.125, base: 102.6740 },
  { rate: 7.250, base: 103.1110 },
  { rate: 7.375, base: 103.5490 },
  { rate: 7.500, base: 103.9240 },
  { rate: 7.625, base: 104.2990 },
  { rate: 7.750, base: 104.6110 },
  { rate: 7.875, base: 104.9240 },
  { rate: 8.000, base: 105.2360 },
];

// DSCR 1 Global LLPAs — 2-unit by LTV band [≤50,50-55,55-60,60-65,65-70,70-75,75-80]
const TWO_UNIT_LLPA = [-0.5, -0.5, -0.75, -1.0, -1.25, -1.5, -2.0];
const LTV_BANDS = [50, 55, 60, 65, 70, 75, 80];
const DSCR_RATIO_ADJ = [
  { min: 1.00, max: 1.15, adj: [0, 0, -0.25, -0.25, -0.25, -0.5, -0.75] },
  { min: 1.15, max: 1.30, adj: [0, 0, 0, 0, 0, 0, 0] },
  { min: 1.30, max: 99,   adj: [0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25] },
];
const COMP_RATE = 0.02;
const COMP_CAP_PURCHASE = 4595;
const COMP_CAP_REFI = 3595;
const SHEET_DATE = 'April 6, 2026';

function getLtvBandIdx(ltv) {
  for (let i = 0; i < LTV_BANDS.length; i++) if (ltv <= LTV_BANDS[i]) return i;
  return LTV_BANDS.length - 1;
}
function calcPI(loan, annualRate) {
  const r = annualRate / 100 / 12;
  return loan * (r * Math.pow(1 + r, 360)) / (Math.pow(1 + r, 360) - 1);
}
function fmtD(n) { return '$' + Math.round(n).toLocaleString(); }
function fmtPts(n) { return (n >= 0 ? '+' : '') + n.toFixed(3) + ' pts'; }

// ── Design system classes ──
const labelCls = 'block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1';
const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:border-brand focus:ring-2 focus:ring-brand/10 outline-none transition-colors tabular-nums';
const cardCls = 'bg-white rounded-2xl border border-gray-100 shadow-[0_4px_24px_rgba(2,76,79,0.06)] p-5';
const tightCardCls = 'bg-white rounded-xl border border-gray-100 shadow-[0_2px_12px_rgba(2,76,79,0.05)] p-4';

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

  // Threshold ticks only — no labels on the arc
  const ticks = [0.25, 0.50, 0.55];

  return (
    <svg viewBox="0 0 200 108" className="w-full max-w-[300px] mx-auto">
      {/* Background track */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="#e5e7eb" strokeWidth="16" strokeLinecap="round"
      />
      {/* Colored fill */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke={color} strokeWidth="16" strokeLinecap="round"
        strokeDasharray={`${fillLen} ${arcLen}`}
        style={{ transition: 'stroke-dasharray 0.4s ease, stroke 0.3s ease' }}
      />
      {/* Threshold ticks — subtle, no labels */}
      {ticks.map(f => {
        const inner = arcPoint(f, r - 9);
        const outer = arcPoint(f, r + 1);
        return (
          <line key={f} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
            stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" />
        );
      })}
      {/* DSCR number — the only number */}
      <text x={cx} y={cy - 20} textAnchor="middle" fontSize="40" fontWeight="700"
        fill={color} fontFamily="Inter,sans-serif" style={{ transition: 'fill 0.3s ease' }}>
        {dscr.toFixed(2)}
      </text>
      {/* Label */}
      <text x={cx} y={cy + 2} textAnchor="middle" fontSize="10" fontWeight="600"
        fill="#9ca3af" fontFamily="Inter,sans-serif" letterSpacing="2">DSCR</text>
      {/* Status */}
      <text x={cx} y={cy + 18} textAnchor="middle" fontSize="11" fontWeight="600"
        fill={color} fontFamily="Inter,sans-serif" style={{ transition: 'fill 0.3s ease' }}>{status}</text>
    </svg>
  );
}

export default function DSCRCalculator() {
  const [purchasePrice, setPurchasePrice] = useState(380000);
  const [downPayment, setDownPayment] = useState(130000);
  const [fico, setFico] = useState(760);
  const [units, setUnits] = useState(2);
  const [state, setState] = useState('CO');
  const [purpose, setPurpose] = useState('purchase');
  const [monthlyRent, setMonthlyRent] = useState(3000);
  const [monthlyTaxes, setMonthlyTaxes] = useState(350);
  const [monthlyInsurance, setMonthlyInsurance] = useState(150);
  const [monthlyHoa, setMonthlyHoa] = useState(0);
  const [selectedRate, setSelectedRate] = useState(null);

  const loanAmount = purchasePrice - downPayment;
  const ltv = purchasePrice > 0 ? (loanAmount / purchasePrice) * 100 : 0;
  const ltvBandIdx = getLtvBandIdx(ltv);
  const compCap = purpose === 'purchase' ? COMP_CAP_PURCHASE : COMP_CAP_REFI;
  const compDollar = Math.min(loanAmount * COMP_RATE, compCap);
  const compPts = loanAmount > 0 ? (compDollar / loanAmount) * 100 : 0;
  const monthlyEscrow = monthlyTaxes + monthlyInsurance;

  const twoUnitAdj = units > 1 ? TWO_UNIT_LLPA[ltvBandIdx] : 0;

  const rows = RATES.map(({ rate, base }) => {
    const pi = calcPI(loanAmount, rate);
    const pitia = pi + monthlyEscrow + monthlyHoa;
    const dscr = pitia > 0 ? monthlyRent / pitia : 0;
    let dscrRatioAdj = 0;
    for (const tier of DSCR_RATIO_ADJ) {
      if (dscr >= tier.min && dscr < tier.max) { dscrRatioAdj = tier.adj[ltvBandIdx]; break; }
    }
    if (dscr >= 1.30) dscrRatioAdj = DSCR_RATIO_ADJ[2].adj[ltvBandIdx];
    const adjPrice = base + twoUnitAdj + dscrRatioAdj;
    const netPrice = adjPrice - compPts;
    const netDollar = (netPrice - 100) / 100 * loanAmount;
    return { rate, base, pi, pitia, dscr, twoUnitAdj, dscrRatioAdj, adjPrice, netPrice, netDollar };
  });

  // Find par
  const parRow = rows.reduce((best, r) => Math.abs(r.netPrice - 100) < Math.abs(best.netPrice - 100) ? r : best, rows[0]);
  const displayRows = rows.filter(r => Math.abs(r.netPrice - 100) < 3.0);

  // Auto-select par on first load / when scenario changes
  useEffect(() => {
    setSelectedRate(parRow.rate);
  }, [loanAmount, units, purpose, monthlyRent, monthlyTaxes, monthlyInsurance, monthlyHoa]);

  const activeRow = rows.find(r => r.rate === selectedRate) || parRow;

  // Slider bounds
  const dpMin = Math.round(purchasePrice * 0.20 / 1000) * 1000;
  const dpMax = Math.round(purchasePrice * 0.50 / 1000) * 1000;
  const dpPct = dpMax > dpMin ? ((downPayment - dpMin) / (dpMax - dpMin) * 100).toFixed(1) : 0;

  // Guidelines
  const guidelines = [
    { pass: ltv <= 75, warn: ltv <= 80, text: `LTV ${ltv.toFixed(1)}% — max 75% for 2–4 unit (standard) · max 80% with adjustment` },
    { pass: activeRow.dscr >= 1.25, warn: activeRow.dscr >= 1.00, text: `DSCR ${activeRow.dscr.toFixed(2)} — min 1.00 required · 1.25+ preferred` },
    { pass: fico >= 700, warn: fico >= 660, text: `FICO ${fico} — min 660 for most LTV bands` },
    { pass: activeRow.dscr >= 1.30, warn: false, text: activeRow.dscr >= 1.30 ? `DSCR > 1.30 — earns +0.25 pt credit` : `DSCR below 1.30 — no ratio bonus (need > 1.30 for +0.25 credit)` },
    { pass: units <= 4, warn: units > 1, text: `${units}-unit — LLPA applies on 2–4 unit properties` },
    { pass: false, warn: true, text: 'Verify 12 months PITIA reserves required for 2–4 unit DSCR' },
  ];

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      {/* Header */}
      <div className="bg-brand border-b border-brand-dark">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <span className="text-white font-bold text-base">DSCR Loan Calculator</span>
          <span className="bg-accent text-ink text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Investor</span>
          <span className="ml-auto text-white/60 text-xs hidden sm:block">Everstream · Core 7/6 ARM · {SHEET_DATE}</span>
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
                  background: `linear-gradient(to right, #0071CE 0%, #0071CE ${dpPct}%, #e5e7eb ${dpPct}%, #e5e7eb 100%)`
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
            <div className="grid grid-cols-2 gap-2">
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

          {/* Payment breakdown */}
          <div className={cardCls}>
            <SectionLabel>Monthly Payment — {activeRow.rate.toFixed(3)}%</SectionLabel>

            {/* Stacked bar */}
            <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5 mb-2">
              {[
                { val: activeRow.pi, color: '#0071CE' },
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
                { color: '#0071CE', label: 'P&I' },
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
                { dot: '#0071CE', label: 'Principal & Interest', val: fmtD(activeRow.pi) + '/mo' },
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

          {/* Rate table */}
          <div className={cardCls}>
            <SectionLabel>Rate Options · DSCR Core 7/6 ARM · 30-Day Lock</SectionLabel>
            <p className="text-[11px] text-gray-400 mb-3">Click any row to update the payment breakdown and DSCR gauge.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-100">
                    {['Rate', 'Monthly P&I', 'PITIA', 'DSCR', 'Points / Credit', 'Net Cost'].map(h => (
                      <th key={h} className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider py-2 px-2 first:pl-0">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    let shown125 = false, shown100 = false;
                    return displayRows.map((row) => {
                      const markers = [];

                      if (!shown125 && row.dscr < 1.25) {
                        shown125 = true;
                        markers.push(
                          <tr key="dscr125-marker">
                            <td colSpan={6} className="bg-amber-50 text-amber-700 text-[11px] font-semibold px-2 py-1.5 border-y border-amber-200">
                              ▲ DSCR 1.25 — rates above qualify for most programs
                            </td>
                          </tr>
                        );
                      }
                      if (!shown100 && row.dscr < 1.00) {
                        shown100 = true;
                        markers.push(
                          <tr key="dscr100-marker">
                            <td colSpan={6} className="bg-red-50 text-red-600 text-[11px] font-semibold px-2 py-1.5 border-y border-red-200">
                              ▲ DSCR 1.00 minimum — rates above this line are ineligible
                            </td>
                          </tr>
                        );
                      }

                      const isPar = row.rate === parRow.rate;
                      const isSelected = row.rate === selectedRate;
                      const ptsDiff = row.netPrice - 100;
                      const isCredit = ptsDiff >= 0;

                      return [
                        ...markers,
                        <tr key={row.rate}
                          onClick={() => setSelectedRate(row.rate)}
                          className={`cursor-pointer transition-colors border-b border-gray-50 ${
                            isSelected ? 'bg-brand/5' : isPar ? 'bg-green-50/50' : 'hover:bg-gray-50'
                          }`}>
                          <td className="py-2.5 px-2 pl-0">
                            <span className="font-bold text-gray-900 tabular-nums">{row.rate.toFixed(3)}%</span>
                            {isPar && <span className="ml-1 text-green-600 text-[10px] font-bold">★ par</span>}
                          </td>
                          <td className="py-2.5 px-2 tabular-nums text-gray-700">{fmtD(row.pi)}/mo</td>
                          <td className="py-2.5 px-2 tabular-nums text-gray-700">{fmtD(row.pitia)}/mo</td>
                          <td className="py-2.5 px-2">
                            <span className={`font-bold tabular-nums ${row.dscr >= 1.30 ? 'text-green-600' : row.dscr >= 1.00 ? 'text-amber-500' : 'text-red-500'}`}>
                              {row.dscr.toFixed(2)}
                            </span>
                          </td>
                          <td className="py-2.5 px-2">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-md tabular-nums ${
                              isCredit ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                            }`}>
                              {fmtPts(ptsDiff)}
                            </span>
                          </td>
                          <td className="py-2.5 px-2">
                            <span className={`font-semibold tabular-nums text-sm ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                              {isCredit ? fmtD(row.netDollar) + ' rebate' : fmtD(Math.abs(row.netDollar)) + ' cost'}
                            </span>
                          </td>
                        </tr>
                      ];
                    });
                  })()}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-gray-400 mt-3">★ = closest to par after comp and adjustments. Click any row to update payment breakdown. Rebate = credit toward closing costs.</p>
          </div>

          {/* Pricing math */}
          <div className={cardCls}>
            <SectionLabel>Pricing Math — {activeRow.rate.toFixed(3)}%</SectionLabel>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Base price (rate sheet)', val: activeRow.base.toFixed(4), color: 'text-gray-700' },
                { label: `2-unit LLPA (${ltv.toFixed(0)}% LTV)`, val: fmtPts(activeRow.twoUnitAdj), color: 'text-red-500' },
                { label: `DSCR ratio adj (${activeRow.dscr.toFixed(2)})`, val: fmtPts(activeRow.dscrRatioAdj), color: activeRow.dscrRatioAdj >= 0 ? 'text-green-600' : 'text-red-500' },
                { label: 'Price after adjustments', val: activeRow.adjPrice.toFixed(4), color: 'text-gray-900 font-semibold' },
                { label: `Broker comp (${fmtD(compDollar)} / ${fmtD(loanAmount)} loan)`, val: '−' + compPts.toFixed(3) + ' pts', color: 'text-red-500' },
              ].map(({ label, val, color }) => (
                <div key={label} className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-gray-500">{label}</span>
                  <span className={`tabular-nums font-medium ${color}`}>{val}</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2">
                <span className="font-bold text-gray-900">Net price → {activeRow.netDollar >= 0 ? 'Rebate to borrower' : 'Discount (borrower pays)'}</span>
                <span className={`font-bold tabular-nums text-base ${activeRow.netDollar >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {activeRow.netPrice.toFixed(4)} → {activeRow.netDollar >= 0 ? fmtD(activeRow.netDollar) : fmtD(Math.abs(activeRow.netDollar))}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 mt-3">Comp: 2% capped at {fmtD(compCap)} ({purpose}). Net price = base + adj − comp.</p>
          </div>

          {/* Adjustments */}
          <div className={tightCardCls}>
            <SectionLabel>Price Adjustments Applied</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: `2-Unit LLPA (${ltv.toFixed(0)}% LTV)`, val: fmtPts(activeRow.twoUnitAdj), neg: true },
                { label: `DSCR Ratio (${activeRow.dscr.toFixed(2)} > 1.30)`, val: fmtPts(activeRow.dscrRatioAdj), neg: activeRow.dscrRatioAdj < 0 },
                { label: `State Adj (${state})`, val: '+0.000 pts', neg: false },
                { label: `Broker Comp (${purpose} cap)`, val: `−${compPts.toFixed(3)} pts (${fmtD(compDollar)})`, neg: true },
              ].map(({ label, val, neg }) => (
                <div key={label} className="bg-gray-50 rounded-lg p-3">
                  <div className="text-[11px] text-gray-500 font-medium">{label}</div>
                  <div className={`text-sm font-bold mt-0.5 tabular-nums ${neg ? 'text-red-500' : 'text-green-600'}`}>{val}</div>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-3">Everstream DSCR 1 LLPA sheet · {SHEET_DATE}</p>
          </div>

        </div>

        {/* ── RIGHT: Gauge + Summary ── */}
        <div className="flex flex-col gap-4">

          {/* DSCR Gauge — compact */}
          <div className={cardCls + ' text-center'}>
            <DSCRGauge dscr={activeRow.dscr} />
            <div className="text-[11px] text-gray-400 mt-1 border-t border-gray-100 pt-2">
              <span className="font-semibold text-brand tabular-nums">{fmtD(monthlyRent)}</span>
              <span className="text-gray-300 mx-1">÷</span>
              <span className="font-semibold text-brand tabular-nums">{fmtD(activeRow.pitia)}</span>
            </div>
          </div>

          {/* Scenario chips */}
          <div className={cardCls}>
            <SectionLabel>Scenario</SectionLabel>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                ['LTV', ltv.toFixed(1) + '%'],
                ['DSCR', activeRow.dscr.toFixed(2)],
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
            <p className="text-[11px] text-gray-400 mt-3">{SHEET_DATE}</p>
          </div>

        </div>
      </div>
    </div>
  );
}
