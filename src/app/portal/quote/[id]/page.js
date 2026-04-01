'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function fmt(n) {
  if (n == null) return '$0';
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function QuoteViewContent() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/portal/quotes/${id}?token=${token || ''}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load quote');
        setQuote(data.quote);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Loading your quote...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-md text-center">
          <h2 className="text-lg font-bold text-gray-900 mb-2">Quote Unavailable</h2>
          <p className="text-gray-500 text-sm mb-4">{error}</p>
          <p className="text-gray-400 text-xs">Contact David at 303-444-5251 or david@netratemortgage.com</p>
        </div>
      </div>
    );
  }

  const scenarios = quote.scenarios || [];
  const fees = quote.feeBreakdown;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gray-900 text-white py-6 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-bold">
                <span>Net</span><span className="text-cyan-400">Rate</span> <span className="font-normal text-gray-300">Mortgage</span>
              </div>
              <p className="text-gray-400 text-xs mt-1">Your Personalized Rate Quote</p>
            </div>
            {quote.pdfUrl && (
              <a
                href={quote.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-500 transition-colors"
              >
                Download PDF
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Expiration notice */}
        {quote.expiresAt && (
          <div className="text-xs text-gray-400 text-center">
            Quote valid through {new Date(quote.expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        )}

        {/* Scenario Summary */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-4">Your Scenario</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-gray-500">Purpose</div>
              <div className="font-medium capitalize">{quote.purpose}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Loan Amount</div>
              <div className="font-medium font-mono">{fmt(quote.loanAmount)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Property Value</div>
              <div className="font-medium font-mono">{fmt(quote.propertyValue)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Credit Score</div>
              <div className="font-medium">{quote.fico}</div>
            </div>
          </div>
        </div>

        {/* Rate Options */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Rate Options</h2>
          </div>
          {scenarios.map((s, i) => (
            <div key={i} className={`px-6 py-4 ${i > 0 ? 'border-t border-gray-100' : ''} ${i === 0 ? 'bg-cyan-50' : ''}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xl font-mono font-bold">{s.rate?.toFixed(3)}%</div>
                  <div className="text-xs text-gray-500 mt-1">{s.program}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-mono font-bold">{fmt(s.monthlyPI)}<span className="text-sm text-gray-400">/mo</span></div>
                  <div className="text-xs text-gray-500">Principal & Interest</div>
                </div>
              </div>
              {(s.rebateDollars > 0 || s.discountDollars > 0) && (
                <div className="mt-2 text-xs">
                  {s.rebateDollars > 0 && <span className="text-green-600 font-medium">Lender credit: {fmt(s.rebateDollars)}</span>}
                  {s.discountDollars > 0 && <span className="text-red-600 font-medium">Discount points: {fmt(s.discountDollars)}</span>}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Fee Breakdown */}
        {fees && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-4">Estimated Closing Costs</h2>
            {['sectionA', 'sectionB', 'sectionC', 'sectionE', 'sectionF', 'sectionG'].map(key => {
              const section = fees[key];
              if (!section || section.items?.length === 0) return null;
              return (
                <div key={key} className="mb-3">
                  <div className="text-xs font-medium text-gray-500 mb-1">{section.label}</div>
                  {section.items?.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm py-0.5">
                      <span className="text-gray-600">{item.label}</span>
                      <span className="font-mono">{fmt(item.amount)}</span>
                    </div>
                  ))}
                </div>
              );
            })}
            <div className="flex justify-between pt-3 mt-3 border-t-2 border-gray-900">
              <span className="font-bold">Total Closing Costs</span>
              <span className="font-bold font-mono">{fmt(fees.totalClosingCosts)}</span>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="bg-gray-900 rounded-xl p-6 text-center text-white">
          <h3 className="text-lg font-bold mb-2">Ready to move forward?</h3>
          <p className="text-gray-400 text-sm mb-4">Call David to lock your rate or discuss your options.</p>
          <div className="flex justify-center gap-4">
            <a
              href="tel:3034445251"
              className="px-6 py-2.5 bg-cyan-500 text-white rounded-lg font-bold text-sm hover:bg-cyan-400 transition-colors"
            >
              Call 303-444-5251
            </a>
            <a
              href="mailto:david@netratemortgage.com"
              className="px-6 py-2.5 bg-gray-700 text-white rounded-lg font-medium text-sm hover:bg-gray-600 transition-colors"
            >
              Email David
            </a>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-[10px] text-gray-400 leading-relaxed">
          This quote is an estimate based on the information provided and current wholesale pricing. Actual rates, fees, and terms may vary based on full credit review, property appraisal, and underwriting. This is not a commitment to lend or a loan approval. Rate locks are subject to lender availability. Rates may change without notice. NetRate Mortgage LLC | NMLS #1111861 | Equal Housing Lender.
        </p>
      </div>
    </div>
  );
}

export default function QuoteViewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Loading...</div>}>
      <QuoteViewContent />
    </Suspense>
  );
}
