'use client';

import { useState, useEffect } from 'react';

const FALLBACK = "Markets are digesting the latest economic data and Fed commentary. Treasury yields have been volatile as investors weigh inflation concerns against signs of economic cooling. The path forward depends on upcoming data releases.";

export default function WhatHappenedToday() {
  const [commentary, setCommentary] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/market/summary')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.summary?.commentary) setCommentary(data.summary.commentary);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  if (!loaded) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-4 w-full bg-slate-100 rounded" />
        <div className="h-4 w-5/6 bg-slate-100 rounded" />
        <div className="h-4 w-3/4 bg-slate-100 rounded" />
      </div>
    );
  }

  const text = commentary || FALLBACK;

  return (
    <p className="line-clamp-[8]">
      {text}
    </p>
  );
}
