'use client';

import { useScenario } from './ScenarioContext';

const fmtDollar = (n) => {
  if (n === null || n === undefined) return '—';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtPct = (n, dec = 3) => {
  if (n === null || n === undefined) return '—';
  return n.toFixed(dec) + '%';
};

function CoverPage() {
  const { state, age } = useScenario();

  return (
    <div className="print-page mb-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-cyan-700">NetRate Mortgage LLC</h1>
        <p className="text-sm text-gray-500">NMLS #1111861</p>
        <p className="text-xs text-gray-400 mt-1">357 South McCaslin Blvd., #200, Louisville, CO 80027 | 303-444-5251</p>
      </div>

      <div className="border-t-2 border-cyan-600 pt-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">HECM Reverse Mortgage Analysis</h2>
        <p className="text-sm text-gray-600 mb-1">Prepared for: <strong>{state.borrower_name || 'Borrower'}</strong></p>
        {state.co_borrower_name && (
          <p className="text-sm text-gray-600 mb-1">Co-Borrower: <strong>{state.co_borrower_name}</strong></p>
        )}
        <p className="text-sm text-gray-600 mb-1">Date: <strong>{state.todayDate || new Date().toLocaleDateString()}</strong></p>
        {state.reference_number && (
          <p className="text-sm text-gray-600 mb-1">Reference: <strong>{state.reference_number}</strong></p>
        )}
      </div>

      {/* Property Summary */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Property & Borrower Summary</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-gray-500">Address:</span> {state.address}{state.city ? `, ${state.city}` : ''}{state.state ? `, ${state.state}` : ''} {state.zip}</div>
          <div><span className="text-gray-500">Home Value:</span> {fmtDollar(state.home_value)}</div>
          <div><span className="text-gray-500">Age (youngest):</span> {age || '—'}</div>
          <div><span className="text-gray-500">Existing Liens:</span> {fmtDollar(state.existingLiens)}</div>
        </div>
      </div>

      {/* Trust indicators */}
      <div className="mt-8 text-xs text-gray-500 space-y-2">
        <p>This analysis is for informational purposes only and does not constitute a loan commitment or guarantee. Actual rates, fees, and proceeds may vary based on current market conditions at the time of application.</p>
        <p>A Home Equity Conversion Mortgage (HECM) is a Federal Housing Administration (FHA) insured reverse mortgage. Borrowers must be at least 62 years of age and meet HUD counseling requirements.</p>
        <p>David Burson, NMLS #641790 | NetRate Mortgage LLC, NMLS #1111861</p>
      </div>
    </div>
  );
}

function PrintScenarioTable() {
  const { results, state } = useScenario();
  const r = results;

  const get = (field) => r.map(s => s ? s[field] : null);
  const labels = ['A', 'B', 'C'];

  const rows = [
    { section: 'Rate Structure' },
    { label: 'Product Type', values: state.productTypes.map(p => p === 'fixed' ? 'Fixed' : p === 'cmtMonthlyCap5' ? 'CMT Cap 5' : 'CMT Cap 10') },
    { label: 'Margin', values: get('margin'), fmt: 'pct' },
    { label: 'Note Rate', values: get('noteRate'), fmt: 'pct' },
    { label: 'Expected Rate', values: get('expectedRate'), fmt: 'pct' },
    { label: 'Effective Rate', values: get('effectiveRate'), fmt: 'pct' },
    { section: 'Principal Limit' },
    { label: 'Max Claim Amount', values: get('mca') },
    { label: 'PLF', values: get('plf'), fmt: 'pct' },
    { label: 'Principal Limit', values: get('principalLimit'), highlight: true },
    { section: 'Costs' },
    { label: 'UFMIP (2%)', values: get('ufmip') },
    { label: 'Origination Fee', values: get('origFee') },
    { label: 'Third Party Costs', values: get('thirdPartyCosts') },
    { label: 'Lender Credit', values: get('lenderCredit') },
    { label: 'Total Costs', values: get('totalCosts') },
    { section: 'Net Proceeds' },
    { label: 'Net Principal Limit', values: get('netPL') },
    { label: 'Existing Liens', values: r.map(() => state.existingLiens > 0 ? -state.existingLiens : null) },
    { label: 'Cash to Borrower', values: get('cashToBorrower'), highlight: true },
    { section: 'Line of Credit' },
    { label: 'LOC Year 1', values: get('locYear1') },
    { label: 'LOC After Year 1', values: get('locAfterYear1') },
    { label: 'LOC Growth Rate', values: get('locGrowthRate'), fmt: 'pct' },
    { section: 'LOC Growth Projections' },
    { label: '5-Year', values: get('locProj5') },
    { label: '10-Year', values: get('locProj10') },
    { label: '15-Year', values: get('locProj15') },
    { label: '20-Year', values: get('locProj20') },
  ];

  return (
    <div className="print-page">
      <h2 className="text-lg font-semibold text-gray-800 mb-3">Scenario Comparison</h2>
      <table className="w-full text-xs border border-gray-300">
        <thead>
          <tr className="bg-cyan-50">
            <th className="px-2 py-1.5 text-left text-gray-600 border-b border-r border-gray-300 w-40">Metric</th>
            {labels.map((l, i) => (
              <th key={i} className="px-2 py-1.5 text-right text-cyan-700 border-b border-gray-300 font-semibold">
                Option {l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            if (row.section) {
              return (
                <tr key={i}>
                  <td colSpan={4} className="px-2 py-1 text-xs font-bold text-gray-700 bg-gray-100 border-b border-gray-300">
                    {row.section}
                  </td>
                </tr>
              );
            }
            const format = row.fmt === 'pct' ? fmtPct : fmtDollar;
            return (
              <tr key={i} className={row.highlight ? 'bg-cyan-50 font-semibold' : ''}>
                <td className="px-2 py-1 text-gray-600 border-r border-gray-200">{row.label}</td>
                {(row.values || []).map((v, j) => (
                  <td key={j} className={`px-2 py-1 text-right font-mono ${v < 0 ? 'text-red-600' : ''}`}>
                    {typeof v === 'string' ? v : format(v)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Rate info footer */}
      <div className="mt-4 text-xs text-gray-500">
        <p>CMT 1yr: {fmtPct(state.oneYearCMT)} | CMT 10yr: {fmtPct(state.tenYearCMT)} | MIP: {fmtPct(state.mipRate)} | FHA Limit: {fmtDollar(state.fhaLimit)}</p>
      </div>
    </div>
  );
}

export default function PrintView() {
  return (
    <div className="hidden print:block">
      <CoverPage />
      <div className="print-page-break" />
      <PrintScenarioTable />
    </div>
  );
}
