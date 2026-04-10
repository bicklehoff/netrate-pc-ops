'use client';

import { useState } from 'react';
import { LO_CONFIG } from '@/lib/rates/config';
import { getUtmParams, formatUtmString } from '@/lib/utm';
import { trackLeadFormSubmit } from '@/lib/analytics';

function formatScenarioSummary(scenario) {
  if (!scenario) return '';
  const purposeLabels = { purchase: 'Purchase', refi: 'Refinance', cashout: 'Cash-Out Refi' };
  const parts = [
    purposeLabels[scenario.purpose] || scenario.purpose,
    scenario.fico ? `${scenario.fico} FICO` : null,
    scenario.ltv ? `${Math.round(scenario.ltv)}% LTV` : null,
    scenario.loan_amount ? `$${Math.round(scenario.loan_amount).toLocaleString()} loan` : null,
  ].filter(Boolean);
  return parts.length ? `Rate Tool Quote — ${parts.join(', ')}` : 'Rate Tool Quote';
}

export default function LeadCapture({ scenario }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [smsConsent, setSmsConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const scenarioSummary = formatScenarioSummary(scenario);
      const utmParams = getUtmParams();
      const utmString = formatUtmString(utmParams);
      const fullMessage = [scenarioSummary, form.message, utmString].filter(Boolean).join('\n\n');

      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          message: fullMessage,
          smsConsent,
        }),
      });

      if (!res.ok) {
        throw new Error('Something went wrong. Please try again or call us directly.');
      }

      trackLeadFormSubmit('quote_request', 'Rate Tool - Selected Rate');
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 my-4 text-center">
        <p className="text-green-800 font-semibold text-lg">Thank you!</p>
        <p className="text-green-700 text-sm mt-2">
          I&apos;ll review your scenario and send you a personalized quote with the full cost breakdown within the hour.
        </p>
        <p className="text-green-600 text-sm mt-1">— {LO_CONFIG.name}, {LO_CONFIG.phone}</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 my-4">
      <h2 className="text-lg font-semibold text-gray-800 mb-1">Not Sure Which Rate? Let Us Help.</h2>
      <p className="text-sm text-gray-500 mb-4">
        Tell us about your situation and we&apos;ll send you a personalized recommendation with full fee breakdown, cash to close, and savings analysis.
      </p>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input type="text" placeholder="Full Name" required value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          className="border border-gray-300 rounded px-3 py-2 text-sm" />
        <input type="tel" placeholder="Phone Number" required value={form.phone}
          onChange={e => setForm({ ...form, phone: e.target.value })}
          className="border border-gray-300 rounded px-3 py-2 text-sm" />
        <input type="email" placeholder="Email Address" required value={form.email}
          onChange={e => setForm({ ...form, email: e.target.value })}
          className="sm:col-span-2 border border-gray-300 rounded px-3 py-2 text-sm" />
        <textarea placeholder="Any details or questions? (optional)" value={form.message}
          onChange={e => setForm({ ...form, message: e.target.value })}
          className="sm:col-span-2 border border-gray-300 rounded px-3 py-2 text-sm h-16 resize-none" />

        {error && (
          <p className="sm:col-span-2 text-sm text-red-600">{error}</p>
        )}

        <button type="submit" disabled={submitting}
          className="sm:col-span-2 bg-brand text-white rounded py-3 font-semibold hover:bg-brand-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {submitting ? 'Sending...' : 'Request My Personalized Quote'}
        </button>
        <label className="sm:col-span-2 flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={smsConsent}
            onChange={(e) => setSmsConsent(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300 text-brand focus:ring-brand/50 shrink-0"
          />
          <span className="text-[10px] text-gray-400 leading-relaxed">
            I consent to receive SMS messages from NetRate Mortgage related to my inquiry.
            Msg frequency varies. Msg &amp; data rates may apply.
            Reply STOP to cancel, HELP for help.{' '}
            <a href="/privacy" className="underline hover:text-gray-500">Privacy Policy</a>{' '}&amp;{' '}
            <a href="/terms" className="underline hover:text-gray-500">SMS Terms</a>.
          </span>
        </label>
      </form>
    </div>
  );
}
