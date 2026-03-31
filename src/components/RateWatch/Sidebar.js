'use client';

// Economic calendar — static for now, will be agent-generated in Phase D
const ECONOMIC_EVENTS = [
  { date: 'Thu Mar 20', time: '8:30 AM', name: 'Initial Jobless Claims' },
  { date: 'Thu Mar 20', time: '10:00 AM', name: 'Existing Home Sales (Feb)' },
  { date: 'Fri Apr 3', time: '8:30 AM', name: 'March Jobs Report' },
  { date: 'Thu Apr 10', time: '8:30 AM', name: 'CPI (March)' },
  { date: 'Wed May 6', time: '2:00 PM', name: 'FOMC Rate Decision' },
];

export function TreasuryYields({ fredLatest }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h3 className="text-base font-bold text-slate-900 mb-4">Treasury Yields</h3>
      <div className="space-y-3">
        {['DGS2', 'DGS5', 'DGS10', 'DGS30'].map((key) => {
          const d = fredLatest?.[key];
          if (!d) return null;
          const labelMap = { DGS2: 'US 2-Year', DGS5: 'US 5-Year', DGS10: 'US 10-Year', DGS30: 'US 30-Year' };
          const chgColor =
            d.change > 0 ? 'text-red-500' : d.change < 0 ? 'text-emerald-600' : 'text-slate-400';
          const chgText = d.change
            ? (d.change > 0 ? '+' : '') + d.change.toFixed(3)
            : '';
          return (
            <div key={key} className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{labelMap[key]}</span>
              <div className="text-right">
                <div className="text-sm font-bold text-slate-900 tabular-nums">{d.value.toFixed(3)}%</div>
                {chgText && <div className={`text-[10px] font-bold tabular-nums ${chgColor}`}>{chgText}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function EconomicCalendar() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h3 className="text-base font-bold text-slate-900 mb-4">Economic Calendar</h3>
      <div className="space-y-3">
        {ECONOMIC_EVENTS.map((ev, i) => (
          <div key={i} className="flex gap-4 items-start">
            <div className="w-12 text-center shrink-0">
              <div className="text-[10px] font-bold text-slate-400 uppercase">
                {ev.date.split(' ')[1]}
              </div>
              <div className="text-lg font-black text-primary leading-tight">
                {ev.date.split(' ')[2]}
              </div>
            </div>
            <div className={`flex-1 pb-3 ${i < ECONOMIC_EVENTS.length - 1 ? 'border-b border-slate-100' : ''}`}>
              <div className="text-sm font-bold text-slate-900">{ev.name}</div>
              <div className="text-[10px] text-slate-400 font-medium">{ev.time}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Default export for backwards compat
export default function Sidebar({ fredLatest }) {
  return (
    <div className="flex flex-col gap-6">
      <TreasuryYields fredLatest={fredLatest} />
      <EconomicCalendar />
    </div>
  );
}
