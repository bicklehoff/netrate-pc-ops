'use client';

import { useState, useEffect } from 'react';

function timeAgo(dateStr) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return 'yesterday';
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function MarketNews() {
  const [headlines, setHeadlines] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/market/news?limit=8')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data?.headlines) setHeadlines(data.headlines); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (loaded && headlines.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm h-full flex flex-col overflow-hidden">
      <h3 className="text-base font-bold text-slate-900 mb-4 shrink-0">Market News</h3>
      {!loaded && (
        <div className="animate-pulse space-y-3 flex-1">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-1">
              <div className="h-4 w-full bg-slate-100 rounded" />
              <div className="h-3 w-1/3 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      )}
      <div className="space-y-3 flex-1 overflow-y-auto">
        {headlines.map((h) => (
          <a
            key={h.id}
            href={h.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block group"
          >
            <div className="text-sm text-slate-900 font-medium leading-snug group-hover:text-primary transition-colors">
              {h.title}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase">{h.source}</span>
              <span className="text-[10px] text-slate-300">&middot;</span>
              <span className="text-[10px] text-slate-400">{timeAgo(h.publishedAt)}</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
