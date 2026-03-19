'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getUtmParams, formatUtmString } from '@/lib/utm';
import { trackLeadFormSubmit } from '@/lib/analytics';

export default function ContactPage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    loanType: '',
    message: '',
  });
  const [smsConsent, setSmsConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const utmParams = getUtmParams();
      const utmString = formatUtmString(utmParams);
      const messageWithUtm = [form.message, utmString].filter(Boolean).join('\n\n');

      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          message: messageWithUtm,
          leadSource: 'Website - Contact Form',
          smsConsent,
        }),
      });

      if (!res.ok) {
        throw new Error('Something went wrong. Please try again or contact us directly.');
      }

      trackLeadFormSubmit('contact', 'Contact Form');
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Got it. We&apos;ll be in touch.</h1>
        <p className="text-gray-600 mb-6 max-w-xl mx-auto">
          Thanks for reaching out. David will review your information and follow up — typically within
          a few hours on business days. No automated sequences, no hand-off to a call center. Just a
          direct conversation.
        </p>
        <div className="flex items-center justify-center gap-6">
          <Link
            href="/portal/apply"
            className="text-brand font-medium hover:text-brand-dark transition-colors"
          >
            Start Secure Application &rarr;
          </Link>
          <Link
            href="/rates"
            className="text-gray-500 font-medium hover:text-gray-700 transition-colors"
          >
            See Today&apos;s Rates
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Get a Free Quote</h1>
      <p className="text-gray-600 mb-2">
        Tell us a little about what you&apos;re looking for. No application, no credit check, no obligation.
        We&apos;ll review your information and get back to you — usually within a few hours on business days.
      </p>
      <p className="text-sm text-gray-500 mb-10">
        If you&apos;d rather skip the form, call us at{' '}
        <a href="tel:303-444-5251" className="text-brand hover:text-brand-dark font-medium">303-444-5251</a>
        {' '}or email{' '}
        <a href="mailto:david@netratemortgage.com" className="text-brand hover:text-brand-dark font-medium">david@netratemortgage.com</a>.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              id="name"
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
            <input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
            />
          </div>
          <div>
            <label htmlFor="loanType" className="block text-sm font-medium text-gray-700 mb-1">What are you looking for?</label>
            <select
              id="loanType"
              value={form.loanType}
              onChange={(e) => setForm({ ...form, loanType: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
            >
              <option value="">Select...</option>
              <option value="refinance">Refinance</option>
              <option value="purchase">Purchase</option>
              <option value="not_sure">Not Sure</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">Anything else we should know?</label>
          <textarea
            id="message"
            rows={4}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand resize-none"
          />
        </div>

        {/* SMS Opt-In Consent */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={smsConsent}
              onChange={(e) => setSmsConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand/50 shrink-0"
            />
            <span className="text-sm text-gray-700 leading-relaxed">
              By checking this box, you consent to receive SMS customer care and marketing messages
              from NetRate Mortgage. Message frequency may vary. Standard Message and Data Rates may
              apply. Reply STOP to opt out. Reply HELP for help.{' '}
              <a href="/privacy" className="text-brand underline hover:text-brand-dark">Privacy Policy</a>{' '}
              <a href="/terms" className="text-brand underline hover:text-brand-dark">Terms &amp; Conditions</a>
            </span>
          </label>
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-brand text-white rounded-lg py-3 font-semibold hover:bg-brand-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Sending...' : 'See My Personalized Quote'}
        </button>
      </form>

      <div className="mt-8 bg-brand/5 border border-brand/20 rounded-lg p-5 text-center">
        <p className="text-sm text-gray-700">
          <strong>Ready to apply?</strong> Skip the quote and{' '}
          <Link href="/portal/apply" className="text-brand font-medium hover:text-brand-dark">
            start your application online &rarr;
          </Link>
        </p>
      </div>

      <div className="mt-12 pt-8 border-t border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Direct Contact</h2>
        <div className="space-y-2 text-sm text-gray-600">
          <p><span className="font-medium text-gray-900">David Burson</span> — Mortgage Broker</p>
          <p>
            <span className="font-medium text-gray-900">Phone:</span>{' '}
            <a href="tel:303-444-5251" className="text-brand hover:text-brand-dark">303-444-5251</a>
          </p>
          <p>
            <span className="font-medium text-gray-900">Email:</span>{' '}
            <a href="mailto:david@netratemortgage.com" className="text-brand hover:text-brand-dark">david@netratemortgage.com</a>
          </p>
          <p>357 South McCaslin Blvd., #200, Louisville, CO 80027</p>
          <p className="text-xs text-gray-400 pt-1">NMLS #641790 | Company NMLS #1111861</p>
        </div>
      </div>
    </div>
  );
}
