'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import FedPanel from './FedPanel';
import PredictionCard from './PredictionCard';

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

export function FedPanelSection() {
  const { data, loading } = useContext(PredictionDataContext);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-32 bg-slate-100 rounded" />
          <div className="h-20 bg-slate-50 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!data?.fedEvents?.length) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <FedPanel fedEvents={data.fedEvents} />
    </div>
  );
}

export function MarketPredictions() {
  const { data, loading } = useContext(PredictionDataContext);

  if (loading || !data?.markets?.length) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <h2 className="text-base font-bold text-slate-900 mb-3">Market Predictions</h2>
      <div className="grid grid-cols-1 gap-2">
        {data.markets.slice(0, 6).map(market => (
          <PredictionCard key={market.id} market={market} />
        ))}
      </div>
      <p className="text-slate-400 text-[9px] mt-2">
        Polymarket · Updates hourly
      </p>
    </div>
  );
}

export default function Predictions() {
  return (
    <PredictionDataProvider>
      <FedPanelSection />
      <MarketPredictions />
    </PredictionDataProvider>
  );
}
