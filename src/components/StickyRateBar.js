'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function StickyRateBar({ rate, apr }) {
  const [visible, setVisible] = useState(false);
  const [fedOdds, setFedOdds] = useState(null);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 600);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch Fed prediction odds
  useEffect(() => {
    fetch('/api/predictions/polymarket')
      .then(res => res.ok ? res.json() : null)
      .then(d => {
        if (d?.fedEvents?.[0]) {
          const event = d.fedEvents[0];
          const hold = event.outcomes?.find(o => o.type === 'hold');
          const cuts = event.outcomes?.filter(o => o.type === 'cut') || [];
          const hikes = event.outcomes?.filter(o => o.type === 'hike') || [];
          const cutPct = Math.round(cuts.reduce((s, o) => s + o.probability, 0) * 100);
          const holdPct = Math.round((hold?.probability || 0) * 100);
          const hikePct = Math.round(hikes.reduce((s, o) => s + o.probability, 0) * 100);
          const monthMatch = event.title?.match(/in (\w+)/i);
          const month = monthMatch ? monthMatch[1].slice(0, 3) : 'Next';
          setFedOdds({ cutPct, holdPct, hikePct, month });
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        visible
          ? 'translate-y-0 opacity-100'
          : '-translate-y-full opacity-0 pointer-events-none'
      }`}
    >
      <div className="bg-white/90 backdrop-blur-xl border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-2.5 flex items-center justify-between">
          {/* Rate info — hidden on mobile */}
          <div className="hidden sm:flex items-center gap-4">
            <span className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">30-Yr Fixed</span>
            <span className="text-lg font-extrabold text-brand tabular-nums font-mono">{rate}</span>
            <span className="text-sm text-[#6B7280] tabular-nums font-mono">APR {apr}</span>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-brand bg-brand/10 border border-brand/20 rounded-full px-2 py-0.5">
              <span className="w-1 h-1 bg-brand rounded-full animate-pulse" />
              LIVE
            </span>
          </div>

          {/* Fed odds — hidden on mobile */}
          {fedOdds && (
            <div className="hidden md:flex items-center gap-2 text-[11px]">
              <span className="text-[#a0a0a0]">{fedOdds.month} Fed:</span>
              {fedOdds.cutPct > 0 && (
                <span className="text-green-600 font-semibold">{fedOdds.cutPct}% cut</span>
              )}
              <span className="text-blue-600 font-semibold">{fedOdds.holdPct}% hold</span>
              {fedOdds.hikePct > 0 && (
                <span className="text-red-500 font-semibold">{fedOdds.hikePct}% hike</span>
              )}
            </div>
          )}

          {/* CTA — always visible */}
          <Link
            href="/rates"
            className="bg-brand text-white text-sm font-bold px-5 py-2 rounded-lg hover:bg-brand-dark transition-all sm:ml-auto md:ml-0 flex items-center gap-1.5"
          >
            Get Your Rate <span className="text-[#fff000]">&rarr;</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
