'use client';

import { useState, useEffect } from 'react';

const FALLBACK_COMMENTARY = "Rates are holding in the middle of the recent 90-day range. Treasury yields continue to reflect uncertainty around inflation data and upcoming Fed decisions. If you've been rate shopping, watch for movement around the next jobs report and CPI release — those are the two data points most likely to shift rates meaningfully in either direction.";

export default function Commentary() {
  const [summary, setSummary] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/market/summary')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.summary) setSummary(data.summary);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Denver',
  });

  const sentimentColors = {
    bullish: 'text-emerald-600 bg-emerald-50',
    bearish: 'text-red-600 bg-red-50',
    neutral: 'text-primary bg-primary/5',
  };

  const headline = summary?.headline;
  const commentary = summary?.commentary || FALLBACK_COMMENTARY;
  const sentiment = summary?.sentiment || 'neutral';
  const dateLabel = summary?.date
    ? new Date(summary.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm h-full flex flex-col overflow-hidden">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-xl">forum</span>
          <span className="text-base font-bold text-slate-900">Market Commentary</span>
          {summary && (
            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${sentimentColors[sentiment]}`}>
              {sentiment}
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400">
          {dateLabel ? dateLabel : `Updated ${timeStr} MT`}
        </span>
      </div>

      {headline && (
        <h3 className="text-slate-900 text-lg font-bold mb-3">{headline}</h3>
      )}

      {/* MBS snapshot strip */}
      {summary?.treasury10yr && (
        <div className="flex items-center gap-4 text-xs mb-3 text-slate-600">
          <span>
            10yr: {summary.treasury10yr}%
            {summary.treasury10yrChg != null && (
              <span className={summary.treasury10yrChg < 0 ? 'text-emerald-600 ml-1 font-bold' : summary.treasury10yrChg > 0 ? 'text-red-500 ml-1 font-bold' : 'ml-1'}>
                ({summary.treasury10yrChg > 0 ? '+' : ''}{summary.treasury10yrChg})
              </span>
            )}
          </span>
          {summary.mbs6Coupon && (
            <span>
              MBS 6.0: {summary.mbs6Coupon}
              {summary.mbs6Change != null && (
                <span className={summary.mbs6Change > 0 ? 'text-emerald-600 ml-1 font-bold' : summary.mbs6Change < 0 ? 'text-red-500 ml-1 font-bold' : 'ml-1'}>
                  ({summary.mbs6Change > 0 ? '+' : ''}{summary.mbs6Change})
                </span>
              )}
            </span>
          )}
        </div>
      )}

      <p className="text-slate-600 text-sm leading-relaxed flex-1 overflow-hidden line-clamp-5">
        {commentary}
      </p>

      <a href="#full-commentary" className="text-primary text-xs font-medium hover:text-cyan-700 transition-colors mt-2 shrink-0">
        Read more &darr;
      </a>

      {!loaded && (
        <div className="animate-pulse mt-3 space-y-2">
          <div className="h-4 w-3/4 bg-slate-100 rounded" />
          <div className="h-4 w-1/2 bg-slate-100 rounded" />
        </div>
      )}
    </div>
  );
}
