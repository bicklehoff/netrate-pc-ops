'use client';

import { useState, useEffect, useRef } from 'react';
import { LO_CONFIG } from '@/lib/rates/config';

function LeadModal({ product, onClose }) {
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [websiteUrl, setWebsiteUrl] = useState(''); // honeypot
  const formLoadedAt = useRef(Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const nameRef = useRef(null);

  useEffect(() => {
    if (nameRef.current) nameRef.current.focus();
  }, []);

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          source: 'homepage_rate_table',
          sourceDetail: `${product.product} — ${product.rate} rate, ${product.apr} APR, ${product.payment}/mo`,
          website_url: websiteUrl,
          formLoadedAt: formLoadedAt.current,
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
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-4 text-gray-400 hover:text-gray-600 text-2xl leading-none"
          aria-label="Close"
        >
          &times;
        </button>

        <div className="p-7">
          {submitted ? (
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
            <>
              <h3 className="text-xl font-bold text-gray-900 mb-1">Get Your Exact Quote</h3>
              <p className="text-sm text-gray-500 mb-5">
                I&apos;ll send you a full fee breakdown, cash to close, and savings analysis for this rate.
              </p>

              {/* Selected rate display */}
              <div className="bg-gradient-to-r from-cyan-50 to-cyan-50/50 border border-cyan-200 rounded-lg p-4 mb-5">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-2xl font-extrabold text-brand-dark">{product.rate}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{product.product}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-gray-600">APR: <strong className="text-gray-900">{product.apr}</strong></p>
                    <p className="text-gray-600">P&I: <strong className="text-gray-900">{product.payment}</strong></p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
                  <label htmlFor="hp_website_url">Website (leave blank)</label>
                  <input id="hp_website_url" type="text" name="website_url" tabIndex={-1} autoComplete="off"
                    value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
                </div>
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
              <p className="text-xs text-gray-400 text-center mt-2">
                Have questions? <a href="/book" className="text-brand hover:text-brand-dark underline">Schedule a call with David &rarr;</a>
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

export default function HomepageRatesTable({ products, disclaimer }) {
  const [selectedProduct, setSelectedProduct] = useState(null);

  return (
    <>
      <div className="overflow-x-auto -mx-6 px-6">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider py-2.5 px-4">Product</th>
              <th className="text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider py-2.5 px-4">Rate</th>
              <th className="text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider py-2.5 px-4">APR</th>
              <th className="text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider py-2.5 px-4">Change</th>
              <th className="text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider py-2.5 px-4">Mo. Payment</th>
              <th className="py-2.5 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {products.map((row) => (
              <tr key={row.product} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                <td className="py-3.5 px-4 font-semibold text-gray-900">{row.product}</td>
                <td className="py-3.5 px-4 text-xl font-extrabold text-gray-900 tabular-nums">{row.rate}</td>
                <td className="py-3.5 px-4 text-sm text-gray-600 tabular-nums">{row.apr}</td>
                <td className="py-3.5 px-4">
                  {row.change != null ? (
                    <span className={`text-sm font-semibold tabular-nums ${row.change < 0 ? 'text-green-600' : row.change > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                      {row.change < 0 ? '\u25BC' : row.change > 0 ? '\u25B2' : '\u2014'}{' '}
                      {Math.abs(row.change).toFixed(3)}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-300">&mdash;</span>
                  )}
                </td>
                <td className="py-3.5 px-4 text-sm text-gray-500 tabular-nums">
                  {row.payment}
                  {row.note && <span className="text-[11px] text-gray-400 ml-1">{row.note}</span>}
                </td>
                <td className="py-3.5 px-4 text-right">
                  <button
                    onClick={() => setSelectedProduct(row)}
                    className="bg-brand text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-brand-dark transition-colors"
                  >
                    Get This Rate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
        {disclaimer}
      </p>

      {selectedProduct && (
        <LeadModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </>
  );
}
