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
    <div className="bg-surface rounded-xl border border-white/10 p-3">
      <h3 className="text-slate-300 text-[11px] font-bold uppercase tracking-wide mb-2">
        Treasury Yields
      </h3>
      {['DGS2', 'DGS5', 'DGS10', 'DGS30'].map((key) => {
        const d = fredLatest?.[key];
        if (!d) return null;
        const labelMap = { DGS2: '2yr', DGS5: '5yr', DGS10: '10yr', DGS30: '30yr' };
        const chgColor =
          d.change > 0 ? 'text-red-500' : d.change < 0 ? 'text-green-500' : 'text-slate-500';
        const chgText = d.change
          ? (d.change > 0 ? '+' : '') + d.change.toFixed(3)
          : '';
        return (
          <div
            key={key}
            className="flex justify-between py-1 border-b border-white/10 last:border-b-0 text-[12px]"
          >
            <span className="text-slate-400">{labelMap[key]}</span>
            <span>
              <span className="text-white font-bold">{d.value.toFixed(3)}%</span>
              <span className={`text-[11px] ml-1.5 ${chgColor}`}>{chgText}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function EconomicCalendar() {
  return (
    <div className="bg-surface rounded-xl border border-white/10 p-3">
      <h3 className="text-slate-300 text-[11px] font-bold uppercase tracking-wide mb-2">
        Economic Calendar
      </h3>
      {ECONOMIC_EVENTS.map((ev, i) => (
        <div
          key={i}
          className="py-1 border-b border-white/10 last:border-b-0"
        >
          <div className="text-slate-500 text-[10px]">
            {ev.date} &middot; {ev.time}
          </div>
          <div className="text-slate-300 text-[12px] font-medium">
            {ev.name}
          </div>
        </div>
      ))}
    </div>
  );
}

// Default export for backwards compat
export default function Sidebar({ fredLatest }) {
  return (
    <div className="flex flex-col gap-2">
      <TreasuryYields fredLatest={fredLatest} />
      <EconomicCalendar />
    </div>
  );
}
