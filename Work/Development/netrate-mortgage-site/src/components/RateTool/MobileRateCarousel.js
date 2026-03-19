'use client';

import { useState } from 'react';
import { fmtDollar, fmtPI } from './reportUtils';

export default function MobileRateCarousel({ ratesToShow, scenario, currentPI, lenderFees, thirdPartyCosts }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const isRefi = scenario.purpose !== 'purchase';

  const swipeStart = { x: 0 };

  const handleTouchStart = (e) => {
    swipeStart.x = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    const diff = swipeStart.x - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && activeIdx < ratesToShow.length - 1) {
        setActiveIdx(activeIdx + 1);
      } else if (diff < 0 && activeIdx > 0) {
        setActiveIdx(activeIdx - 1);
      }
    }
  };

  const r = ratesToShow[activeIdx];
  if (!r) return null;

  const savings = currentPI ? currentPI - r.monthlyPI : 0;
  const totalCost = lenderFees + thirdPartyCosts + r.creditDollars;
  const isCredit = r.creditDollars < 0;
  const isNoCost = totalCost <= 0;
  const paybackMonths = savings > 0 ? totalCost / savings : null;
  const paybackYears = paybackMonths !== null && paybackMonths > 0 ? paybackMonths / 12 : 0;

  return (
    <div
      className="md:hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Card navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setActiveIdx(Math.max(0, activeIdx - 1))}
          disabled={activeIdx === 0}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 disabled:opacity-30"
        >
          ‹
        </button>
        <span className="text-sm text-gray-500 font-medium">
          Option {activeIdx + 1} of {ratesToShow.length}
        </span>
        <button
          onClick={() => setActiveIdx(Math.min(ratesToShow.length - 1, activeIdx + 1))}
          disabled={activeIdx === ratesToShow.length - 1}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 disabled:opacity-30"
        >
          ›
        </button>
      </div>

      {/* Rate card */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        {/* Rate header */}
        <div className="text-center mb-4 pb-4 border-b border-gray-100">
          <div className="text-3xl font-extrabold text-cyan-700 tabular-nums">
            {r.rate.toFixed(3)}%
          </div>
          {r.apr && (
            <div className="text-sm text-gray-500 tabular-nums mt-0.5">
              APR: {r.apr.toFixed(3)}%
            </div>
          )}
          {isNoCost && (
            <span className="inline-block mt-2 text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-full px-3 py-0.5">
              NO COST OPTION
            </span>
          )}
        </div>

        {/* Data rows */}
        <div className="space-y-2.5">
          <Row label="Monthly P&I" value={fmtPI(r.monthlyPI)} />

          {isRefi && currentPI && savings > 0 && (
            <Row
              label="Monthly Savings"
              value={`-${fmtDollar(Math.round(savings))}/mo`}
              valueClass="text-green-700 font-semibold"
            />
          )}

          {isRefi && currentPI && savings > 0 && (
            <Row
              label="Annual Savings"
              value={fmtDollar(Math.round(savings * 12))}
              valueClass="text-green-700 font-semibold"
            />
          )}

          <div className="border-t border-gray-100 pt-2.5" />

          <Row
            label="Credit / Charge"
            value={isCredit ? `(${fmtDollar(Math.abs(r.creditDollars))})` : fmtDollar(r.creditDollars)}
            valueClass={isCredit ? 'text-green-700' : 'text-red-600'}
          />

          <Row label="Lender Fees" value={fmtDollar(lenderFees)} />
          <Row label="Est. Third-Party" value={fmtDollar(thirdPartyCosts)} />

          <div className="border-t border-gray-100 pt-2.5" />

          <Row
            label="Total Closing Costs"
            value={fmtDollar(totalCost)}
            bold
          />

          {isRefi && currentPI && savings > 0 && paybackMonths !== null && (
            <>
              <div className="border-t border-gray-100 pt-2.5" />
              <Row
                label="Payback Period"
                value={paybackMonths <= 0 ? 'Instant' : `${paybackYears.toFixed(1)} years`}
                valueClass="text-cyan-700 font-bold"
              />
              {/* Progress bar */}
              <div className="mt-1">
                <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      paybackYears <= 0 ? 'bg-emerald-500' : paybackYears < 2 ? 'bg-cyan-500' : paybackYears < 3.5 ? 'bg-amber-400' : 'bg-red-400'
                    }`}
                    style={{ width: `${paybackMonths <= 0 ? 100 : Math.min(100, Math.max(5, (1 - paybackYears / 5) * 100))}%` }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-2 mt-4">
        {ratesToShow.map((_, i) => (
          <button
            key={i}
            onClick={() => setActiveIdx(i)}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              i === activeIdx ? 'bg-cyan-600' : 'bg-gray-300'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function Row({ label, value, valueClass = '', bold = false }) {
  return (
    <div className="flex justify-between items-center">
      <span className={`text-sm ${bold ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>{label}</span>
      <span className={`text-sm font-mono tabular-nums ${bold ? 'font-bold text-gray-900' : valueClass || 'text-gray-900'}`}>
        {value}
      </span>
    </div>
  );
}
