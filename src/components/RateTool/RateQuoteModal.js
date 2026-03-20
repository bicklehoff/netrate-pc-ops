// Rate Quote Modal — Opens when user clicks "Get This Rate" on a table row or recoup card.
// Shows the selected rate details + a lead capture form (Name, Phone, Email).
// Submits to /api/lead with the specific rate info and scenario context.

'use client';

import { useState, useEffect, useRef } from 'react';
import { LO_CONFIG } from '@/lib/rates/config';
import { getUtmParams, formatUtmString } from '@/lib/utm';

const PURPOSE_LABELS = {
  purchase: 'Purchase',
  refi: 'Rate/Term Refi',
  cashout: 'Cash-Out Refi',
};

export default function RateQuoteModal({ rate, scenario, onClose }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const nameRef = useRef(null);

  // Focus name input on mount
  useEffect(() => {
    if (nameRef.current) nameRef.current.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const isCredit = rate.adjPrice < 0;
  const creditLabel = isCredit
    ? `Credit ${Math.abs(rate.adjPrice).toFixed(2)}%`
    : `Charge ${Math.abs(rate.adjPrice).toFixed(2)}%`;
  // Calculate current P&I properly
  const currentPI = scenario.currentRate && scenario.currentRate > 0
    ? (() => {
        const r = scenario.currentRate / 100 / 12;
        const n = 360;
        return scenario.loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
      })()
    : null;
  const monthlySavings = currentPI ? Math.round(currentPI - rate.monthlyPI) : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const purposeLabel = PURPOSE_LABELS[scenario.purpose] || scenario.purpose;
      const utmParams = getUtmParams();
      const utmString = formatUtmString(utmParams);

      const description = [
        `Rate Tool - Selected Rate: ${rate.rate.toFixed(3)}%`,
        `P&I: $${rate.monthlyPI.toFixed(2)}/mo`,
        monthlySavings > 0 ? `Monthly Savings: $${monthlySavings}/mo` : null,
        `${creditLabel}`,
        `Scenario: ${purposeLabel}, ${scenario.fico} FICO, ${Math.round(scenario.ltv)}% LTV, $${Math.round(scenario.loanAmount).toLocaleString()} loan`,
        utmString || null,
      ].filter(Boolean).join('\n');

      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          message: description,
          leadSource: 'Rate Tool - Selected Rate',
        }),
      });

      if (!res.ok) {
        throw new Error('Something went wrong. Please try again or call us directly.');
      }

      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in relative">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-4 text-gray-400 hover:text-gray-600 text-2xl leading-none"
          aria-label="Close"
        >
          &times;
        </button>

        <div className="p-7">
          {submitted ? (
            /* Success state */
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Thank you!</h3>
              <p className="text-sm text-gray-600 mb-1">
                I&apos;ll review your scenario and send you an exact quote with the full cost breakdown within the hour.
              </p>
              <p className="text-sm text-brand font-medium mt-3">
                &mdash; {LO_CONFIG.name}, {LO_CONFIG.phone}
              </p>
              <button
                onClick={onClose}
                className="mt-5 text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Close
              </button>
            </div>
          ) : (
            /* Form state */
            <>
              <h3 className="text-xl font-bold text-gray-900 mb-1">Get Your Exact Quote</h3>
              <p className="text-sm text-gray-500 mb-5">
                I&apos;ll send you a full fee breakdown, cash to close, and savings analysis for this rate.
              </p>

              {/* Selected rate display */}
              <div className="bg-gradient-to-r from-cyan-50 to-cyan-50/50 border border-cyan-200 rounded-lg p-4 mb-5 flex justify-between items-center">
                <div>
                  <p className="text-3xl font-extrabold text-brand-dark">{rate.rate.toFixed(3)}%</p>
                  <p className="text-xs text-gray-500 mt-0.5">30yr Fixed | {PURPOSE_LABELS[scenario.purpose] || scenario.purpose}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="text-gray-600">P&I: <strong className="text-gray-900">${rate.monthlyPI.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></p>
                  {monthlySavings > 0 && (
                    <p className="text-gray-600">Savings: <strong className="text-green-700">-${monthlySavings}/mo</strong></p>
                  )}
                  <p className={`text-xs font-semibold mt-0.5 ${isCredit ? 'text-green-700' : 'text-red-600'}`}>
                    {creditLabel}
                  </p>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  ref={nameRef}
                  type="text"
                  placeholder="Full Name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10"
                />
                <input
                  type="tel"
                  placeholder="Phone Number"
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10"
                />
                <input
                  type="email"
                  placeholder="Email Address"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10"
                />

                {error && (
                  <p className="text-sm text-red-600">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-brand text-white rounded-lg py-3 font-semibold hover:bg-brand-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Sending...' : 'Send Me My Exact Quote'}
                </button>
              </form>

              <p className="text-xs text-gray-400 text-center mt-3">
                No credit pull. No obligation. Just real numbers.
              </p>
              <p className="text-[10px] text-gray-300 text-center mt-2 leading-relaxed">
                By submitting, you agree to receive recurring text messages from NetRate Mortgage
                related to your inquiry. Msg frequency varies. Msg &amp; data rates may apply.
                Reply STOP to cancel, HELP for help.{' '}
                <a href="/privacy" className="underline hover:text-gray-400">Privacy Policy</a>{' '}&amp;{' '}
                <a href="/terms" className="underline hover:text-gray-400">SMS Terms</a>.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
