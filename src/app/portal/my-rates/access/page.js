'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function MyRatesAccessPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/my-rates/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Something went wrong');
      }
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16 sm:py-24">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Access My Rates</h1>
        <p className="text-gray-500 mt-2">
          Enter the email you used when saving your rate scenario. We&apos;ll send you a link to view your rates.
        </p>
      </div>

      {sent ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Check Your Email</h2>
          <p className="text-sm text-gray-600 mb-1">
            If we have a saved scenario for <strong>{email}</strong>, you&apos;ll receive an access link shortly.
          </p>
          <p className="text-xs text-gray-400 mt-3">
            Don&apos;t see it? Check your spam folder.
          </p>
          <div className="mt-6 pt-4 border-t border-gray-100 flex flex-col gap-3">
            <button
              onClick={() => { setSent(false); setEmail(''); }}
              className="text-sm text-brand hover:text-brand-dark font-medium transition-colors"
            >
              Try a different email
            </button>
            <Link href="/rates" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
              Or search new rates
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10"
                autoFocus
              />
            </div>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-go text-white rounded-lg py-3 font-bold hover:bg-go-dark transition-colors disabled:opacity-50"
            >
              {submitting ? 'Sending...' : 'Send Access Link'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400">
              Don&apos;t have a saved scenario?{' '}
              <Link href="/rates" className="text-brand hover:text-brand-dark font-medium">
                Search rates first
              </Link>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
