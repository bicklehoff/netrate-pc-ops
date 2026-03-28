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
    <div className="bg-surface rounded-xl border border-white/10 p-3 flex flex-col">
      {/* Rate + Trend header */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-baseline gap-2">
          <span className="text-white text-2xl font-extrabold tabular-nums">
            {todayRate ? todayRate.toFixed(3) + '%' : '—'}
          </span>
          <span className={`text-xs font-bold tabular-nums ${changeClass}`}>{changeText}</span>
        </div>
        <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${trendClass} bg-white/5`}>
          {trendLabel}
        </span>
      </div>
      <div className="text-slate-500 text-[11px] mb-2">30-Yr Fixed · 780+ · {dateStr}</div>

      {/* Commentary */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="w-1.5 h-1.5 bg-brand-light rounded-full animate-pulse" />
        <span className="text-[9px] font-bold uppercase tracking-widest text-brand">Commentary</span>
        {commentary?.sentiment && (
          <span className={`text-[9px] font-bold uppercase ${
            commentary.sentiment === 'bearish' ? 'text-red-400' :
            commentary.sentiment === 'bullish' ? 'text-green-400' : 'text-slate-400'
          }`}>
            {commentary.sentiment}
          </span>
        )}
      </div>

      {commentary?.headline ? (
        <div className="flex-1 min-h-0">
          <h2 className="text-white text-sm font-bold leading-snug mb-1">
            {commentary.headline}
          </h2>
          {commentary.treasury10yr && (
            <div className="text-[11px] text-slate-400 mb-1">
              10yr: {commentary.treasury10yr}%
              {commentary.treasury10yrChg != null && (
                <span className={commentary.treasury10yrChg > 0 ? 'text-red-400 ml-1' : 'text-green-400 ml-1'}>
                  ({commentary.treasury10yrChg > 0 ? '+' : ''}{commentary.treasury10yrChg})
                </span>
              )}
            </div>
          )}
          <p className="text-slate-400 text-[12px] leading-snug line-clamp-5">
            {commentary.commentary}
          </p>
          <a href="#full-commentary" className="text-brand text-[11px] font-medium hover:text-cyan-400 transition-colors mt-1 inline-block">
            Read more &darr;
          </a>
        </div>
      ) : (
        <div className="flex-1">
          <h2 className="text-white text-sm font-bold leading-snug mb-1">
            Daily Mortgage Rate Snapshot
          </h2>
          <p className="text-slate-400 text-[12px] leading-snug">
            Live wholesale rates updated every business day.
          </p>
        </div>
      )}
    </div>
  );
}
