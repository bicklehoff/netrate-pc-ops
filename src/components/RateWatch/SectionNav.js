'use client';

import { useState, useEffect } from 'react';

const SECTIONS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'show_chart' },
  { id: 'rates', label: 'Rates Analysis', icon: 'account_balance' },
  { id: 'fed', label: 'Fed Watch', icon: 'receipt_long' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar_month' },
];

// Desktop sidebar + mobile horizontal tab bar for rate-watch page sections
export default function SectionNav() {
  const [active, setActive] = useState('dashboard');

  const scrollTo = (id) => {
    setActive(id);
    const el = document.getElementById(`section-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Track which section is in view
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.id.replace('section-', '');
            setActive(id);
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px' }
    );

    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(`section-${id}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 sticky top-24 self-start h-fit">
        <div className="mb-6">
          <div className="text-sm font-bold text-slate-900">Market Tools</div>
          <div className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Rate Watch</div>
        </div>
        <nav className="space-y-1">
          {SECTIONS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className={`flex items-center gap-3 w-full text-left px-4 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                active === id
                  ? 'text-primary bg-primary/5 font-bold'
                  : 'text-slate-500 hover:bg-slate-50 hover:translate-x-0.5'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="mt-8">
          <a
            href="/rates"
            className="block w-full py-2.5 px-4 bg-primary text-white text-sm font-bold rounded-xl text-center shadow-lg shadow-primary/20 hover:bg-cyan-700 active:scale-95 transition-all"
          >
            Get Your Rate
          </a>
        </div>
      </aside>

      {/* Mobile horizontal tab bar */}
      <div className="lg:hidden sticky top-[64px] z-30 bg-white/80 backdrop-blur-xl border-b border-slate-100 -mx-4 px-4 overflow-x-auto scrollbar-hide">
        <div className="flex gap-1 py-2 min-w-max">
          {SECTIONS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                active === id
                  ? 'bg-primary text-white'
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
