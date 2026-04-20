'use client';

/**
 * Strike Rate / Rate Alert Signup Form
 *
 * Two modes:
 * 1. Strike Rate — "Alert me when rates hit X%" (target-based)
 * 2. Rate Watch — "Send me rate updates" (subscription)
 *
 * Appears below rate tool results, on Rate Watch page, and state pages.
 * Source prop tracks where the signup originated for analytics.
 */

import { useMemo, useState } from 'react';
import { usePicklists } from '@/lib/picklists/client';

// Strike-rate-trackable products. Subset of ref_loan_types active codes —
// excludes HECM / HELOC / bankstatement / other, where "target rate"
// doesn't map cleanly to a marketable number.
const STRIKE_TRACKABLE_CODES = new Set([
  'conventional', 'fha', 'va', 'usda', 'jumbo', 'dscr',
]);

const FALLBACK_LOAN_TYPES = [
  { value: 'conventional', label: 'Conventional' },
  { value: 'fha', label: 'FHA' },
  { value: 'va', label: 'VA' },
  { value: 'usda', label: 'USDA' },
  { value: 'jumbo', label: 'Jumbo' },
  { value: 'dscr', label: 'DSCR' },
];

export default function StrikeRateForm({
  source = 'rate-tool',
  defaultLoanType = 'conventional',
  defaultRate = '',
  compact = false,
}) {
  const picklists = usePicklists();
  const loanTypeOptions = useMemo(() => {
    const fromDb = (picklists.loan_types || []).filter((lt) => STRIKE_TRACKABLE_CODES.has(lt.value));
    return fromDb.length > 0 ? fromDb : FALLBACK_LOAN_TYPES;
  }, [picklists.loan_types]);

  const [mode, setMode] = useState('strike'); // 'strike' or 'watch'
  const [email, setEmail] = useState('');
  const [loanType, setLoanType] = useState(defaultLoanType);
  const [targetRate, setTargetRate] = useState(defaultRate);
  const [newsletter, setNewsletter] = useState(true);
  const [status, setStatus] = useState('idle'); // idle, submitting, success, error
  const [message, setMessage] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('submitting');

    try {
      const payload = {
        email,
        type: mode,
        newsletter,
        source,
      };

      if (mode === 'strike') {
        payload.loanType = loanType;
        payload.targetRate = parseFloat(targetRate);
      }

      const res = await fetch('/api/strike-rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus('success');
        setMessage(data.message);

        // GA4 event
        if (typeof window !== 'undefined' && window.gtag) {
          window.gtag('event', 'strike_rate_signup', {
            type: mode,
            loan_type: loanType,
            target_rate: targetRate,
            source,
          });
        }
      } else {
        setStatus('error');
        setMessage(data.error || 'Something went wrong. Please try again.');
      }
    } catch {
      setStatus('error');
      setMessage('Connection error. Please try again.');
    }
  }

  if (status === 'success') {
    return (
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-6 text-center">
        <div className="text-2xl mb-2">&#10003;</div>
        <p className="text-teal-800 font-medium">{message}</p>
        <button
          onClick={() => { setStatus('idle'); setEmail(''); setTargetRate(''); }}
          className="mt-3 text-sm text-teal-600 hover:text-teal-800 underline"
        >
          Set another alert
        </button>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl border border-gray-200 ${compact ? 'p-4' : 'p-6'} shadow-sm`}>
      {/* Mode toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode('strike')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'strike'
              ? 'bg-brand text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Set a Strike Rate
        </button>
        <button
          onClick={() => setMode('watch')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'watch'
              ? 'bg-brand text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Get Rate Alerts
        </button>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 mb-4">
        {mode === 'strike'
          ? "Set your target rate — we'll email you the moment it's available."
          : "Get notified when rates move significantly or hit new lows."
        }
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Email — always shown */}
        <div>
          <input
            type="email"
            required
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand focus:border-brand outline-none"
          />
        </div>

        {/* Strike Rate fields */}
        {mode === 'strike' && (
          <div className="flex gap-2">
            <select
              value={loanType}
              onChange={(e) => setLoanType(e.target.value)}
              className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand focus:border-brand outline-none bg-white"
            >
              {loanTypeOptions.map(lt => (
                <option key={lt.value} value={lt.value}>{lt.label}</option>
              ))}
            </select>
            <div className="relative flex-1">
              <input
                type="number"
                required
                step="0.125"
                min="1"
                max="15"
                placeholder="Target rate"
                value={targetRate}
                onChange={(e) => setTargetRate(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand focus:border-brand outline-none pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">%</span>
            </div>
          </div>
        )}

        {/* Newsletter opt-in */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={newsletter}
            onChange={(e) => setNewsletter(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand"
          />
          <span className="text-xs text-gray-500">Also send me the monthly market newsletter</span>
        </label>

        {/* Submit */}
        <button
          type="submit"
          disabled={status === 'submitting'}
          className="w-full bg-brand text-white py-2.5 rounded-lg text-sm font-medium hover:bg-brand-dark transition-colors disabled:opacity-50"
        >
          {status === 'submitting'
            ? 'Setting up...'
            : mode === 'strike' ? 'Set My Strike Rate' : 'Subscribe to Rate Alerts'
          }
        </button>

        {/* Error message */}
        {status === 'error' && (
          <p className="text-sm text-red-600 text-center">{message}</p>
        )}

        {/* Privacy note */}
        <p className="text-xs text-gray-400 text-center">
          No spam. Unsubscribe anytime. We never share your email.
        </p>
      </form>
    </div>
  );
}
