'use client';

import { useState, useEffect } from 'react';

// Rate trend gauge — maps rate change to a position on a POSITIVE ← → NEGATIVE spectrum
function RateTrendGauge({ rateChange }) {
  // rateChange: negative = rates dropped (positive for borrowers), positive = rates rose (negative for borrowers)
  // Map to 0-100 scale: 0 = very positive, 50 = neutral, 100 = very negative
  const magnitude = Math.abs(rateChange || 0);
  let position;
  if (rateChange > 0) {
    // Rates rose — negative for borrowers (right side)
    position = 50 + Math.min(magnitude * 200, 45); // cap at 95
  } else if (rateChange < 0) {
    // Rates dropped — positive for borrowers (left side)
    position = 50 - Math.min(magnitude * 200, 45); // cap at 5
  } else {
    position = 50;
  }

  // Impact label
  let impact, impactClass;
  if (magnitude === 0) {
    impact = 'MINIMAL';
    impactClass = 'text-amber-400';
  } else if (magnitude < 0.05) {
    impact = rateChange < 0 ? 'SLIGHTLY POSITIVE' : 'SLIGHTLY NEGATIVE';
    impactClass = rateChange < 0 ? 'text-green-400' : 'text-red-400';
  } else if (magnitude < 0.125) {
    impact = rateChange < 0 ? 'POSITIVE' : 'NEGATIVE';
    impactClass = rateChange < 0 ? 'text-green-400' : 'text-red-400';
  } else {
    impact = rateChange < 0 ? 'VERY POSITIVE' : 'VERY NEGATIVE';
    impactClass = rateChange < 0 ? 'text-green-500' : 'text-red-500';
  }

  // Plain English explanation
  let explanation;
  if (rateChange > 0) {
    explanation = `Rates rose ${rateChange.toFixed(3)}% from yesterday. This is a ${impact.toLowerCase()} move for borrowers.`;
  } else if (rateChange < 0) {
    explanation = `Rates dropped ${Math.abs(rateChange).toFixed(3)}% from yesterday. This is a ${impact.toLowerCase()} move for borrowers.`;
  } else {
    explanation = 'Rates are unchanged from yesterday. Minimal impact on borrowers today.';
  }

  return (
    <div className="mb-2">
      <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1">
        Today&apos;s Rate Trend
      </div>
      {/* Spectrum bar */}
      <div className="relative h-2.5 rounded-full overflow-hidden mb-1.5"
        style={{ background: 'linear-gradient(to right, #22c55e, #22c55e 30%, #eab308 50%, #ef4444 70%, #ef4444)' }}>
        {/* Marker */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full border-2 border-slate-800 shadow-md transition-all duration-500"
          style={{ left: `calc(${position}% - 6px)` }}
        />
      </div>
      {/* Labels */}
      <div className="flex justify-between text-[8px] font-bold uppercase tracking-wider mb-1.5">
        <span className="text-green-400">Positive</span>
        <span className="text-amber-400">Minimal</span>
        <span className="text-red-400">Negative</span>
      </div>
      {/* Impact sentence */}
      <p className="text-[11px] text-slate-400 leading-snug">
        <span className={`font-bold ${impactClass}`}>{impact}:</span>{' '}
        {explanation}
      </p>
    </div>
  );
}

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
        : 'unchanged';

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
  });

  return (
    <div className="bg-surface rounded-xl border border-white/10 p-3 flex flex-col">
      {/* Rate header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-baseline gap-2">
          <span className="text-white text-2xl font-extrabold tabular-nums">
            {todayRate ? todayRate.toFixed(3) + '%' : '—'}
          </span>
          <span className={`text-xs font-bold tabular-nums ${changeClass}`}>{changeText}</span>
        </div>
      </div>
      <div className="text-slate-500 text-[11px] mb-2">30-Yr Fixed · 780+ · {dateStr}</div>

      {/* Rate Trend Gauge */}
      <RateTrendGauge rateChange={rateChange} />

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
          <p className="text-slate-400 text-[12px] leading-snug line-clamp-4">
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
