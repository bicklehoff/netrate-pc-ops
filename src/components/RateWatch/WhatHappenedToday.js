'use client';

import { useState, useEffect } from 'react';

const FALLBACK = "Markets are digesting the latest economic data and Fed commentary. Treasury yields have been volatile as investors weigh inflation concerns against signs of economic cooling. The path forward depends on upcoming data releases.";

function getTitle(source) {
  if (source === 'claw_eod') return 'What Happened Today';
  if (source === 'claw_direct' || source === 'claw') return "What\u2019s Moving Rates";
  return "What\u2019s Moving Rates";
}

export default function WhatHappenedToday() {
  const [commentary, setCommentary] = useState(null);
  const [source, setSource] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/market/summary')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.summary?.commentary) setCommentary(data.summary.commentary);
        if (data?.summary?.source) setSource(data.summary.source);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const title = getTitle(source);
  const text = commentary || FALLBACK;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 border-l-4 border-l-primary p-6 shadow-sm h-full flex flex-col overflow-hidden">
      <h2 className="text-slate-900 text-xl font-extrabold leading-tight mb-3 shrink-0">
        {loaded ? title : 'Market Update'}
      </h2>
      <div className="text-slate-600 text-sm leading-relaxed flex-1 overflow-hidden">
        {!loaded ? (
          <div className="animate-pulse space-y-2">
            <div className="h-4 w-full bg-slate-100 rounded" />
            <div className="h-4 w-5/6 bg-slate-100 rounded" />
            <div className="h-4 w-3/4 bg-slate-100 rounded" />
          </div>
        ) : (
          <p className="line-clamp-[8]">{text}</p>
        )}
      </div>
    </div>
  );
}
