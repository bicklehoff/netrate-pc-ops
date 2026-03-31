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
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-48 bg-slate-100 rounded" />
          <div className="h-32 bg-slate-50 rounded" />
        </div>
      </div>
    );
  }

  if (!data?.diff) return null;

  const { diff, current, previous } = data;

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
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">FOMC Statement Diff</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {current.dateFormatted} vs {previous.dateFormatted}
          </p>
        </div>
        <a
          href={current.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary text-xs font-medium hover:text-cyan-700 transition-colors"
        >
          Full statement &rarr;
        </a>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 text-[10px]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-red-400" />
          <span className="text-red-500 font-medium">Removed</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-emerald-500" />
          <span className="text-emerald-600 font-medium">Added</span>
        </span>
      </div>

      {/* Diff text */}
      <div className="text-xs leading-relaxed text-slate-600">
        {visibleDiff.map((part, i) => {
          if (part.type === 'removed') {
            return (
              <span
                key={i}
                className="text-red-600 line-through decoration-red-300 bg-red-50 rounded-sm px-0.5"
              >
                {part.text}
              </span>
            );
          }
          if (part.type === 'added') {
            return (
              <span
                key={i}
                className="text-emerald-700 font-medium underline decoration-emerald-300 underline-offset-2 bg-emerald-50 rounded-sm px-0.5"
              >
                {part.text}
              </span>
            );
          }
          return <span key={i}>{part.text}</span>;
        })}
        {hasMore && !expanded && (
          <span className="text-slate-300">...</span>
        )}
      </div>

      {/* Expand/collapse */}
      {(hasMore || expanded) && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-primary text-xs font-medium hover:text-cyan-700 transition-colors mt-3"
        >
          {expanded ? 'Show less' : 'Show full statement diff'}
        </button>
      )}
    </div>
  );
}
