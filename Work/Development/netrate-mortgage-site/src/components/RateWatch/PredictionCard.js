'use client';

export default function PredictionCard({ market }) {
  const prices = market.outcomePrices || [0.5, 0.5];
  const outcomes = market.outcomes || ['Yes', 'No'];
  const yesProb = prices[0] || 0.5;

  const endDate = market.endDate ? new Date(market.endDate) : null;
  const daysLeft = endDate
    ? Math.max(0, Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24)))
    : null;

  const volume = market.volume || 0;
  const volLabel = volume >= 1_000_000
    ? `$${(volume / 1_000_000).toFixed(1)}M`
    : volume >= 1000
      ? `$${(volume / 1000).toFixed(0)}k`
      : volume > 0
        ? `$${Math.round(volume)}`
        : null;

  return (
    <div className="bg-white/5 rounded-lg p-4 border border-white/10 hover:border-white/20 transition-colors">
      <h3 className="text-white font-semibold text-[14px] mb-3 leading-snug line-clamp-2">
        {market.question}
      </h3>

      <div className="space-y-2 mb-3">
        {outcomes.slice(0, 2).map((outcome, idx) => {
          const prob = prices[idx] || 0;
          const color = idx === 0 ? 'bg-green-500' : 'bg-red-500';
          return (
            <div key={outcome}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">{outcome}</span>
                <span className="text-white font-bold tabular-nums">
                  {(prob * 100).toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-white/10 rounded h-1.5 overflow-hidden">
                <div
                  className={`h-full ${color} transition-all duration-300`}
                  style={{ width: `${Math.max(2, prob * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-white/10 pt-2.5">
        {volLabel && <span>{volLabel} vol</span>}
        {daysLeft !== null && (
          <span>{daysLeft > 0 ? `${daysLeft}d left` : 'Expired'}</span>
        )}
      </div>
    </div>
  );
}
