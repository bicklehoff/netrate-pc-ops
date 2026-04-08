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
          // Extract month from title: "Fed decision in April?" → "Apr"
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
      <div className="bg-deep/95 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-2.5 flex items-center justify-between">
          {/* Rate info — hidden on mobile */}
          <div className="hidden sm:flex items-center gap-4">
            <span className="text-xs font-bold text-white/50 uppercase tracking-wider">30-Yr Fixed</span>
            <span className="text-lg font-extrabold text-white tabular-nums font-mono">{rate}</span>
            <span className="text-sm text-white/50 tabular-nums font-mono">APR {apr}</span>
          </div>

          {/* Fed odds — hidden on mobile */}
          {fedOdds && (
            <div className="hidden md:flex items-center gap-2 text-[11px]">
              <span className="text-white/40">{fedOdds.month} Fed:</span>
              {fedOdds.cutPct > 0 && (
                <span className="text-emerald-400 font-semibold">{fedOdds.cutPct}% cut</span>
              )}
              <span className="text-blue-300 font-semibold">{fedOdds.holdPct}% hold</span>
              {fedOdds.hikePct > 0 && (
                <span className="text-red-400 font-semibold">{fedOdds.hikePct}% hike</span>
              )}
            </div>
          )}

          {/* CTA — always visible */}
          <Link
            href="/portal/apply"
            className="bg-brand text-[#fff000] text-sm font-medium px-5 py-2 rounded-xl hover:bg-brand-dark transition-all sm:ml-auto md:ml-0"
          >
            Apply Now
          </Link>
        </div>
      </div>
    </div>
  );
}
