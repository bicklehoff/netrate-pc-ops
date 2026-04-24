'use client';

/**
 * Rate Alert Signup Form
 *
 * Email subscription for rate updates. Visitor picks a loan type and subscribes.
 * No threshold/target-rate logic — that's reserved for the future "Target Rate"
 * product (D9c + Layer 3 borrower portal).
 *
 * Appears below rate tool results on /rates and any state pages using it.
 * Source prop tracks where the signup originated for analytics.
 */

import { useMemo, useState } from 'react';
import { usePicklists } from '@/lib/picklists/client';

// Loan types that map cleanly to a headline rate in alert emails.
// Excludes HECM / HELOC / bankstatement / other — these don't produce a
// single comparable rate number for digest emails.
const ALERT_TRACKABLE_CODES = new Set([
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

export default function RateAlertForm({
  source = 'rate-tool',
  defaultLoanType = 'conventional',
  compact = false,
}) {
  const picklists = usePicklists();
  const loanTypeOptions = useMemo(() => {
    const fromDb = (picklists.loan_types || []).filter((lt) => ALERT_TRACKABLE_CODES.has(lt.value));
    return fromDb.length > 0 ? fromDb : FALLBACK_LOAN_TYPES;
  }, [picklists.loan_types]);

  const [email, setEmail] = useState('');
  const [loanType, setLoanType] = useState(defaultLoanType);
  const [newsletter, setNewsletter] = useState(true);
  const [status, setStatus] = useState('idle'); // idle, submitting, success, error
  const [message, setMessage] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('submitting');

    try {
      const res = await fetch('/api/rate-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, loanType, newsletter, source }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus('success');
        setMessage(data.message);

        if (typeof window !== 'undefined' && window.gtag) {
          window.gtag('event', 'rate_alert_signup', {
            loan_type: loanType,
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
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
        <div className="text-2xl mb-2">&#10003;</div>
        <p className="text-emerald-800 font-medium">{message}</p>
        <button
          onClick={() => { setStatus('idle'); setEmail(''); }}
          className="mt-3 text-sm text-emerald-700 hover:text-emerald-900 underline"
        >
          Set another alert
        </button>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-xl border border-gray-200 ${compact ? 'p-4' : 'p-6'} shadow-sm`}>
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Email */}
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

        {/* Loan type */}
        <div>
          <select
            value={loanType}
            onChange={(e) => setLoanType(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand focus:border-brand outline-none bg-white"
          >
            {loanTypeOptions.map(lt => (
              <option key={lt.value} value={lt.value}>{lt.label}</option>
            ))}
          </select>
        </div>

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
          {status === 'submitting' ? 'Setting up...' : 'Set Rate Alert'}
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
