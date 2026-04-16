// Borrower Login — Magic Link Request
// Borrower enters email → receives magic link → clicks link → SMS verification

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { MAGIC_LINK_EXPIRY_MINUTES } from '@/lib/constants/auth';

function LoginContent() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');

  // Pre-fill email from URL param (e.g., from success page)
  useEffect(() => {
    const prefillEmail = searchParams.get('email');
    if (prefillEmail && !email) {
      setEmail(prefillEmail);
    }
  }, [searchParams]);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/portal/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      setSent(true);
    } catch {
      setError('Unable to send login link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Check your email</h1>
        <p className="text-gray-500">
          We&apos;ve sent a secure login link to <strong className="text-gray-700">{email}</strong>.
          Click the link to access your loan dashboard.
        </p>
        <p className="text-gray-400 text-sm mt-4">
          The link expires in {MAGIC_LINK_EXPIRY_MINUTES} minutes. Check your spam folder if you don&apos;t see it.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-16">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Access your loan
      </h1>
      <p className="text-gray-500 mb-8">
        Enter the email you used on your application. We&apos;ll send you a secure login link.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email address
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none transition-colors"
          />
        </div>

        {error && (
          <p className="text-red-600 text-sm">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-go text-white py-2.5 rounded-lg font-bold hover:bg-go-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Sending...' : 'Send Login Link'}
        </button>
      </form>

      <p className="text-center text-gray-400 text-sm mt-6">
        Don&apos;t have an application yet?{' '}
        <a href="/portal/apply" className="text-brand hover:underline">Apply now</a>
      </p>
    </div>
  );
}

export default function BorrowerLoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
