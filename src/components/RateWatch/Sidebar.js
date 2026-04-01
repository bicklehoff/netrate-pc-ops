'use client';

import { useState, useEffect } from 'react';

export function TreasuryYields({ fredLatest }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm h-full flex flex-col">
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

function formatCalendarDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return { day: d.getDate(), month: months[d.getMonth()], dow: days[d.getDay()] };
}

function isPast(dateStr) {
  const today = new Date().toISOString().split('T')[0];
  return dateStr < today;
}

function ResultBadge({ result }) {
  if (!result) return null;
  if (result === 'better') {
    return <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600">&#10003; Better</span>;
  }
  if (result === 'worse') {
    return <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-red-500">&#10007; Worse</span>;
  }
  return <span className="text-[10px] font-bold text-slate-400">&#8212; Inline</span>;
}

export function EconomicCalendar() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/market/calendar')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.events) setEvents(data.events); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm h-full flex flex-col overflow-hidden">
      <h3 className="text-base font-bold text-slate-900 mb-4 shrink-0">Economic Calendar</h3>
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 -mr-1">
        {loading && (
          <div className="text-xs text-slate-400 py-4 text-center">Loading...</div>
        )}
        {!loading && events.length === 0 && (
          <div className="text-xs text-slate-400 py-4 text-center">No upcoming events</div>
        )}
        {events.map((ev, i) => {
          const { day, month, dow } = formatCalendarDate(ev.date);
          const past = isPast(ev.date);
          return (
            <div key={ev.id || i} className={`flex gap-3 items-start ${past ? 'opacity-60' : ''}`}>
              <div className="w-11 text-center shrink-0">
                <div className="text-[9px] font-bold text-slate-400 uppercase">{month}</div>
                <div className="text-lg font-black text-primary leading-tight">{day}</div>
                <div className="text-[9px] text-slate-400">{dow}</div>
              </div>
              <div className={`flex-1 pb-2 ${i < events.length - 1 ? 'border-b border-slate-100' : ''}`}>
                <div className="text-sm font-bold text-slate-900 leading-snug">{ev.name}</div>
                {ev.time && <div className="text-[10px] text-slate-400 font-medium">{ev.time}</div>}
                {past && ev.actual ? (
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-slate-500">
                      {ev.actual}{ev.forecast ? ` (est. ${ev.forecast})` : ''}
                    </span>
                    <ResultBadge result={ev.result} />
                  </div>
                ) : ev.forecast ? (
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Forecast: {ev.forecast}{ev.prior ? ` | Prior: ${ev.prior}` : ''}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
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
