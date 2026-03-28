'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import FedPanel from './FedPanel';
import PredictionCard from './PredictionCard';

// Shared data context so both components fetch once
const PredictionDataContext = createContext(null);

export function PredictionDataProvider({ children }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/predictions/polymarket')
      .then(res => res.ok ? res.json() : null)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <PredictionDataContext.Provider value={{ data, loading }}>
      {children}
    </PredictionDataContext.Provider>
  );
}

// Fed Panel — compact, for above-fold right column
export function FedPanelSection() {
  const { data, loading } = useContext(PredictionDataContext);

  if (loading) {
    return (
      <div className="bg-surface rounded-xl border border-white/10 p-5 h-full">
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-32 bg-white/10 rounded" />
          <div className="h-24 bg-white/5 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!data?.fedEvents?.length) return null;

  return (
    <div className="bg-surface rounded-xl border border-white/10 p-5 h-full">
      <FedPanel fedEvents={data.fedEvents} />
    </div>
  );
}

// Market Predictions — full-width, for below fold
export function MarketPredictions() {
  const { data, loading } = useContext(PredictionDataContext);

  if (loading || !data?.markets?.length) return null;

  return (
    <div className="px-5 py-4">
      <div className="bg-surface rounded-xl border border-white/10 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white text-lg font-extrabold">Market Predictions</h2>
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
      <p className="text-slate-600 text-[11px] px-1 mt-3 leading-relaxed">
        Prediction market probabilities reflect trader sentiment on Polymarket and are not financial advice.
        Data updates hourly.
      </p>
    </div>
  );
}

// Default export for backwards compat (not used in new layout)
export default function Predictions() {
  return (
    <PredictionDataProvider>
      <FedPanelSection />
      <MarketPredictions />
    </PredictionDataProvider>
  );
}
