'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function StickyRateBar({ rate, apr }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show after scrolling past ~600px (hero section height)
      setVisible(window.scrollY > 600);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        visible
          ? 'translate-y-0 opacity-100'
          : '-translate-y-full opacity-0 pointer-events-none'
      }`}
    >
      <div className="bg-surface/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-2.5 flex items-center justify-between">
          {/* Rate info — hidden on mobile */}
          <div className="hidden sm:flex items-center gap-4">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">30-Yr Fixed</span>
            <span className="text-lg font-extrabold text-white tabular-nums font-mono">{rate}</span>
            <span className="text-sm text-gray-400 tabular-nums font-mono">APR {apr}</span>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-brand-light bg-brand/15 rounded-full px-2 py-0.5">
              <span className="w-1 h-1 bg-brand-light rounded-full animate-pulse" />
              LIVE
            </span>
          </div>
          {/* CTA — always visible */}
          <Link
            href="/rates"
            className="bg-brand text-white text-sm font-bold px-5 py-2 rounded-lg hover:bg-brand-dark hover:shadow-[0_0_20px_rgba(34,211,238,0.2)] transition-all sm:ml-auto"
          >
            Get Your Rate &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
