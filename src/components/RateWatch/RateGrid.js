'use client';

const PRODUCTS = [
  { key: 'conv30', label: '30-Yr Fixed', sub: 'Conforming' },
  { key: 'conv15', label: '15-Yr Fixed', sub: 'Conforming' },
  { key: 'fha30', label: 'FHA 30-Yr', sub: 'Government' },
  { key: 'va30', label: 'VA 30-Yr', sub: 'Military' },
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
    <div className="px-5 py-4">
      <div className="bg-surface rounded-xl border border-white/10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div>
            <h2 className="text-white text-base font-bold">NetRate vs National Average</h2>
            <p className="text-slate-500 text-xs mt-0.5">
              Wholesale rate vs Mortgage News Daily national average
            </p>
          </div>
          {date && (
            <span className="text-slate-600 text-xs">{date}</span>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-y border-white/10 bg-white/[0.03]">
                <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider py-2.5 px-6">Product</th>
                <th className="text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider py-2.5 px-3">NetRate</th>
                <th className="text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider py-2.5 px-3">Nat&apos;l Avg</th>
                <th className="text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider py-2.5 px-3">Change</th>
                <th className="text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider py-2.5 px-6">You Save</th>
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
                    <td className="py-3 px-6">
                      <div className="text-sm font-semibold text-slate-200">{prod.label}</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">{prod.sub}</div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="text-[17px] font-extrabold text-white tabular-nums">
                        {nr ? fmt(nr.rate, 3) : '—'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="text-sm text-slate-400 tabular-nums">
                        {na ? fmt(na.rate) : '—'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className={`text-xs tabular-nums ${chgColor(na?.change)}`}>
                        {na ? chgText(na.change) : '—'}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-right">
                      {hasSavings ? (
                        <span className="inline-flex items-center gap-1 text-sm font-bold text-green-400 tabular-nums">
                          {savings.toFixed(3)}%
                        </span>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footnote */}
        <div className="px-6 py-3 border-t border-white/[0.06]">
          <p className="text-[10px] text-slate-600 leading-relaxed">
            NetRate: wholesale rate · 780+ FICO · 80% LTV · Purchase
            {' | '}Nat&apos;l Avg: Mortgage News Daily index · 780 FICO · adjusted for points
            {' | '}Source: <a href="https://www.mortgagenewsdaily.com/mortgage-rates" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-brand transition-colors">mortgagenewsdaily.com</a>
          </p>
        </div>
      </div>
    </div>
  );
}
