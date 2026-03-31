'use client';

import { useState, useEffect } from 'react';

// Rate trend gauge — maps rate change to a visual spectrum
function RateTrendGauge({ rateChange }) {
  const magnitude = Math.abs(rateChange || 0);
  let position;
  if (rateChange > 0) {
    position = 50 + Math.min(magnitude * 200, 45);
  } else if (rateChange < 0) {
    position = 50 - Math.min(magnitude * 200, 45);
  } else {
    position = 50;
  }

  let impact, impactClass;
  if (magnitude === 0) {
    impact = 'MINIMAL';
    impactClass = 'text-amber-500';
  } else if (magnitude < 0.05) {
    impact = rateChange < 0 ? 'SLIGHTLY POSITIVE' : 'SLIGHTLY NEGATIVE';
    impactClass = rateChange < 0 ? 'text-emerald-600' : 'text-red-500';
  } else if (magnitude < 0.125) {
    impact = rateChange < 0 ? 'POSITIVE' : 'NEGATIVE';
    impactClass = rateChange < 0 ? 'text-emerald-600' : 'text-red-500';
  } else {
    impact = rateChange < 0 ? 'VERY POSITIVE' : 'VERY NEGATIVE';
    impactClass = rateChange < 0 ? 'text-emerald-700' : 'text-red-600';
  }

  let explanation;
  if (rateChange > 0) {
    explanation = `Rates rose ${rateChange.toFixed(3)}% from yesterday. This is a ${impact.toLowerCase()} move for borrowers.`;
  } else if (rateChange < 0) {
    explanation = `Rates dropped ${Math.abs(rateChange).toFixed(3)}% from yesterday. This is a ${impact.toLowerCase()} move for borrowers.`;
  } else {
    explanation = 'Rates are unchanged from yesterday. Minimal impact on borrowers today.';
  }

  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
        Today&apos;s Rate Trend
      </div>
      <div className="relative h-3 rounded-full overflow-hidden mb-2"
        style={{ background: 'linear-gradient(to right, #059669, #059669 30%, #eab308 50%, #dc2626 70%, #dc2626)' }}>
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full border-2 border-slate-800 shadow-md transition-all duration-500"
          style={{ left: `calc(${position}% - 8px)` }}
        />
      </div>
      <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider mb-2">
        <span className="text-emerald-600">Positive</span>
        <span className="text-amber-500">Minimal</span>
        <span className="text-red-500">Negative</span>
      </div>
      <p className="text-xs text-slate-500 leading-relaxed">
        <span className={`font-bold ${impactClass}`}>{impact}:</span>{' '}
        {explanation}
      </p>
    </div>
  );
}

export default function HeroStrip({ todayRate, rateChange, apr }) {
  const [commentary, setCommentary] = useState(null);

  useEffect(() => {
    fetch('/api/market/summary')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.summary) setCommentary(data.summary); })
      .catch(() => {});
  }, []);

  // Only used for sentiment badge — full commentary is in Commentary component

  const changeClass =
    rateChange > 0 ? 'text-red-500' : rateChange < 0 ? 'text-emerald-600' : 'text-amber-500';
  const changeText =
    rateChange > 0
      ? `+${rateChange.toFixed(3)}`
      : rateChange < 0
        ? `${rateChange.toFixed(3)}`
        : 'unchanged';

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm relative overflow-hidden h-full">
      {/* Ambient glow */}
      <div className="absolute -top-20 -right-20 w-48 h-48 bg-primary/5 blur-[80px] rounded-full pointer-events-none" />

      <div className="relative z-10">
        {/* Label */}
        <span className="text-[10px] text-primary font-bold tracking-widest uppercase">NetRate Wholesale Rate</span>

        {/* Rate header */}
        <div className="mt-1 mb-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-4xl md:text-5xl font-extrabold tracking-tighter text-slate-900 tabular-nums">
              {todayRate ? todayRate.toFixed(3) + '%' : '—'}
            </span>
            {apr && (
              <span className="text-lg text-slate-400 font-medium tabular-nums">
                / {apr.toFixed(3)}% APR
              </span>
            )}
            <span className={`text-sm font-bold tabular-nums ${changeClass}`}>{changeText}</span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            30-Yr Fixed · 780+ FICO · {dateStr}
          </div>
        </div>

        {/* Rate Trend Gauge */}
        <div className="mt-3 mb-2">
          <RateTrendGauge rateChange={rateChange} />
        </div>

        {/* Sentiment badge */}
        {commentary?.sentiment && (
          <div className="border-t border-slate-100 pt-3 flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            <span className={`text-xs font-bold uppercase ${
              commentary.sentiment === 'bearish' ? 'text-red-500' :
              commentary.sentiment === 'bullish' ? 'text-emerald-600' : 'text-slate-400'
            }`}>
              {commentary.sentiment}
            </span>
            {commentary.headline && (
              <span className="text-slate-500 text-xs truncate">{commentary.headline}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
