'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getMatchedCalculators } from '@/lib/calculator-matching';

function formatDollar(n) {
  return '$' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

const PURPOSE_LABELS = { purchase: 'Purchase', refi: 'Refinance', cashout: 'Cash-Out Refi' };
const FREQ_LABELS = { daily: 'Daily (Mon–Fri)', '3x_week': '3x / week', '2x_week': '2x / week', weekly: 'Weekly' };
const DAY_NAMES = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri' };

function ScenarioCard({ scenario, token, onReprice }) {
  const [expanded, setExpanded] = useState(false);
  const [repricing, setRepricing] = useState(false);
  const [localRates, setLocalRates] = useState(scenario.lastPricingData);
  const [pricedAt, setPricedAt] = useState(scenario.lastPricedAt);

  const sd = scenario.scenarioData || {};
  const purposeLabel = PURPOSE_LABELS[sd.purpose] || sd.purpose || 'Loan';
  const loanType = (sd.loanType || '').toUpperCase();
  const bestRate = localRates?.[0]?.rate;
  const calcs = getMatchedCalculators(sd, bestRate);

  const handleReprice = async () => {
    setRepricing(true);
    try {
      const res = await fetch('/api/my-rates/reprice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, scenarioId: scenario.id }),
      });
      if (!res.ok) throw new Error('Reprice failed');
      const data = await res.json();
      setLocalRates(data.rates);
      setPricedAt(data.pricedAt);
      onReprice?.(scenario.id, data.rates, data.pricedAt);
    } catch {
      // silent — user sees no rate change
    } finally {
      setRepricing(false);
    }
  };

  const summaryParts = [
    purposeLabel,
    loanType && loanType !== purposeLabel.toUpperCase() ? loanType : null,
    sd.loanAmount ? formatDollar(sd.loanAmount) : null,
    sd.fico ? `${sd.fico} FICO` : null,
    sd.state || null,
  ].filter(Boolean);

  const savedDate = new Date(scenario.createdAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });

  const pricedDate = pricedAt
    ? new Date(pricedAt).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Card Header */}
      <div className="px-6 py-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-gray-900">{purposeLabel}</h3>
            {loanType && (
              <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{loanType}</span>
            )}
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              scenario.alertStatus === 'active' ? 'bg-green-50 text-green-700' :
              scenario.alertStatus === 'paused' ? 'bg-yellow-50 text-yellow-700' :
              'bg-gray-100 text-gray-500'
            }`}>
              {scenario.alertStatus === 'active' ? 'Alerts Active' :
               scenario.alertStatus === 'paused' ? 'Alerts Paused' :
               scenario.alertStatus}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">{summaryParts.join(' · ')}</p>
          <p className="text-xs text-gray-400 mt-1">Saved {savedDate}</p>
        </div>

        {/* Best Rate */}
        {bestRate != null && (
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold text-brand tabular-nums">{Number(bestRate).toFixed(3)}%</p>
            <p className="text-xs text-gray-400">best rate</p>
          </div>
        )}
      </div>

      {/* Rate Table */}
      {localRates?.length > 0 && (
        <div className="px-6 pb-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase">
                <th className="text-left pb-2 font-medium">Rate</th>
                <th className="text-right pb-2 font-medium">Monthly P&I</th>
                <th className="text-right pb-2 font-medium">Cost/Credit</th>
              </tr>
            </thead>
            <tbody>
              {localRates.map((r, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="py-2 font-mono font-semibold text-gray-900">{Number(r.rate).toFixed(3)}%</td>
                  <td className="py-2 text-right text-gray-700">{formatDollar(r.monthlyPI)}/mo</td>
                  <td className="py-2 text-right">
                    {r.rebateDollars > 0 ? (
                      <span className="text-green-600">-{formatDollar(r.rebateDollars)}</span>
                    ) : r.discountDollars > 0 ? (
                      <span className="text-red-600">+{formatDollar(r.discountDollars)}</span>
                    ) : (
                      <span className="text-gray-400">Par</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pricedDate && (
            <p className="text-xs text-gray-400 mt-1">Priced {pricedDate}</p>
          )}
        </div>
      )}

      {/* Actions Bar */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleReprice}
            disabled={repricing}
            className="text-sm font-medium text-brand hover:text-brand-dark transition-colors disabled:opacity-50"
          >
            {repricing ? 'Repricing...' : 'Reprice Now'}
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            {expanded ? 'Hide Details' : 'Details'}
          </button>
        </div>

        {/* Calculator Links */}
        {calcs.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {calcs.map(c => (
              <Link
                key={c.name}
                href={c.url}
                className="text-xs font-medium text-brand bg-brand/5 hover:bg-brand/10 px-3 py-1.5 rounded-full transition-colors"
              >
                {c.label} →
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            {sd.loanAmount && (
              <div>
                <p className="text-xs text-gray-400">Loan Amount</p>
                <p className="font-medium text-gray-900">{formatDollar(sd.loanAmount)}</p>
              </div>
            )}
            {sd.propertyValue && (
              <div>
                <p className="text-xs text-gray-400">Property Value</p>
                <p className="font-medium text-gray-900">{formatDollar(sd.propertyValue)}</p>
              </div>
            )}
            {sd.ltv && (
              <div>
                <p className="text-xs text-gray-400">LTV</p>
                <p className="font-medium text-gray-900">{Math.round(sd.ltv)}%</p>
              </div>
            )}
            {sd.fico && (
              <div>
                <p className="text-xs text-gray-400">Credit Score</p>
                <p className="font-medium text-gray-900">{sd.fico}</p>
              </div>
            )}
            {sd.term && (
              <div>
                <p className="text-xs text-gray-400">Term</p>
                <p className="font-medium text-gray-900">{sd.term} years</p>
              </div>
            )}
            {sd.state && (
              <div>
                <p className="text-xs text-gray-400">State</p>
                <p className="font-medium text-gray-900">{sd.state}</p>
              </div>
            )}
            {sd.county && (
              <div>
                <p className="text-xs text-gray-400">County</p>
                <p className="font-medium text-gray-900">{sd.county}</p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-400 mb-1">Alert Schedule</p>
            <p className="text-sm text-gray-700">
              {FREQ_LABELS[scenario.alertFrequency] || scenario.alertFrequency}
              {scenario.alertDays?.length > 0 && (
                <span className="text-gray-400"> — {scenario.alertDays.map(d => DAY_NAMES[d] || d).join(', ')}</span>
              )}
            </p>
            {scenario.sendCount > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                {scenario.sendCount} update{scenario.sendCount !== 1 ? 's' : ''} sent
                {scenario.lastSentAt && ` · Last: ${new Date(scenario.lastSentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MyRatesContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) {
      setError('No access token provided.');
      setLoading(false);
      return;
    }
    fetch(`/api/my-rates?token=${encodeURIComponent(token)}`)
      .then(async res => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Unable to load your scenarios.');
        }
        return res.json();
      })
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading your scenarios...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <Link href="/rates" className="text-sm font-medium text-brand hover:text-brand-dark">
            Go to Rate Tool →
          </Link>
        </div>
      </div>
    );
  }

  const scenarios = data?.scenarios || [];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {data?.name ? `Hi ${data.name.split(' ')[0]},` : 'My Rates'}
        </h1>
        <p className="text-gray-500 mt-1">Your saved rate scenarios and alerts.</p>
      </div>

      {scenarios.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500 mb-4">You don&apos;t have any saved scenarios yet.</p>
          <Link href="/rates" className="inline-block bg-brand text-white rounded-lg px-6 py-2.5 text-sm font-semibold hover:bg-brand-dark transition-colors">
            Search Rates →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {scenarios.map(s => (
            <ScenarioCard key={s.id} scenario={s} token={token} />
          ))}
        </div>
      )}

      {/* Cross-links */}
      <div className="mt-10 pt-6 border-t border-gray-200">
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/rates" className="text-brand hover:text-brand-dark font-medium">Search New Rates</Link>
          <Link href="/portal/apply" className="text-brand hover:text-brand-dark font-medium">Apply Now</Link>
          <Link href="/portal/auth/login" className="text-brand hover:text-brand-dark font-medium">My Loan Portal</Link>
        </div>
      </div>
    </div>
  );
}

export default function MyRatesPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <MyRatesContent />
    </Suspense>
  );
}
