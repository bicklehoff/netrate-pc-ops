'use client';

import { useState } from 'react';

export default function RateEducation() {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-white border border-gray-200 rounded-lg my-4 overflow-hidden">
      <button onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex justify-between items-center hover:bg-gray-50 transition-colors cursor-pointer">
        <h2 className="text-base font-semibold text-gray-800">How Rate Pricing Works</h2>
        <span className="text-gray-400 text-lg">{expanded ? "\u2212" : "+"}</span>
      </button>
      {expanded && (
        <div className="px-5 pb-5 text-sm text-gray-600 leading-relaxed">
          <div className="bg-cyan-50 rounded-lg p-4 mb-4">
            <p className="font-semibold text-gray-800 mb-2">The Rate vs. Cost Tradeoff</p>
            <p>Every rate comes with a price. Rates <strong>above par</strong> come with a <strong className="text-green-700">lender credit</strong> — the lender gives you money to offset closing costs. Rates <strong>below par</strong> require <strong className="text-red-600">discount points</strong> — you pay upfront to buy the lower rate.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="border border-green-200 bg-green-50 rounded p-3">
              <p className="font-semibold text-green-800 text-sm mb-1">Higher Rate = Lender Credit</p>
              <p className="text-xs text-green-700">Less cash to close. Good if you plan to refinance again in a few years, or want to minimize upfront costs.</p>
            </div>
            <div className="border border-red-200 bg-red-50 rounded p-3">
              <p className="font-semibold text-red-800 text-sm mb-1">Lower Rate = Discount Points</p>
              <p className="text-xs text-red-700">More cash upfront, but lower monthly payment. Good if you&apos;re staying long-term. Check the recoup period to see when the savings outweigh the cost.</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-gray-500">The &quot;par&quot; rate is where the credit and charge are roughly zero — no cost and no credit. This is your baseline for comparison.</p>
        </div>
      )}
    </div>
  );
}
