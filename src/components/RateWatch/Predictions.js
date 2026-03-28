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
      <div className="bg-surface rounded-xl border border-white/10 p-3">
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-32 bg-white/10 rounded" />
          <div className="h-24 bg-white/5 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!data?.fedEvents?.length) return null;

  return (
    <div className="bg-surface rounded-xl border border-white/10 p-3">
      <FedPanel fedEvents={data.fedEvents} />
    </div>
  );
}

// Market Predictions — full-width, for below fold
export function MarketPredictions() {
  const { data, loading } = useContext(PredictionDataContext);

  if (loading || !data?.markets?.length) return null;

  return (
    <div className="bg-surface rounded-xl border border-white/10 p-3 flex flex-col">
      <h2 className="text-white text-sm font-bold mb-2">Market Predictions</h2>
      <div className="grid grid-cols-1 gap-2 flex-1">
        {data.markets.slice(0, 6).map(market => (
          <PredictionCard key={market.id} market={market} />
        ))}
      </div>
      <p className="text-slate-600 text-[9px] mt-2 leading-snug">
        Polymarket · Updates hourly
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
