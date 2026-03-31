'use client';

const PRODUCTS = [
  { key: 'conv30', label: '30-Yr Fixed', sub: 'CONF' },
  { key: 'conv15', label: '15-Yr Fixed', sub: 'CONF' },
  { key: 'fha30', label: 'FHA 30-Yr', sub: 'GOV' },
  { key: 'va30', label: 'VA 30-Yr', sub: 'MIL' },
];

function fmt(val, decimals = 2) {
  if (val == null) return '—';
  return val.toFixed(decimals) + '%';
}

function chgColor(val) {
  if (val == null || val === 0) return 'text-slate-400';
  return val > 0 ? 'text-red-500' : 'text-emerald-600';
}

function chgText(val) {
  if (val == null) return '—';
  if (val === 0) return <span className="text-slate-400">0.00%</span>;
  const arrow = val > 0 ? '↑' : '↓';
  return <>{(val > 0 ? '+' : '') + val.toFixed(2)}% {arrow}</>;
}

export default function RateGrid({ netRates, nationalRates, date }) {
  if (!netRates) return null;

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200">
      {/* Header */}
      <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-900">Daily Rate Sheet</h3>
        {date && <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{date}</span>}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-[10px] text-slate-400 border-b border-slate-100 uppercase tracking-wider font-bold">
            <tr>
              <th className="px-6 py-3">Product</th>
              <th className="px-4 py-3">Rate / APR</th>
              <th className="px-4 py-3 text-right">Nat&apos;l Avg</th>
              <th className="px-4 py-3 text-right">Change</th>
              <th className="px-6 py-3 text-right">Savings</th>
            </tr>
          </thead>
          <tbody>
            {PRODUCTS.map((prod) => {
              const nr = netRates?.[prod.key];
              const na = nationalRates?.[prod.key];
              const savings = (nr && na) ? na.rate - nr.rate : null;
              const hasSavings = savings != null && savings > 0;

              return (
                <tr key={prod.key} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-3.5">
                    <div className="text-sm font-bold text-slate-900">{prod.label}</div>
                    <div className="text-[10px] text-slate-400 uppercase font-medium">{prod.sub}</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-sm font-bold text-slate-900 tabular-nums">
                      {nr ? fmt(nr.rate, 3) : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="text-sm text-slate-500 tabular-nums">
                      {na ? fmt(na.rate) : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className={`text-xs font-bold tabular-nums ${chgColor(na?.change)}`}>
                      {na ? chgText(na.change) : '—'}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    {hasSavings ? (
                      <span className="text-xs font-bold text-emerald-600 tabular-nums bg-emerald-50 px-2 py-0.5 rounded-full">
                        -{savings.toFixed(3)}%
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footnote */}
      <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50">
        <p className="text-[10px] text-slate-400 leading-snug">
          780+ FICO · 75% LTV · Purchase | Source: <a href="https://www.mortgagenewsdaily.com/mortgage-rates" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline transition-colors">MND</a>
        </p>
      </div>
    </div>
  );
}
