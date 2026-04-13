// SMS Verification — Second Factor
// After clicking magic link, borrower must enter the 6-digit SMS code.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function VerifyPhonePage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/portal/sms/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Invalid code. Please try again.');
        return;
      }

      // Success — redirect to borrower dashboard
      router.push('/portal/dashboard');
    } catch {
      setError('Unable to verify code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await fetch('/api/portal/sms/send-code', { method: 'POST' });
      setError('');
      setCode('');
    } catch {
      setError('Unable to resend code.');
    }
  };

  return (
    <div className="max-w-md mx-auto py-16">
      <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-8 h-8 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      </div>

      <h1 className="text-2xl font-bold text-ink mb-2 text-center">
        Verify your identity
      </h1>
      <p className="text-ink-subtle mb-8 text-center">
        We sent a 6-digit code to your phone number on file.
        Enter it below to access your loan dashboard.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="code" className="block text-sm font-medium text-ink-mid mb-1">
            Verification code
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl font-mono tracking-[0.5em] focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none transition-colors"
            autoFocus
          />
        </div>

        {error && (
          <p className="text-red-600 text-sm text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="w-full bg-go text-white py-2.5 rounded-lg font-bold hover:bg-go-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Verifying...' : 'Verify'}
        </button>
      </form>

      <p className="text-center text-ink-subtle text-sm mt-6">
        Didn&apos;t receive a code?{' '}
        <button
          onClick={handleResend}
          className="text-brand hover:underline"
        >
          Resend code
        </button>
      </p>
      <p className="text-center text-ink-subtle text-xs mt-2">
        Code expires after 10 minutes. 3 incorrect attempts will lock for 15 minutes.
      </p>
    </div>
  );
}
