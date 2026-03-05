'use client';

import { useScenario } from './ScenarioContext';
import { ASL_PRICING, MH_FIXED_RATES } from '@/lib/hecm/rate-sheet';

const PRODUCT_OPTIONS = [
  { value: 'cmtMonthlyCap5', label: 'Monthly CMT Cap 5' },
  { value: 'cmtMonthlyCap10', label: 'Monthly CMT Cap 10' },
  { value: 'fixed', label: 'Fixed Rate' },
];

const MARGIN_OPTIONS = Object.keys(ASL_PRICING)
  .map(k => parseFloat(k))
  .sort((a, b) => b - a)
  .map(m => ({ value: m, label: m.toFixed(3) + '%' }));

const FIXED_RATE_OPTIONS = MH_FIXED_RATES.map(fr => ({
  value: fr.rate,
  label: fr.rate.toFixed(3) + '% (' + fr.mhFee + ')',
}));

const fmt = (n, dec = 0) => {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
};

const fmtDollar = (n) => {
  if (n === null || n === undefined) return '—';
  return '$' + fmt(n, 2);
};

const fmtPct = (n, dec = 3) => {
  if (n === null || n === undefined) return '—';
  return n.toFixed(dec) + '%';
};

function ColumnHeader({ index, label }) {
  const { state, setProductType, setMargin, setFixedRate } = useScenario();
  const isFixed = state.productTypes[index] === 'fixed';

  return (
    <th className="px-2 py-2 text-left bg-cyan-50 border-b border-cyan-200 min-w-[200px]">
      <div className="text-xs font-semibold text-cyan-800 mb-1">Option {label}</div>
      <select
        value={state.productTypes[index]}
        onChange={(e) => setProductType(index, e.target.value)}
        className="w-full text-xs px-1 py-1 border border-gray-300 rounded mb-1"
      >
        {PRODUCT_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {isFixed ? (
        <select
          value={state.fixedRates[index]}
          onChange={(e) => setFixedRate(index, parseFloat(e.target.value))}
          className="w-full text-xs px-1 py-1 border border-gray-300 rounded"
        >
          <option value={0}>Select rate...</option>
          {FIXED_RATE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ) : (
        <select
          value={state.margins[index]}
          onChange={(e) => setMargin(index, parseFloat(e.target.value))}
          className="w-full text-xs px-1 py-1 border border-gray-300 rounded"
        >
          {MARGIN_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
    </th>
  );
}

function Row({ label, values, format = 'dollar', className = '', highlight = false }) {
  const formatter = format === 'pct' ? fmtPct : format === 'number' ? fmt : fmtDollar;

  return (
    <tr className={`${highlight ? 'bg-cyan-50 font-medium' : ''} ${className}`}>
      <td className="px-2 py-1 text-xs text-gray-600 border-r border-gray-100">{label}</td>
      {values.map((v, i) => (
        <td key={i} className={`px-2 py-1 text-xs text-right font-mono ${
          v !== null && v !== undefined && v < 0 ? 'text-red-600' : ''
        }`}>
          {formatter(v)}
        </td>
      ))}
    </tr>
  );
}

function SectionHeader({ label }) {
  return (
    <tr>
      <td colSpan={4} className="px-2 py-1.5 text-xs font-bold text-gray-700 bg-gray-50 border-y border-gray-200">
        {label}
      </td>
    </tr>
  );
}

export default function ScenarioTable() {
  const { results, state } = useScenario();
  const r = results; // [R0, R1, R2]

  const get = (field) => r.map(s => s ? s[field] : null);

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr>
            <th className="px-2 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-200 min-w-[160px]">
              Scenario Comparison
            </th>
            <ColumnHeader index={0} label="A" />
            <ColumnHeader index={1} label="B" />
            <ColumnHeader index={2} label="C" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {/* Rate Structure */}
          <SectionHeader label="Rate Structure" />
          <Row label="Margin" values={get('margin')} format="pct" />
          <Row label="Note Rate (Initial)" values={get('noteRate')} format="pct" />
          <Row label="Expected Rate" values={get('expectedRate')} format="pct" />
          <Row label="Effective Rate (w/ MIP)" values={get('effectiveRate')} format="pct" />
          <Row label="Lifetime Cap" values={get('lifetimeCap')} format="pct" />

          {/* Principal Limit */}
          <SectionHeader label="Principal Limit Calculation" />
          <Row label="Max Claim Amount" values={get('mca')} />
          <Row label="PLF" values={get('plf')} format="pct" className="" />
          <Row label="Principal Limit" values={get('principalLimit')} highlight />

          {/* Costs */}
          <SectionHeader label="Costs" />
          <Row label="UFMIP (2%)" values={get('ufmip')} />
          <Row label="Origination Fee" values={get('origFee')} />
          <Row label="Third Party Costs" values={get('thirdPartyCosts')} />
          <Row label="Lender Credit" values={get('lenderCredit')} />
          <Row label="Total Costs" values={get('totalCosts')} />

          {/* Net Proceeds */}
          <SectionHeader label="Net Proceeds" />
          <Row label="Net Principal Limit" values={get('netPL')} />
          <Row label="Existing Liens" values={r.map(() => state.existingLiens > 0 ? -state.existingLiens : null)} />
          <Row label="Cash to Borrower" values={get('cashToBorrower')} highlight />

          {/* LOC (ARM only) */}
          <SectionHeader label="Line of Credit" />
          <Row label="Mandatory Obligations" values={get('mandatoryObligations')} />
          <Row label="Initial Draw Limit" values={get('initialDrawLimit')} />
          <Row label="LOC Year 1" values={get('locYear1')} />
          <Row label="LOC After Year 1" values={get('locAfterYear1')} />

          {/* LOC Growth */}
          <SectionHeader label="LOC Growth Projections" />
          <Row label="Growth Rate" values={get('locGrowthRate')} format="pct" />
          <Row label="5-Year LOC" values={get('locProj5')} />
          <Row label="10-Year LOC" values={get('locProj10')} />
          <Row label="15-Year LOC" values={get('locProj15')} />
          <Row label="20-Year LOC" values={get('locProj20')} />

          {/* Broker Comp (hidden on print) */}
          <tr className="print:hidden">
            <td colSpan={4} className="px-2 py-1.5 text-xs font-bold text-gray-700 bg-gray-50 border-y border-gray-200">
              Broker Compensation
            </td>
          </tr>
          <tr className="print:hidden">
            <td className="px-2 py-1 text-xs text-gray-600 border-r border-gray-100">UPB</td>
            {get('upb').map((v, i) => (
              <td key={i} className="px-2 py-1 text-xs text-right font-mono">{fmtDollar(v)}</td>
            ))}
          </tr>
          <tr className="print:hidden">
            <td className="px-2 py-1 text-xs text-gray-600 border-r border-gray-100">PLU%</td>
            {get('pluPct').map((v, i) => (
              <td key={i} className="px-2 py-1 text-xs text-right font-mono">{v != null ? fmtPct(v, 1) : '—'}</td>
            ))}
          </tr>
          <tr className="print:hidden">
            <td className="px-2 py-1 text-xs text-gray-600 border-r border-gray-100">ASL Price (Raw)</td>
            {get('aslPriceRaw').map((v, i) => (
              <td key={i} className="px-2 py-1 text-xs text-right font-mono">{v != null ? fmt(v, 3) : '—'}</td>
            ))}
          </tr>
          <tr className="print:hidden">
            <td className="px-2 py-1 text-xs text-gray-600 border-r border-gray-100">LLPA Adj</td>
            {get('llpaAdj').map((v, i) => (
              <td key={i} className="px-2 py-1 text-xs text-right font-mono">{v != null ? fmt(v, 3) : '—'}</td>
            ))}
          </tr>
          <tr className="print:hidden">
            <td className="px-2 py-1 text-xs text-gray-600 border-r border-gray-100">ASL Price (Adj)</td>
            {get('aslPrice').map((v, i) => (
              <td key={i} className="px-2 py-1 text-xs text-right font-mono">{v != null ? fmt(v, 3) : '—'}</td>
            ))}
          </tr>
          <tr className="print:hidden">
            <td className="px-2 py-1 text-xs text-gray-600 border-r border-gray-100">YSP (bps)</td>
            {get('yspBps').map((v, i) => (
              <td key={i} className="px-2 py-1 text-xs text-right font-mono">{v != null ? fmt(v, 3) : '—'}</td>
            ))}
          </tr>
          <tr className="print:hidden bg-cyan-50 font-medium">
            <td className="px-2 py-1 text-xs text-gray-600 border-r border-gray-100">YSP $</td>
            {get('yspDollar').map((v, i) => (
              <td key={i} className="px-2 py-1 text-xs text-right font-mono">{fmtDollar(v)}</td>
            ))}
          </tr>
          <tr className="print:hidden bg-cyan-50 font-medium">
            <td className="px-2 py-1 text-xs text-gray-600 border-r border-gray-100">Total Comp</td>
            {get('totalComp').map((v, i) => (
              <td key={i} className="px-2 py-1 text-xs text-right font-mono font-semibold">{fmtDollar(v)}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
