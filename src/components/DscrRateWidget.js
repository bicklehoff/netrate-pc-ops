'use client';

/**
 * Compact DSCR rate widget for /rates/dscr.
 *
 * Shows a live rate ladder (Elite 1) for a quick scenario. Deep customization
 * lives in /tools/dscr-calculator — this is the "give me a number fast" view.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

const STATES = ['CO', 'CA', 'TX', 'OR'];
const TIERS = [
  { value: 'elite_1', label: 'Elite 1' },
  { value: 'elite_2', label: 'Elite 2' },
  { value: 'elite_5', label: 'Elite 5' },
];

const fmtUsd = (n) => '$' + Math.round(n).toLocaleString();
const fmtPts = (n) => (n >= 0 ? '+' : '') + n.toFixed(3);

export default function DscrRateWidget() {
  const [loanSize, setLoanSize] = useState(320000);
  const [propertyValue, setPropertyValue] = useState(400000);
  const [fico, setFico] = useState(760);
  const [monthlyRent, setMonthlyRent] = useState(3000);
  const [monthlyEscrow, setMonthlyEscrow] = useState(500);
  const [monthlyHoa, setMonthlyHoa] = useState(0);
  const [state, setState] = useState('CO');
  const [purpose, setPurpose] = useState('purchase');
  const [propertyType, setPropertyType] = useState('sfr');
  const [tier, setTier] = useState('elite_1');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const cltv = propertyValue > 0 ? (loanSize / propertyValue) * 100 : 0;

  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      if (!loanSize || !propertyValue || cltv > 80) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/pricing/dscr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: ctrl.signal,
          body: JSON.stringify({
            product_type: 'arm',
            term: 30,
            arm_fixed_period: 7,
            lock_days: 30,
            fico: Number(fico),
            cltv: Math.round(cltv * 100) / 100,
            state,
            occupancy: 'investment',
            loan_purpose: purpose === 'purchase' ? 'purchase' : purpose === 'cashout' ? 'cashout' : 'rate_term',
            property_type: propertyType,
            loan_size: Number(loanSize),
            prepay_years: 5,
            prepay_structure: 'fixed_5',
            dscr_inputs: {
              monthly_rent: Number(monthlyRent),
              monthly_escrow: Number(monthlyEscrow),
              monthly_hoa: Number(monthlyHoa),
              loan_amount: Number(loanSize),
            },
            tier_filter: [tier],
          }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json);
      } catch (e) {
        if (e.name !== 'AbortError') setError(e.message);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [loanSize, propertyValue, fico, monthlyRent, monthlyEscrow, monthlyHoa, state, purpose, propertyType, tier, cltv]);

  const priced = data?.priced || [];
  // Show a narrow band around par
  const band = priced
    .map(r => ({ ...r, ptsDiff: r.final_price - 100 }))
    .filter(r => Math.abs(r.ptsDiff) < 3.0);
  const parRow = band.reduce((best, r) =>
    !best || Math.abs(r.ptsDiff) < Math.abs(best.ptsDiff) ? r : best, null);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-8">
      <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-xl font-bold text-gray-900">Live DSCR rates</h2>
        <span className="text-xs text-gray-500">
          {data?.meta?.effective_at
            ? `Everstream · ${new Date(data.meta.effective_at).toLocaleDateString()}`
            : 'Everstream · 7/6 ARM · 30-day lock'}
        </span>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Field label="Property Value">
          <MoneyInput value={propertyValue} onChange={setPropertyValue} step={5000} />
        </Field>
        <Field label="Loan Amount">
          <MoneyInput value={loanSize} onChange={setLoanSize} step={5000} />
        </Field>
        <Field label={`LTV ${cltv.toFixed(1)}%`} hint={cltv > 80 ? 'Max 80%' : null}>
          <div className="h-9 flex items-center rounded-lg bg-gray-50 px-3 text-sm tabular-nums text-gray-700">
            {cltv.toFixed(1)}%
          </div>
        </Field>
        <Field label="FICO">
          <input type="number" min={620} max={850} value={fico}
            onChange={e => setFico(+e.target.value || 0)}
            className="w-full h-9 rounded-lg border border-gray-200 px-3 text-sm tabular-nums focus:border-brand focus:ring-2 focus:ring-brand/10 outline-none" />
        </Field>
        <Field label="Monthly Rent">
          <MoneyInput value={monthlyRent} onChange={setMonthlyRent} step={50} />
        </Field>
        <Field label="Taxes + Ins (mo)">
          <MoneyInput value={monthlyEscrow} onChange={setMonthlyEscrow} step={25} />
        </Field>
        <Field label="HOA (mo)">
          <MoneyInput value={monthlyHoa} onChange={setMonthlyHoa} step={25} />
        </Field>
        <Field label="State">
          <select value={state} onChange={e => setState(e.target.value)} className={selectCls}>
            {STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Purpose">
          <select value={purpose} onChange={e => setPurpose(e.target.value)} className={selectCls}>
            <option value="purchase">Purchase</option>
            <option value="refinance">Refinance (no cash-out)</option>
            <option value="cashout">Cash-Out</option>
          </select>
        </Field>
        <Field label="Property Type">
          <select value={propertyType} onChange={e => setPropertyType(e.target.value)} className={selectCls}>
            <option value="sfr">SFR</option>
            <option value="pud">PUD</option>
            <option value="condo">Condo</option>
            <option value="townhome">Townhome</option>
            <option value="2unit">2-unit</option>
            <option value="3unit">3-unit</option>
            <option value="4unit">4-unit</option>
          </select>
        </Field>
        <Field label="Elite Tier">
          <select value={tier} onChange={e => setTier(e.target.value)} className={selectCls}>
            {TIERS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
      </div>

      {/* Results */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          Rate fetch failed: {error}. Try again in a moment.
        </div>
      )}

      {cltv > 80 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          LTV over 80% — DSCR programs cap at 80% LTV. Adjust down payment.
        </div>
      )}

      {!error && cltv <= 80 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                {['Rate', 'P&I', 'PITIA', 'DSCR', 'Price', 'vs Par'].map(h => (
                  <th key={h} className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider py-2 pr-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {band.length === 0 && !loading && (
                <tr><td colSpan={6} className="py-6 text-center text-gray-400 text-sm">
                  No rates available for this scenario. Try a different tier or adjust inputs.
                </td></tr>
              )}
              {band.map(r => {
                const isPar = parRow && r.note_rate === parRow.note_rate;
                const isCredit = r.ptsDiff >= 0;
                return (
                  <tr key={r.note_rate} className={`border-b border-gray-50 ${isPar ? 'bg-green-50/40' : ''}`}>
                    <td className="py-2 pr-3">
                      <span className="font-bold text-gray-900 tabular-nums">{r.note_rate.toFixed(3)}%</span>
                      {isPar && <span className="ml-1 text-green-600 text-[10px] font-bold">★ par</span>}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-gray-700">{fmtUsd(r.pi || 0)}</td>
                    <td className="py-2 pr-3 tabular-nums text-gray-700">{fmtUsd(r.pitia || 0)}</td>
                    <td className="py-2 pr-3">
                      <span className={`font-bold tabular-nums ${r.dscr >= 1.30 ? 'text-green-600' : r.dscr >= 1.00 ? 'text-amber-500' : 'text-red-500'}`}>
                        {(r.dscr || 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-gray-700">{r.final_price.toFixed(4)}</td>
                    <td className="py-2 pr-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-md tabular-nums ${isCredit ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                        {fmtPts(r.ptsDiff)} pts
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between flex-wrap gap-2">
        <p className="text-[11px] text-gray-400">
          Price is lender price before broker compensation. Deal-specific pricing lives in the full calculator.
        </p>
        <Link href="/tools/dscr-calculator" className="text-sm text-brand hover:underline font-medium">
          Full DSCR calculator →
        </Link>
      </div>
    </div>
  );
}

// ── Small input helpers ─────────────────────────────────────────────────

const selectCls = 'w-full h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/10 outline-none';

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
        {label}
        {hint && <span className="ml-1 normal-case font-normal text-red-500 tracking-normal">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function MoneyInput({ value, onChange, step }) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
      <input
        type="number"
        value={value}
        onChange={e => onChange(+e.target.value || 0)}
        step={step}
        className="w-full h-9 rounded-lg border border-gray-200 pl-6 pr-3 text-sm tabular-nums focus:border-brand focus:ring-2 focus:ring-brand/10 outline-none"
      />
    </div>
  );
}
