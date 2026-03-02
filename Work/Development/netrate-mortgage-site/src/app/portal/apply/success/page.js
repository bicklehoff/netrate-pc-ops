// Portal Apply — Success Page
// Shown after the borrower submits their application.

import Link from 'next/link';

export default function SuccessPage() {
  return (
    <div className="max-w-2xl mx-auto text-center py-16">
      {/* Checkmark Icon */}
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg
          className="w-8 h-8 text-green-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-3">
        Application Received!
      </h1>
      <p className="text-gray-500 max-w-md mx-auto mb-8">
        We&apos;ve received your application and a confirmation has been sent to your email.
        You&apos;ll receive a link to track your loan status and upload any requested documents.
      </p>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-6 mb-8 max-w-md mx-auto">
        <h2 className="text-sm font-semibold text-blue-900 mb-2">What happens next?</h2>
        <ol className="text-sm text-blue-800 text-left space-y-2">
          <li className="flex gap-2">
            <span className="font-bold text-brand">1.</span>
            <span>We review your application (usually within 1 business day)</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-brand">2.</span>
            <span>We may request additional documents via email</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-brand">3.</span>
            <span>Your loan officer will be in touch with next steps</span>
          </li>
        </ol>
      </div>

      <div className="flex items-center justify-center gap-4">
        <Link
          href="/portal/auth/login"
          className="bg-brand text-white px-6 py-2.5 rounded-lg font-medium hover:bg-brand-dark transition-colors"
        >
          Check My Status
        </Link>
        <Link
          href="/"
          className="text-gray-500 hover:text-gray-700 px-4 py-2.5 font-medium transition-colors"
        >
          Back to Main Site
        </Link>
      </div>
    </div>
  );
}
