'use client';

import { useState, useRef } from 'react';
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
  const [websiteUrl, setWebsiteUrl] = useState(''); // honeypot — real users never see this
  const formLoadedAt = useRef(Date.now());
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
          website_url: websiteUrl,
          formLoadedAt: formLoadedAt.current,
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
    <div className="max-w-5xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Contact Us</h1>
      <p className="text-gray-600 mb-10">
        We&apos;re here to help. Reach out however works best for you.
      </p>

      <div className="grid md:grid-cols-2 gap-12 mb-12">
        {/* Left: Contact Info + Booking */}
        <div>
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">David Burson</h2>
              <p className="text-sm text-gray-500">Mortgage Broker — NMLS #641790</p>
            </div>

            <div className="space-y-3 text-sm">
              <a href="tel:303-444-5251" className="flex items-center gap-3 text-gray-700 hover:text-brand transition-colors">
                <svg className="w-5 h-5 text-brand flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
                303-444-5251
              </a>
              <a href="mailto:david@netratemortgage.com" className="flex items-center gap-3 text-gray-700 hover:text-brand transition-colors">
                <svg className="w-5 h-5 text-brand flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                david@netratemortgage.com
              </a>
              <div className="flex items-start gap-3 text-gray-700">
                <svg className="w-5 h-5 text-brand flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0115 0z" />
                </svg>
                <span>357 South McCaslin Blvd., #200<br />Louisville, CO 80027</span>
              </div>
            </div>

            <div className="pt-3">
              <a
                href="/book"
                className="inline-flex items-center gap-2 bg-brand text-white px-5 py-2.5 rounded-lg font-medium hover:bg-brand-dark glow-brand transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
                Schedule a Free Consultation
              </a>
            </div>

            <p className="text-xs text-gray-400 pt-2">
              Company NMLS #1111861 | Licensed in CA, CO, TX, OR
            </p>
          </div>
        </div>

        {/* Right: Quote Form */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Get a Free Quote</h2>
          <p className="text-sm text-gray-500 mb-5">
            No application, no credit check, no obligation. We&apos;ll get back to you within a few hours on business days.
          </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Honeypot — hidden from real users, bots fill it. Positioned off-screen
            rather than display:none so naive bots don't skip it. */}
        <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
          <label htmlFor="website_url">Website (leave blank)</label>
          <input
            id="website_url"
            type="text"
            name="website_url"
            tabIndex={-1}
            autoComplete="off"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
          />
        </div>

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

      <div className="mt-6 bg-brand/5 border border-brand/20 rounded-lg p-5 text-center">
        <p className="text-sm text-gray-700">
          <strong>Ready to apply?</strong> Skip the quote and{' '}
          <Link href="/portal/apply" className="text-brand font-medium hover:text-brand-dark">
            start your application online &rarr;
          </Link>
        </p>
      </div>
        </div>
      </div>
    </div>
  );
}
