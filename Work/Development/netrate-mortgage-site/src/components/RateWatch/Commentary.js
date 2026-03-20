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
    bullish: 'text-green-400',
    bearish: 'text-red-400',
    neutral: 'text-brand',
  };

  const headline = summary?.headline;
  const commentary = summary?.commentary || FALLBACK_COMMENTARY;
  const sentiment = summary?.sentiment || 'neutral';
  const dateLabel = summary?.date
    ? new Date(summary.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <div className="border-l-4 border-l-brand pl-5">
      <div className="flex justify-between items-center mb-2.5">
        <div className="flex items-center gap-3">
          <span className="text-brand text-[13px] font-bold uppercase tracking-wide">
            Market Commentary
          </span>
          {summary && (
            <span className={`text-[11px] font-semibold uppercase tracking-wide ${sentimentColors[sentiment]}`}>
              {sentiment}
            </span>
          )}
        </div>
        <span className="text-slate-400 text-[13px]">
          {dateLabel ? `${dateLabel}` : `Updated ${timeStr} MT`}
        </span>
      </div>

      {headline && (
        <h3 className="text-white text-lg font-bold mb-2">{headline}</h3>
      )}

      {/* MBS snapshot strip */}
      {summary?.treasury10yr && (
        <div className="flex items-center gap-4 text-[13px] mb-3 text-slate-300">
          <span>
            10yr: {summary.treasury10yr}%
            {summary.treasury10yrChg != null && (
              <span className={summary.treasury10yrChg < 0 ? 'text-green-400 ml-1' : summary.treasury10yrChg > 0 ? 'text-red-400 ml-1' : 'ml-1'}>
                ({summary.treasury10yrChg > 0 ? '+' : ''}{summary.treasury10yrChg})
              </span>
            )}
          </span>
          {summary.mbs6Coupon && (
            <span>
              MBS 6.0: {summary.mbs6Coupon}
              {summary.mbs6Change != null && (
                <span className={summary.mbs6Change > 0 ? 'text-green-400 ml-1' : summary.mbs6Change < 0 ? 'text-red-400 ml-1' : 'ml-1'}>
                  ({summary.mbs6Change > 0 ? '+' : ''}{summary.mbs6Change})
                </span>
              )}
            </span>
          )}
        </div>
      )}

      <p className="text-slate-200 text-[15px] leading-[1.7]">
        {commentary}
      </p>

      {!loaded && (
        <div className="animate-pulse mt-2 h-4 w-3/4 bg-white/5 rounded" />
      )}
    </div>
  );
}
