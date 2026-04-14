'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getMatchedCalculators } from '@/lib/calculator-matching';
import { calculateMonthlyPI as calcMonthlyPI, formatDollar } from '@/lib/mortgage-math';

const PURPOSE_LABELS = { purchase: 'Purchase', refi: 'Refinance', cashout: 'Cash-Out Refi' };
const LOAN_TYPE_LABELS = { conventional: 'Conventional', fha: 'FHA', va: 'VA', usda: 'USDA', jumbo: 'Jumbo' };
const FREQ_LABELS = { daily: 'Daily (Mon-Fri)', '3x_week': '3x / week', '2x_week': '2x / week', weekly: 'Weekly' };
const DAY_NAMES = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri' };
const PROP_LABELS = { sfr: 'Single Family', condo: 'Condo', townhouse: 'Townhouse', '2unit': '2-Unit', '3unit': '3-Unit', '4unit': '4-Unit', mfr: 'Manufactured' };

/** Build a /rates URL pre-filled with scenario inputs + BRP token */
function buildRepriceUrl(sd, token) {
  const params = new URLSearchParams();
  if (token) params.set('token', token);
  if (sd.purpose) params.set('purpose', sd.purpose);
  if (sd.loan_type) params.set('loan_type', sd.loan_type);
  if (sd.property_type) params.set('property_type', sd.property_type);
  if (sd.property_value) params.set('property_value', sd.property_value);
  if (sd.downPaymentPct) params.set('downPaymentPct', sd.downPaymentPct);
  if (sd.loan_amount) params.set('loan_amount', sd.loan_amount);
  if (sd.fico) params.set('fico', sd.fico);
  if (sd.term) params.set('term', sd.term);
  if (sd.state) params.set('state', sd.state);
  if (sd.county) params.set('county', sd.county);
  if (sd.currentPayoff) params.set('currentPayoff', sd.currentPayoff);
  if (sd.current_rate) params.set('current_rate', sd.current_rate);
  return `/rates?${params.toString()}`;
}

function ScenarioView({ scenario, token }) {
  const sd = scenario.scenario_data || {};
  const rates = scenario.last_pricing_data || [];
  const bestRate = rates[0];

  const purposeLabel = PURPOSE_LABELS[sd.purpose] || sd.purpose || 'Loan';
  const loanTypeLabel = LOAN_TYPE_LABELS[(sd.loan_type || '').toLowerCase()] || (sd.loan_type || '').toUpperCase();
  const propLabel = PROP_LABELS[sd.property_type] || sd.property_type;
  const calcs = getMatchedCalculators(sd, bestRate?.rate);

  const savedDate = new Date(scenario.created_at).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  const pricedDate = scenario.last_priced_at
    ? new Date(scenario.last_priced_at).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : null;

  // Down payment for purchase
  const downPayment = sd.purpose === 'purchase' && sd.property_value && sd.loan_amount
    ? sd.property_value - sd.loan_amount
    : null;

  return (
    <div className="space-y-6">
      {/* Apply CTA — above the fold */}
      <div className="bg-gradient-to-br from-brand/5 to-cyan-50 rounded-xl border border-brand/20 p-5 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Ready to move forward?</h3>
          <p className="text-sm text-gray-500">Your details will be pre-filled in the application.</p>
        </div>
        <Link
          href={`/portal/apply?from=brp&token=${token}`}
          className="bg-go text-white rounded-lg px-5 py-2.5 text-sm font-bold hover:bg-go-dark transition-colors whitespace-nowrap"
        >
          Apply with This Scenario
        </Link>
      </div>

      {/* Scenario Summary Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-brand/5 border-b border-brand/10 px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {purposeLabel} - {loanTypeLabel}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">Saved {savedDate}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                scenario.alert_status === 'active' ? 'bg-green-50 text-green-700 border border-green-200' :
                scenario.alert_status === 'paused' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
                'bg-gray-100 text-gray-500 border border-gray-200'
              }`}>
                {scenario.alert_status === 'active' ? 'Alerts Active' :
                 scenario.alert_status === 'paused' ? 'Alerts Paused' :
                 scenario.alert_status}
              </span>
            </div>
          </div>
        </div>

        {/* Scenario Details Grid */}
        <div className="px-6 py-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
            {sd.loan_amount > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Loan Amount</p>
                <p className="text-base font-semibold text-gray-900 mt-0.5">{formatDollar(sd.loan_amount)}</p>
              </div>
            )}
            {sd.property_value > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                  {sd.purpose === 'purchase' ? 'Home Price' : 'Property Value'}
                </p>
                <p className="text-base font-semibold text-gray-900 mt-0.5">{formatDollar(sd.property_value)}</p>
              </div>
            )}
            {downPayment > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Down Payment</p>
                <p className="text-base font-semibold text-gray-900 mt-0.5">
                  {formatDollar(downPayment)}
                  {sd.downPaymentPct ? <span className="text-sm text-gray-400 ml-1">({sd.downPaymentPct}%)</span> : null}
                </p>
              </div>
            )}
            {sd.ltv > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">LTV</p>
                <p className="text-base font-semibold text-gray-900 mt-0.5">{Math.round(sd.ltv * 10) / 10}%</p>
              </div>
            )}
            {sd.fico > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Credit Score</p>
                <p className="text-base font-semibold text-gray-900 mt-0.5">{sd.fico}</p>
              </div>
            )}
            {sd.term > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Term</p>
                <p className="text-base font-semibold text-gray-900 mt-0.5">{sd.term}-year {sd.productType === 'fixed' ? 'Fixed' : sd.productType || 'Fixed'}</p>
              </div>
            )}
            {sd.state && (
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Location</p>
                <p className="text-base font-semibold text-gray-900 mt-0.5">
                  {sd.county ? `${sd.county}, ` : ''}{sd.state}
                </p>
              </div>
            )}
            {propLabel && (
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Property Type</p>
                <p className="text-base font-semibold text-gray-900 mt-0.5">{propLabel}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rate Table */}
      {rates.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Your Rates</h3>
              {pricedDate && (
                <p className="text-xs text-gray-400">Last priced {pricedDate}</p>
              )}
            </div>
          </div>
          <div className="px-6 py-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wide">
                  <th className="text-left pb-3 font-medium">Rate</th>
                  <th className="text-right pb-3 font-medium">Est. Monthly P&I</th>
                  <th className="text-right pb-3 font-medium">Points / Credit</th>
                  <th className="text-right pb-3 font-medium">Lender Fee</th>
                </tr>
              </thead>
              <tbody>
                {rates.map((r, i) => {
                  const pi = r.monthlyPI || calcMonthlyPI(r.rate, sd.loan_amount, sd.term);
                  return (
                    <tr key={i} className={`border-t border-gray-100 ${i === 0 ? 'bg-brand/3' : ''}`}>
                      <td className="py-3">
                        <span className="font-mono font-bold text-gray-900 text-base">{Number(r.rate).toFixed(3)}%</span>
                        {i === 0 && <span className="ml-2 text-[10px] font-semibold text-brand bg-brand/10 px-1.5 py-0.5 rounded">BEST</span>}
                      </td>
                      <td className="py-3 text-right font-medium text-gray-900">
                        {pi ? formatDollar(Math.round(pi)) + '/mo' : '-'}
                      </td>
                      <td className="py-3 text-right">
                        {r.rebateDollars > 0 ? (
                          <span className="font-medium text-green-600">-{formatDollar(r.rebateDollars)} credit</span>
                        ) : r.discountDollars > 0 ? (
                          <span className="font-medium text-red-600">+{formatDollar(r.discountDollars)} cost</span>
                        ) : (
                          <span className="text-gray-400">Par</span>
                        )}
                      </td>
                      <td className="py-3 text-right text-gray-600">
                        {r.lenderFee ? formatDollar(r.lenderFee) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Best rate highlight */}
          {bestRate && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-sm text-gray-500">Best available rate</p>
                  <p className="text-2xl font-bold text-brand tabular-nums">{Number(bestRate.rate).toFixed(3)}%</p>
                  {(() => {
                    const pi = bestRate.monthlyPI || calcMonthlyPI(bestRate.rate, sd.loan_amount, sd.term);
                    return pi ? (
                      <p className="text-sm text-gray-500">{formatDollar(Math.round(pi))}/mo estimated payment</p>
                    ) : null;
                  })()}
                </div>
                <Link
                  href={buildRepriceUrl(sd, token)}
                  className="bg-go text-white rounded-lg px-5 py-2.5 text-sm font-bold hover:bg-go-dark transition-colors"
                >
                  Reprice Now
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Alert Schedule */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Alert Schedule</h3>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="bg-gray-50 rounded-lg px-4 py-2.5">
              <p className="text-xs text-gray-400 mb-0.5">Frequency</p>
              <p className="text-sm font-medium text-gray-900">
                {FREQ_LABELS[scenario.alert_frequency] || scenario.alert_frequency}
              </p>
            </div>
            {scenario.alert_days?.length > 0 && (
              <div className="bg-gray-50 rounded-lg px-4 py-2.5">
                <p className="text-xs text-gray-400 mb-0.5">Days</p>
                <p className="text-sm font-medium text-gray-900">
                  {scenario.alert_days.map(d => DAY_NAMES[d] || d).join(', ')}
                </p>
              </div>
            )}
            {scenario.send_count > 0 && (
              <div className="bg-gray-50 rounded-lg px-4 py-2.5">
                <p className="text-xs text-gray-400 mb-0.5">Updates Sent</p>
                <p className="text-sm font-medium text-gray-900">
                  {scenario.send_count}
                  {scenario.last_sent_at && (
                    <span className="text-gray-400 text-xs ml-1">
                      (last: {new Date(scenario.last_sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Calculator Links */}
      {calcs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Run the Numbers</h3>
            <p className="text-sm text-gray-500 mb-4">These calculators are pre-filled with your scenario details.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {calcs.map(c => (
                <Link
                  key={c.name}
                  href={c.url}
                  className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-brand/30 hover:bg-brand/3 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 group-hover:text-brand transition-colors">{c.label}</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 group-hover:text-brand ml-auto transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
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
          <p className="text-sm text-gray-500">Loading your rates...</p>
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
            Go to Rate Tool
          </Link>
        </div>
      </div>
    );
  }

  const scenarios = data?.scenarios || [];
  const scenario = scenarios[0]; // Single scenario view

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {data?.name ? `${data.name.split(' ')[0]}, here are your rates.` : 'Your Rates'}
        </h1>
        <p className="text-gray-500 mt-1">
          Your saved scenario and current pricing from NetRate Mortgage.
        </p>
      </div>

      {!scenario ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500 mb-4">You don&apos;t have a saved scenario yet.</p>
          <Link href="/rates" className="inline-block bg-go text-white rounded-lg px-6 py-2.5 text-sm font-bold hover:bg-go-dark transition-colors">
            Search Rates
          </Link>
        </div>
      ) : (
        <ScenarioView scenario={scenario} token={token} />
      )}

      {/* Footer links */}
      <div className="mt-10 pt-6 border-t border-gray-200">
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/rates" className="text-brand hover:text-brand-dark font-medium">Search New Rates</Link>
          <Link href={token ? `/portal/apply?from=brp&token=${token}` : '/portal/apply'} className="text-brand hover:text-brand-dark font-medium">Apply Now</Link>
          <Link href="/contact" className="text-brand hover:text-brand-dark font-medium">Contact Us</Link>
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
