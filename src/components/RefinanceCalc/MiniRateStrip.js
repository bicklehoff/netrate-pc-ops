'use client';

import { dollar } from './shared';

export default function MiniRateStrip({ rates, selectedRate, onSelect }) {
  if (!rates || rates.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Pick a Rate</h3>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {rates.map(r => {
          const isActive = r.rate === selectedRate;
          const isCredit = (r.rebateDollars || 0) > 0;
          const isPoints = (r.discountDollars || 0) > 0;

          let chipColor;
          if (isActive) {
            chipColor = 'bg-brand text-white border-brand';
          } else if (isCredit) {
            chipColor = 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-400';
          } else if (isPoints) {
            chipColor = 'bg-red-50 text-red-700 border-red-200 hover:border-red-400';
          } else {
            chipColor = 'bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-400';
          }

          return (
            <button
              key={r.rate}
              onClick={() => onSelect(r.rate)}
              className={`flex-shrink-0 border rounded-lg px-3 py-2 text-center transition-colors ${chipColor}`}
            >
              <div className="text-sm font-bold">{r.rate.toFixed(3)}%</div>
              <div className="text-xs mt-0.5">
                {isCredit ? '+' + dollar(r.rebateDollars) : isPoints ? '-' + dollar(r.discountDollars) : 'Par'}
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex gap-4 mt-2 text-xs text-gray-400">
        <span><span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1" />Credit</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-gray-300 mr-1" />Par</span>
        <span><span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1" />Points</span>
      </div>
    </div>
  );
}
