'use client';

import { useState, useEffect } from 'react';

function formatEventDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`;
}

function getEventTiming(dateStr) {
  const today = new Date().toISOString().split('T')[0];
  if (dateStr === today) return 'today';
  return dateStr < today ? 'past' : 'future';
}

function getBorderClass(ev) {
  const timing = getEventTiming(ev.date);
  if (timing === 'today') return 'border-l-4 border-l-primary';
  if (timing === 'past' && ev.result === 'better') return 'border-l-4 border-l-emerald-500';
  if (timing === 'past' && ev.result === 'worse') return 'border-l-4 border-l-red-400';
  if (timing === 'past') return 'border-l-4 border-l-slate-300';
  if (ev.big) return 'border-l-4 border-l-amber-500';
  return '';
}

function ResultTag({ ev }) {
  const timing = getEventTiming(ev.date);
  if (timing !== 'past' || !ev.actual) return null;
  const colors = {
    better: 'text-emerald-600 bg-emerald-50',
    worse: 'text-red-600 bg-red-50',
    inline: 'text-slate-500 bg-slate-100',
  };
  const labels = { better: 'Good for rates', worse: 'Bad for rates', inline: 'Neutral' };
  const icons = { better: '\u2713', worse: '\u2717', inline: '\u2014' };
  const style = colors[ev.result] || colors.inline;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${style}`}>
      {icons[ev.result]} {labels[ev.result] || 'Released'}
    </span>
  );
}

export default function BelowFold() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    // Fetch both past (with results) and upcoming events
    fetch('/api/market/calendar?limit=20')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.events) {
          const withImpact = data.events.filter(ev => ev.impact);
          // Sort: upcoming first (by date asc), then past (by date desc, most recent first)
          const today = new Date().toISOString().split('T')[0];
          const upcoming = withImpact.filter(ev => ev.date >= today).sort((a, b) => a.date.localeCompare(b.date));
          const past = withImpact.filter(ev => ev.date < today).sort((a, b) => b.date.localeCompare(a.date));
          // Show up to 3 upcoming + up to 3 past with results
          const pastWithResults = past.filter(ev => ev.actual).slice(0, 3);
          setEvents([...upcoming.slice(0, 3), ...pastWithResults]);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-8">
      {/* What Could Move Rates Next */}
      {events.length > 0 && (
        <div>
          <h3 className="text-slate-900 text-lg font-bold mb-4">Economic Calendar</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((ev) => {
              const timing = getEventTiming(ev.date);
              return (
                <div
                  key={ev.id}
                  className={`bg-white rounded-2xl px-6 py-5 border border-slate-200 shadow-sm ${getBorderClass(ev)} ${
                    timing === 'past' ? 'opacity-75' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-primary text-[10px] font-bold uppercase tracking-widest">
                      {formatEventDate(ev.date)}
                      {timing === 'today' && (
                        <span className="ml-2 text-primary bg-primary/10 px-1.5 py-0.5 rounded text-[9px]">TODAY</span>
                      )}
                    </div>
                    <ResultTag ev={ev} />
                  </div>
                  <div className="text-slate-900 text-base font-bold mb-2">{ev.name}</div>
                  {timing === 'past' && ev.actual ? (
                    <div className="text-slate-500 text-sm leading-relaxed">
                      {ev.actual}{ev.forecast ? ` vs ${ev.forecast} forecast` : ''}
                      {ev.prior ? ` (prior: ${ev.prior})` : ''}
                    </div>
                  ) : (
                    <div className="text-slate-500 text-sm leading-relaxed">{ev.impact}</div>
                  )}
                  {timing !== 'past' && ev.forecast && (
                    <div className="text-[10px] text-slate-400 mt-2">
                      Forecast: {ev.forecast}{ev.prior ? ` | Prior: ${ev.prior}` : ''}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CTA Banner */}
      <div className="bg-gradient-to-br from-primary to-cyan-700 rounded-2xl px-8 py-7 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <h3 className="text-white text-xl font-bold mb-1.5">
            Ready to see your actual rate?
          </h3>
          <p className="text-white/80 text-sm max-w-[600px]">
            These are standard scenario rates. Your rate depends on your credit, loan amount, and
            property. Get a personalized quote in 30 seconds.
          </p>
        </div>
        <a
          href="/rates"
          className="bg-white text-cyan-700 px-8 py-3.5 rounded-xl text-base font-bold whitespace-nowrap hover:bg-cyan-50 transition-all hover:-translate-y-0.5 shadow-lg"
        >
          Get Your Rate
        </a>
      </div>

      {/* SEO Text */}
      <div className="pt-8 border-t border-slate-100">
        <h2 className="text-slate-400 text-base font-semibold mb-4">
          About NetRate&apos;s Rate Watch
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3 text-slate-500 text-xs leading-relaxed">
            <p>
              NetRate tracks daily wholesale mortgage rates sourced directly from our lending
              partners. Unlike survey-based averages from Freddie Mac or Bankrate, our data reflects
              actual wholesale pricing available to mortgage brokers — updated every business day.
            </p>
            <p>
              The national average rate shown on this page comes from Freddie Mac&apos;s Primary
              Mortgage Market Survey (PMMS), published weekly. This survey-based rate includes
              approximately 0.7 discount points and reflects retail pricing offered directly to
              consumers by banks and lenders.
            </p>
          </div>
          <div className="space-y-3 text-slate-500 text-xs leading-relaxed">
            <p>
              The spread between wholesale and retail rates exists because retail lenders build their
              margin, overhead, and profit into the rate they quote you. When you work with a
              mortgage broker like NetRate, you access wholesale pricing and pay a transparent broker
              fee instead — typically resulting in a lower overall cost.
            </p>
            <p>
              Our rate history data begins in December 2025 and grows every day. This proprietary
              dataset tracks rates by credit score tier (760+, 740-759, 700-719) for a standard
              purchase scenario: $400,000 loan amount, 75% LTV, single-family residence.
            </p>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="pt-5 pb-10 border-t border-slate-100">
        <p className="text-slate-400 text-[10px] leading-relaxed max-w-[900px]">
          Market commentary is for informational purposes only and does not constitute financial
          advice. Rates shown are wholesale par rates (zero discount points) and are subject to
          change without notice. Actual rates depend on individual borrower qualifications including
          credit score, loan amount, property type, and occupancy. National average data sourced from
          Freddie Mac Primary Mortgage Market Survey via FRED (Federal Reserve Economic Data). This
          product uses the FRED API but is not endorsed or certified by the Federal Reserve Bank of
          St. Louis. NetRate Mortgage LLC NMLS #1111861. Equal Housing Lender.
        </p>
      </div>
    </div>
  );
}
