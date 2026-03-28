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
  if (val == null || val === 0) return 'text-slate-500';
  return val > 0 ? 'text-red-400' : 'text-green-400';
}

function chgText(val) {
  if (val == null) return '—';
  if (val === 0) return 'unch';
  return (val > 0 ? '+' : '') + val.toFixed(2) + '%';
}


export default function RateGrid({ netRates, nationalRates, date }) {
  if (!netRates) return null;

  return (
    <div>
      <div className="bg-surface rounded-xl border border-white/10 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-3 pt-3 pb-1.5">
          <h2 className="text-white text-sm font-bold">NetRate vs National Avg</h2>
          {date && <span className="text-slate-600 text-[10px]">{date}</span>}
        </div>

        {/* Table */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full">
            <thead>
              <tr className="border-y border-white/10 bg-white/[0.03]">
                <th className="text-left text-[9px] font-bold text-slate-400 uppercase tracking-wider py-1.5 px-3">Product</th>
                <th className="text-right text-[9px] font-bold text-slate-400 uppercase tracking-wider py-1.5 px-2">Rate</th>
                <th className="text-right text-[9px] font-bold text-slate-400 uppercase tracking-wider py-1.5 px-2">Nat&apos;l</th>
                <th className="text-right text-[9px] font-bold text-slate-400 uppercase tracking-wider py-1.5 px-2">Chg</th>
                <th className="text-right text-[9px] font-bold text-slate-400 uppercase tracking-wider py-1.5 px-3">Save</th>
              </tr>
            </thead>
            <tbody>
              {PRODUCTS.map((prod, i) => {
                const nr = netRates?.[prod.key];
                const na = nationalRates?.[prod.key];
                const savings = (nr && na) ? na.rate - nr.rate : null;
                const hasSavings = savings != null && savings > 0;

                return (
                  <tr key={prod.key} className={i < PRODUCTS.length - 1 ? 'border-b border-white/[0.06]' : ''}>
                    <td className="py-1.5 px-3">
                      <div className="text-[13px] font-semibold text-slate-200">{prod.label}</div>
                      <div className="text-[9px] text-slate-500 uppercase">{prod.sub}</div>
                    </td>
                    <td className="py-1.5 px-2 text-right">
                      <span className="text-[15px] font-extrabold text-white tabular-nums">
                        {nr ? fmt(nr.rate, 3) : '—'}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-right">
                      <span className="text-[12px] text-slate-400 tabular-nums">
                        {na ? fmt(na.rate) : '—'}
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-right">
                      <span className={`text-[11px] tabular-nums ${chgColor(na?.change)}`}>
                        {na ? chgText(na.change) : '—'}
                      </span>
                    </td>
                    <td className="py-1.5 px-3 text-right">
                      {hasSavings ? (
                        <span className="text-[12px] font-bold text-green-400 tabular-nums">
                          {savings.toFixed(3)}%
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footnote */}
        <div className="px-3 py-1.5 border-t border-white/[0.06]">
          <p className="text-[9px] text-slate-600 leading-snug">
            780+ FICO · 75% LTV · Purchase | Source: <a href="https://www.mortgagenewsdaily.com/mortgage-rates" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-brand transition-colors">MND</a>
          </p>
        </div>
      </div>
    </div>
  );
}
