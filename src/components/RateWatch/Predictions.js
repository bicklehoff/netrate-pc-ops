'use client';

import { useState, useEffect } from 'react';
import PredictionCard from './PredictionCard';

export default function Predictions() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/predictions/polymarket')
      .then(res => res.ok ? res.json() : null)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="px-5 py-6">
        <div className="bg-surface rounded-xl border border-white/10 p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-6 w-48 bg-white/10 rounded" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => <div key={i} className="h-32 bg-white/5 rounded-lg" />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data?.markets?.length) return null;

  return (
    <div className="px-5 py-6">
      <div className="bg-surface rounded-xl border border-white/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white text-[22px] font-extrabold">
              Market Predictions
            </h2>
            <p className="text-slate-400 text-[13px] mt-0.5">
              What prediction markets think about the economy
            </p>
          </div>
          <a
            href="https://polymarket.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand text-xs hover:text-cyan-400 transition-colors"
          >
            Polymarket →
          </a>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.markets.slice(0, 6).map(market => (
            <PredictionCard key={market.id} market={market} />
          ))}
        </div>
        <p className="text-slate-600 text-[11px] mt-4 leading-relaxed">
          Prediction market probabilities are crowd-sourced and reflect trader sentiment, not financial advice.
          Prices update hourly.
        </p>
      </div>
    </div>
  );
}
