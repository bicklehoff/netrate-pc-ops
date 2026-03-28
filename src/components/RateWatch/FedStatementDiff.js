'use client';

import { useState, useEffect } from 'react';

export default function FedStatementDiff() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch('/api/fomc/statements')
      .then(res => res.ok ? res.json() : null)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-surface rounded-xl border border-white/10 p-3">
        <div className="animate-pulse space-y-2">
          <div className="h-4 w-48 bg-white/10 rounded" />
          <div className="h-32 bg-white/5 rounded" />
        </div>
      </div>
    );
  }

  if (!data?.diff) return null;

  const { diff, current, previous } = data;

  // Estimate visible length — show first ~500 chars when collapsed
  let charCount = 0;
  let cutoffIndex = diff.length;
  if (!expanded) {
    for (let i = 0; i < diff.length; i++) {
      charCount += diff[i].text.length;
      if (charCount > 600) {
        cutoffIndex = i + 1;
        break;
      }
    }
  }

  const visibleDiff = expanded ? diff : diff.slice(0, cutoffIndex);
  const hasMore = cutoffIndex < diff.length;

  return (
    <div className="bg-surface rounded-xl border border-white/10 p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-white text-sm font-bold">What Changed in the Fed Statement</h3>
          <p className="text-slate-500 text-[10px] mt-0.5">
            {current.dateFormatted} vs {previous.dateFormatted}
          </p>
        </div>
        <a
          href={current.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand text-[10px] hover:text-cyan-400 transition-colors"
        >
          Full statement &rarr;
        </a>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mb-2 text-[10px]">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-red-400/60" />
          <span className="text-red-400">Removed</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-green-400/60" />
          <span className="text-green-400">Added</span>
        </span>
      </div>

      {/* Diff text */}
      <div className="text-[12px] leading-relaxed text-slate-300">
        {visibleDiff.map((part, i) => {
          if (part.type === 'removed') {
            return (
              <span
                key={i}
                className="text-red-400/80 line-through decoration-red-400/50 bg-red-400/10 rounded-sm px-0.5"
              >
                {part.text}
              </span>
            );
          }
          if (part.type === 'added') {
            return (
              <span
                key={i}
                className="text-green-400 underline decoration-green-400/50 underline-offset-2 bg-green-400/10 rounded-sm px-0.5"
              >
                {part.text}
              </span>
            );
          }
          return <span key={i}>{part.text}</span>;
        })}
        {hasMore && !expanded && (
          <span className="text-slate-500">...</span>
        )}
      </div>

      {/* Expand/collapse */}
      {(hasMore || expanded) && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-brand text-[11px] font-medium hover:text-cyan-400 transition-colors mt-2"
        >
          {expanded ? 'Show less' : 'Show full statement diff'}
        </button>
      )}
    </div>
  );
}
