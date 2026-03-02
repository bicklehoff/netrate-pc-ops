// Portal Layout — Wraps all /portal/* routes
// Provides portal-specific navigation (separate from the public site header/footer)

import Link from 'next/link';

export const metadata = {
  title: 'Borrower Portal | NetRate Mortgage',
  description: 'Apply for a mortgage, track your loan status, and upload documents.',
  robots: 'noindex, nofollow', // Portal pages should not be indexed
};

export default function PortalLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Portal Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/portal/apply" className="flex items-center gap-0.5">
            <span className="text-xl font-bold text-gray-900">Net</span>
            <span className="text-xl font-bold text-brand">Rate</span>
            <span className="text-base font-normal text-gray-500 ml-1.5">Portal</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/portal/apply"
              className="text-gray-600 hover:text-brand transition-colors"
            >
              Apply
            </Link>
            <Link
              href="/portal/auth/login"
              className="text-gray-600 hover:text-brand transition-colors"
            >
              My Loan
            </Link>
            <Link
              href="/"
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              ← Main Site
            </Link>
          </nav>
        </div>
      </header>

      {/* Portal Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
        {children}
      </main>

      {/* Portal Footer */}
      <footer className="border-t border-gray-200 bg-white mt-auto">
        <div className="max-w-5xl mx-auto px-6 py-6 text-center text-xs text-gray-400">
          <p>
            NetRate Mortgage | NMLS #1111861 | 357 South McCaslin Blvd., #200, Louisville, CO 80027
          </p>
          <p className="mt-1">
            Equal Housing Opportunity | Your information is encrypted and secure.
          </p>
        </div>
      </footer>
    </div>
  );
}
