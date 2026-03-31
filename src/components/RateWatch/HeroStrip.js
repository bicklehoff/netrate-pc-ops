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

export default function HeroStrip({ todayRate, rateChange }) {
  const [commentary, setCommentary] = useState(null);

  useEffect(() => {
    fetch('/api/market/summary')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.summary) setCommentary(data.summary); })
      .catch(() => {});
  }, []);

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
    <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10">
        {/* Label */}
        <span className="text-[10px] text-primary font-bold tracking-widest uppercase">Live Benchmark</span>

        {/* Rate header */}
        <div className="mt-2 mb-1">
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-5xl md:text-7xl font-extrabold tracking-tighter text-slate-900 tabular-nums">
              {todayRate ? todayRate.toFixed(3) + '%' : '—'}
            </span>
            <span className={`text-lg font-bold tabular-nums ${changeClass}`}>{changeText}</span>
          </div>
          <div className="text-sm text-slate-500 mt-1">
            30-Yr Fixed · 780+ FICO · {dateStr}
          </div>
          <p className="text-[10px] text-slate-400 italic mt-1">
            Scenario: $400k loan, 75% LTV, SFR, Primary Residence, Colorado
          </p>
        </div>

        {/* Rate Trend Gauge */}
        <div className="mt-6 mb-6">
          <RateTrendGauge rateChange={rateChange} />
        </div>

        {/* Commentary preview */}
        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Commentary</span>
            {commentary?.sentiment && (
              <span className={`text-[10px] font-bold uppercase ${
                commentary.sentiment === 'bearish' ? 'text-red-500' :
                commentary.sentiment === 'bullish' ? 'text-emerald-600' : 'text-slate-400'
              }`}>
                {commentary.sentiment}
              </span>
            )}
          </div>

          {commentary?.headline ? (
            <>
              <h2 className="text-slate-900 text-sm font-bold leading-snug mb-1">
                {commentary.headline}
              </h2>
              {commentary.treasury10yr && (
                <div className="text-xs text-slate-500 mb-1">
                  10yr: {commentary.treasury10yr}%
                  {commentary.treasury10yrChg != null && (
                    <span className={commentary.treasury10yrChg > 0 ? 'text-red-500 ml-1' : 'text-emerald-600 ml-1'}>
                      ({commentary.treasury10yrChg > 0 ? '+' : ''}{commentary.treasury10yrChg})
                    </span>
                  )}
                </div>
              )}
              <p className="text-slate-500 text-xs leading-relaxed line-clamp-3">
                {commentary.commentary}
              </p>
              <a href="#full-commentary" className="text-primary text-xs font-medium hover:text-cyan-700 transition-colors inline-block mt-1">
                Read more &darr;
              </a>
            </>
          ) : (
            <>
              <h2 className="text-slate-900 text-sm font-bold leading-snug mb-1">
                Daily Mortgage Rate Snapshot
              </h2>
              <p className="text-slate-500 text-xs leading-relaxed">
                Live wholesale rates updated every business day.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
