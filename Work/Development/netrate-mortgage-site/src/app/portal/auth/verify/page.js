// Magic Link Verification Page
// When a borrower clicks the magic link in their email, they land here.
// This page verifies the token, creates a partial session, then redirects to SMS verification.

'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function VerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('verifying'); // 'verifying' | 'success' | 'error'
  const [error, setError] = useState('');
  const calledRef = useRef(false);

  useEffect(() => {
    // Guard against React Strict Mode double-invoke (consumes the single-use token twice)
    if (calledRef.current) return;
    calledRef.current = true;

    if (!token) {
      setStatus('error');
      setError('No verification token found. Please request a new login link.');
      return;
    }

    async function verify() {
      try {
        const res = await fetch('/api/portal/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();

        if (!res.ok) {
          setStatus('error');
          setError(data.error || 'Invalid or expired link. Please request a new one.');
          return;
        }

        setStatus('success');

        // If phone verification is needed, redirect to verify-phone
        if (data.needsSmsVerification) {
          router.push('/portal/auth/verify-phone');
        } else {
          // Phone already verified or not required — go to dashboard
          router.push('/portal/dashboard');
        }
      } catch {
        setStatus('error');
        setError('Unable to verify link. Please try again.');
      }
    }

    verify();
  }, [token, router]);

  return (
    <div className="max-w-md mx-auto text-center py-16">
      {status === 'verifying' && (
        <>
          <div className="w-12 h-12 border-4 border-brand/30 border-t-brand rounded-full animate-spin mx-auto mb-6" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Verifying your link...</h1>
          <p className="text-gray-500">Please wait a moment.</p>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link expired or invalid</h1>
          <p className="text-gray-500 mb-6">{error}</p>
          <a
            href="/portal/auth/login"
            className="inline-block bg-brand text-white px-6 py-2.5 rounded-lg font-medium hover:bg-brand-dark transition-colors"
          >
            Request new link
          </a>
        </>
      )}

      {status === 'success' && (
        <>
          <div className="w-12 h-12 border-4 border-brand/30 border-t-brand rounded-full animate-spin mx-auto mb-6" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Verified!</h1>
          <p className="text-gray-500">Redirecting...</p>
        </>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-md mx-auto text-center py-16">
          <div className="w-12 h-12 border-4 border-brand/30 border-t-brand rounded-full animate-spin mx-auto mb-6" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Loading...</h1>
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
