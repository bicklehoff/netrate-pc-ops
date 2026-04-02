'use client';

const GROUPS = [
  {
    title: 'ARM Indexes',
    items: [
      { key: 'SOFR30DAYAVG', label: '30-Day Avg SOFR', sub: 'Most ARM loans' },
      { key: 'SOFR', label: 'SOFR Overnight', sub: 'Reference rate' },
    ],
  },
  {
    title: 'HELOC & Fed',
    items: [
      { key: 'DPRIME', label: 'Prime Rate', sub: 'HELOC index' },
      { key: 'FEDFUNDS', label: 'Fed Funds Rate', sub: 'Drives Prime' },
    ],
  },
  {
    title: 'Reverse Mortgage',
    items: [
      { key: 'CMT10', label: '10-Year CMT', sub: 'HECM expected rate' },
      { key: 'CMT1', label: '1-Year CMT', sub: 'Legacy ARMs' },
    ],
  },
];

function fmt(val, decimals = 3) {
  if (val == null) return '\u2014';
  return val.toFixed(decimals) + '%';
}

function chgColor(val) {
  if (val == null || val === 0) return 'text-slate-400';
  return val > 0 ? 'text-red-500' : 'text-emerald-600';
}

function chgText(val) {
  if (val == null) return '';
  if (val === 0) return 'unch';
  return (val > 0 ? '+' : '') + val.toFixed(3);
}

export default function BenchmarkIndexes({ fredLatest, cmtData }) {
  // Build a unified data map from FRED + CMT
  const data = {};

  // FRED series
  for (const key of ['SOFR30DAYAVG', 'SOFR', 'DPRIME', 'FEDFUNDS']) {
    const d = fredLatest?.[key];
    if (d) {
      data[key] = { value: d.value, change: d.change, date: d.date };
    }
  }

  // CMT from Treasury.gov
  if (cmtData?.tenYear != null) {
    data.CMT10 = {
      value: cmtData.tenYear,
      change: cmtData.tenYearPrev != null
        ? Math.round((cmtData.tenYear - cmtData.tenYearPrev) * 1000) / 1000
        : null,
      date: cmtData.date,
    };
  }
  if (cmtData?.oneYear != null) {
    data.CMT1 = {
      value: cmtData.oneYear,
      change: cmtData.oneYearPrev != null
        ? Math.round((cmtData.oneYear - cmtData.oneYearPrev) * 1000) / 1000
        : null,
      date: cmtData.date,
    };
  }

  const hasData = Object.keys(data).length > 0;
  if (!hasData) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h3 className="text-base font-bold text-slate-900 mb-5">Benchmark Index Rates</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {GROUPS.map((group) => (
          <div key={group.title}>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
              {group.title}
            </div>
            <div className="space-y-4">
              {group.items.map((item) => {
                const d = data[item.key];
                return (
                  <div key={item.key} className="flex justify-between items-start">
                    <div>
                      <div className="text-sm font-bold text-slate-900">{item.label}</div>
                      <div className="text-[10px] text-slate-400">{item.sub}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-slate-900 tabular-nums">
                        {d ? fmt(d.value, item.key === 'DPRIME' || item.key === 'FEDFUNDS' ? 2 : 3) : '\u2014'}
                      </div>
                      {d && (
                        <div className={`text-[10px] font-bold tabular-nums ${chgColor(d.change)}`}>
                          {chgText(d.change)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
