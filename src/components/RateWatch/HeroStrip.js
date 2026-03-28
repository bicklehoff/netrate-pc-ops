'use client';

import { useState, useEffect } from 'react';

export default function HeroStrip({ todayRate, rateChange }) {
  const [commentary, setCommentary] = useState(null);

  useEffect(() => {
    fetch('/api/market/summary')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.summary) setCommentary(data.summary); })
      .catch(() => {});
  }, []);

  const changeClass =
    rateChange > 0 ? 'text-red-500' : rateChange < 0 ? 'text-green-500' : 'text-amber-500';
  const changeText =
    rateChange > 0
      ? `+${rateChange.toFixed(3)}`
      : rateChange < 0
        ? `${rateChange.toFixed(3)}`
        : 'unch';

  const trendClass =
    rateChange > 0 ? 'text-red-400' : rateChange < 0 ? 'text-green-400' : 'text-brand';
  const trendLabel =
    rateChange > 0 ? 'TRENDING HIGHER' : rateChange < 0 ? 'TRENDING LOWER' : 'STABLE';

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });

  return (
    <div className="bg-surface rounded-xl border border-white/10 p-5 h-full flex flex-col">
      {/* Rate + Trend header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-baseline gap-2">
          <span className="text-white text-3xl font-extrabold tabular-nums">
            {todayRate ? todayRate.toFixed(3) + '%' : '—'}
          </span>
          <span className={`text-sm font-bold tabular-nums ${changeClass}`}>{changeText}</span>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded ${trendClass} bg-white/5`}>
          {trendLabel}
        </span>
      </div>
      <div className="text-slate-500 text-xs mb-4">30-Yr Fixed · 780+ · {dateStr}</div>

      {/* Commentary */}
      <div className="flex items-center gap-2 mb-2">
        <span className="w-1.5 h-1.5 bg-brand-light rounded-full animate-pulse" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-brand">Commentary</span>
        {commentary?.sentiment && (
          <span className={`text-[10px] font-bold uppercase ${
            commentary.sentiment === 'bearish' ? 'text-red-400' :
            commentary.sentiment === 'bullish' ? 'text-green-400' : 'text-slate-400'
          }`}>
            {commentary.sentiment}
          </span>
        )}
      </div>

      {commentary?.headline ? (
        <div className="flex-1">
          <h2 className="text-white text-base font-bold leading-snug mb-2">
            {commentary.headline}
          </h2>
          {commentary.treasury10yr && (
            <div className="text-[12px] text-slate-400 mb-2">
              10yr: {commentary.treasury10yr}%
              {commentary.treasury10yrChg != null && (
                <span className={commentary.treasury10yrChg > 0 ? 'text-red-400 ml-1' : 'text-green-400 ml-1'}>
                  ({commentary.treasury10yrChg > 0 ? '+' : ''}{commentary.treasury10yrChg})
                </span>
              )}
            </div>
          )}
          <p className="text-slate-400 text-[13px] leading-relaxed line-clamp-4">
            {commentary.commentary}
          </p>
        </div>
      ) : (
        <div className="flex-1">
          <h2 className="text-white text-base font-bold leading-snug mb-2">
            Daily Mortgage Rate Snapshot
          </h2>
          <p className="text-slate-400 text-[13px] leading-relaxed">
            Live wholesale mortgage rates updated every business day.
          </p>
        </div>
      )}
    </div>
  );
}
