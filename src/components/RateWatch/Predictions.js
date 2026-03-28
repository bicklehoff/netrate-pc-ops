'use client';

import { useState, useEffect } from 'react';
import FedPanel from './FedPanel';
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
            <div className="h-40 bg-white/5 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  const hasFed = data?.fedEvents?.length > 0;
  const hasMarkets = data?.markets?.length > 0;

  if (!hasFed && !hasMarkets) return null;

  return (
    <div className="px-5 py-6 space-y-6">
      {/* Fed Decision Panel */}
      {hasFed && (
        <div className="bg-surface rounded-xl border border-white/10 p-6">
          <FedPanel fedEvents={data.fedEvents} />
        </div>
      )}

      {/* Other Economic Predictions */}
      {hasMarkets && (
        <div className="bg-surface rounded-xl border border-white/10 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-white text-[22px] font-extrabold">Market Predictions</h2>
              <p className="text-slate-400 text-[13px] mt-0.5">
                Economy, inflation, and policy predictions
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.markets.slice(0, 6).map(market => (
              <PredictionCard key={market.id} market={market} />
            ))}
          </div>
        </div>
      )}

      <p className="text-slate-600 text-[11px] px-1 leading-relaxed">
        Prediction market probabilities reflect trader sentiment on Polymarket and are not financial advice.
        Data updates hourly.
      </p>
    </div>
  );
}
