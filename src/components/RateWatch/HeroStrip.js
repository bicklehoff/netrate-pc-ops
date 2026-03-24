'use client';

import { useState, useEffect } from 'react';

// Estimate APR: rate + cost of ~$4,100 in fees on $400K / 30yr
function estimateAPR(rate) {
  if (!rate) return null;
  const loanAmount = 400000;
  const totalFees = 4100;
  const r = rate / 100 / 12;
  const n = 360;
  const payment = loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const effectiveAmount = loanAmount - totalFees;
  let aprGuess = rate / 100;
  for (let i = 0; i < 20; i++) {
    const rg = aprGuess / 12;
    const pv = payment * (1 - Math.pow(1 + rg, -n)) / rg;
    const deriv = payment * (n * Math.pow(1 + rg, -n - 1) / rg - (1 - Math.pow(1 + rg, -n)) / (rg * rg)) / 12;
    aprGuess -= (pv - effectiveAmount) / deriv;
  }
  return aprGuess * 100;
}

export default function HeroStrip({ todayRate, rateChange, fredLatest }) {
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
      ? `+${rateChange.toFixed(3)} from yesterday`
      : rateChange < 0
        ? `${rateChange.toFixed(3)} from yesterday`
        : 'Unchanged from yesterday';

  // Trend based on 5-day direction
  const trendClass =
    rateChange > 0 ? 'text-red-500' : rateChange < 0 ? 'text-green-500' : 'text-brand';
  const trendLabel =
    rateChange > 0 ? 'Trending Higher' : rateChange < 0 ? 'Trending Lower' : 'Stable';

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_340px] gap-6 px-7 py-6 border-b border-white/10 bg-gradient-to-br from-deep to-surface/50">
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div className="inline-flex items-center gap-2 bg-brand/15 text-brand-light text-xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 bg-brand-light rounded-full animate-pulse" />
            Market Commentary
          </div>
          {commentary?.sentiment && (
            <span className={`text-xs font-bold uppercase tracking-wide ${
              commentary.sentiment === 'bearish' ? 'text-red-400' :
              commentary.sentiment === 'bullish' ? 'text-green-400' : 'text-brand'
            }`}>
              {commentary.sentiment}
            </span>
          )}
          <span className="text-slate-500 text-xs">{dateStr}</span>
        </div>

        {commentary?.headline ? (
          <>
            <h2 className="text-white text-[22px] font-bold leading-tight mb-3">
              {commentary.headline}
            </h2>
            {commentary.treasury10yr && (
              <div className="flex items-center gap-3 text-[13px] mb-3 text-slate-300">
                <span>
                  10yr: {commentary.treasury10yr}%
                  {commentary.treasury10yrChg != null && (
                    <span className={commentary.treasury10yrChg > 0 ? 'text-red-400 ml-1' : 'text-green-400 ml-1'}>
                      ({commentary.treasury10yrChg > 0 ? '+' : ''}{commentary.treasury10yrChg})
                    </span>
                  )}
                </span>
              </div>
            )}
            <p className="text-slate-300 text-[14px] leading-[1.7]">
              {commentary.commentary}
            </p>
          </>
        ) : (
          <>
            <h1 className="text-white text-[26px] font-extrabold leading-tight mb-2.5">
              Daily Mortgage Rate Snapshot
            </h1>
            <p className="text-slate-300 text-base leading-relaxed">
              Live wholesale mortgage rates updated every business day. See how NetRate compares to the
              national average and track trends over time.
            </p>
          </>
        )}
      </div>
      <div className="flex flex-col gap-4">
        <div className="bg-surface rounded-xl px-6 py-5 text-center">
          <div className="text-slate-400 text-xs uppercase tracking-wide mb-1.5">
            Today&apos;s 30yr Fixed (760+)
          </div>
          <div className="text-white text-[44px] font-extrabold leading-none tabular-nums">
            {todayRate ? todayRate.toFixed(3) + '%' : '—'}
          </div>
          {todayRate && (
            <div className="text-slate-400 text-xs mt-1 tabular-nums">
              {estimateAPR(todayRate).toFixed(3)}% APR
            </div>
          )}
          <div className={`text-sm font-semibold mt-1 tabular-nums ${changeClass}`}>{changeText}</div>
        </div>
        <div className="bg-surface rounded-xl px-6 py-5 text-center border border-white/10">
          <div className="text-slate-400 text-xs uppercase tracking-wide mb-2">
            Near-Term Rate Outlook
          </div>
          <div className={`text-[28px] font-extrabold mb-1.5 ${trendClass}`}>{trendLabel}</div>
          <div className="text-slate-400 text-[13px] leading-snug">
            {fredLatest?.DGS10
              ? `10yr Treasury at ${fredLatest.DGS10.value}%. Watch upcoming economic data for direction.`
              : 'Watch upcoming economic data for direction.'}
          </div>
        </div>
      </div>
    </div>
  );
}
