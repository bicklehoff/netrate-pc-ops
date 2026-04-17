import Link from 'next/link';

export const metadata = {
  title: 'HELOC & Home Equity Rates — Access Equity Without Refinancing | NetRate Mortgage',
  description: 'HELOC and home equity loan rates. Access your equity without touching your first mortgage rate. Compare line of credit vs closed-end second options.',
  openGraph: {
    title: 'HELOC & Home Equity Rates — Access Equity Without Refinancing | NetRate Mortgage',
    description: 'HELOC and home equity loan rates. Access your equity without touching your first mortgage rate. Compare line of credit vs closed-end second options.',
    type: 'website',
    siteName: 'NetRate Mortgage',
    url: 'https://www.netratemortgage.com/rates/heloc',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HELOC & Home Equity Rates — Access Equity Without Refinancing | NetRate Mortgage',
    description: 'HELOC and home equity loan rates. Access your equity without touching your first mortgage rate. Compare line of credit vs closed-end second options.',
  },
  alternates: {
    canonical: 'https://www.netratemortgage.com/rates/heloc',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'HELOC & Home Equity Rates',
  description: 'HELOC and home equity loan rates. Access your equity without touching your first mortgage rate. Compare line of credit vs closed-end second options.',
  url: 'https://www.netratemortgage.com/rates/heloc',
  publisher: {
    '@type': 'Organization',
    name: 'NetRate Mortgage',
    url: 'https://www.netratemortgage.com',
  },
  author: {
    '@type': 'Organization',
    name: 'NetRate Mortgage',
    url: 'https://www.netratemortgage.com',
  },
};

export default function HelocRatesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-8" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-brand">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/rates" className="hover:text-brand">Rates</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900">HELOC &amp; Home Equity</span>
        </nav>

        {/* Hero */}
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
          HELOC &amp; Home Equity Rates
        </h1>
        <p className="text-lg text-gray-700 mb-4">
          Sitting on a low first mortgage rate and need cash? A HELOC or closed-end second lets
          you tap your home&apos;s equity without refinancing your existing loan. You keep your
          low rate on the first &mdash; and add a second lien for the amount you need.
        </p>
        <p className="text-gray-600 mb-10">
          With first mortgage rates well above the lows many homeowners locked in, second-lien
          products have become one of the smartest ways to access equity without giving up a
          rate you&apos;ll never see again.
        </p>

        {/* Rate Tool Placeholder */}
        {/* TODO: Dev — wire rate tool component here, filtered to HELOC/CES products */}
        <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-12 text-center text-gray-400 mb-12">
          <p className="text-lg font-medium">Rate tool loading...</p>
          <p className="text-sm mt-2">Personalized rates coming soon. <Link href="/rates" className="text-brand hover:underline">See agency rates</Link></p>
        </div>

        {/* Two Types */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Two Types of Second Liens</h2>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-2">HELOC (Home Equity Line of Credit)</h3>
          <p className="text-gray-700 mb-4">
            A revolving line of credit secured by your home. Draw what you need, when you need
            it &mdash; similar to a credit card, but with much lower rates.
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2 mb-6">
            <li>Revolving credit &mdash; borrow, repay, and borrow again during the draw period</li>
            <li>5&ndash;10 year draw period, followed by a 10&ndash;20 year repayment period</li>
            <li>Variable rate, typically tied to Prime</li>
            <li>Interest-only payments available during the draw period</li>
            <li>Best for ongoing expenses, renovations, or flexible cash needs</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-2">Closed-End Second (CES / Home Equity Loan)</h3>
          <p className="text-gray-700 mb-4">
            A one-time lump sum at a fixed rate. Predictable payments from day one &mdash; no
            surprises, no rate adjustments.
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            <li>Fixed lump sum disbursed at closing</li>
            <li>Fixed interest rate for the life of the loan</li>
            <li>Terms from 10 to 30 years</li>
            <li>Fully amortizing &mdash; principal and interest from the start</li>
            <li>Best for a known, one-time expense (debt consolidation, major purchase)</li>
          </ul>
        </section>

        {/* How Much Can You Borrow */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">How Much Can You Borrow?</h2>
          <p className="text-gray-700 mb-4">
            Your borrowing power depends on your combined loan-to-value (CLTV) ratio. Most
            second-lien programs allow a CLTV of 80&ndash;90%, meaning your first mortgage balance
            plus the new second lien can&apos;t exceed that percentage of your home&apos;s value.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-2">CLTV Example</h3>
          <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm border border-gray-200 rounded-lg">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 border-b border-gray-200">Factor</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 border-b border-gray-200">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-3 text-gray-700">Home Value</td>
                  <td className="px-4 py-3 font-medium text-gray-900">$600,000</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-3 text-gray-700">Current First Mortgage Balance</td>
                  <td className="px-4 py-3 font-medium text-gray-900">$350,000</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-3 text-gray-700">Max CLTV (80%)</td>
                  <td className="px-4 py-3 font-medium text-gray-900">$480,000</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-gray-700 font-semibold">Available Equity for Second Lien</td>
                  <td className="px-4 py-3 font-bold text-gray-900">$130,000</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm text-gray-500">
            Some programs allow up to 90% CLTV, which would increase available equity in this
            example to $190,000. Higher CLTV = higher rate adjustments.
          </p>
        </section>

        {/* Who Should Consider */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Who Should Consider a Second Lien?</h2>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            <li>Homeowners with a first mortgage rate below current market rates</li>
            <li>Borrowers who need cash for renovations, debt consolidation, or major expenses</li>
            <li>Investors looking to pull equity from a rental property without disrupting existing financing</li>
            <li>Anyone who wants to avoid the closing costs and timeline of a full cash-out refinance</li>
          </ul>
        </section>

        {/* What to Watch For */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">What to Watch For</h2>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            <li><strong>Variable vs. fixed:</strong> HELOC rates move with Prime &mdash; if rates rise, your payment rises too. A closed-end second locks in your rate.</li>
            <li><strong>Draw vs. repayment period:</strong> HELOC interest-only payments during the draw period can jump significantly when you enter repayment.</li>
            <li><strong>Balloon payments:</strong> Some HELOCs require the full balance at the end of the draw period. Know your terms.</li>
            <li><strong>Closing costs:</strong> Second liens typically have lower closing costs than a full refinance, but they&apos;re not zero. Ask for a full fee breakdown.</li>
            <li><strong>Subordination risk:</strong> If you ever refinance your first mortgage, the second lien holder must agree to stay in second position.</li>
          </ul>
        </section>

        {/* Quick Comparison */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">HELOC / Second Lien vs. Cash-Out Refinance</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-200 rounded-lg">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 border-b border-gray-200">Feature</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 border-b border-gray-200">HELOC / CES</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 border-b border-gray-200">Cash-Out Refinance</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-3 text-gray-700">Existing first mortgage</td>
                  <td className="px-4 py-3 font-medium text-gray-900">Stays in place</td>
                  <td className="px-4 py-3 text-gray-700">Replaced with new loan</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-3 text-gray-700">Your current low rate</td>
                  <td className="px-4 py-3 font-medium text-gray-900">Preserved</td>
                  <td className="px-4 py-3 text-gray-700">Lost &mdash; new rate on full balance</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-3 text-gray-700">Loan amount</td>
                  <td className="px-4 py-3 text-gray-700">Only the equity you need</td>
                  <td className="px-4 py-3 text-gray-700">Full payoff + cash out</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-3 text-gray-700">Closing costs</td>
                  <td className="px-4 py-3 font-medium text-gray-900">Lower</td>
                  <td className="px-4 py-3 text-gray-700">Higher (full loan amount)</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-3 text-gray-700">Rate type</td>
                  <td className="px-4 py-3 text-gray-700">Variable (HELOC) or Fixed (CES)</td>
                  <td className="px-4 py-3 text-gray-700">Fixed</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-gray-700">Best when</td>
                  <td className="px-4 py-3 font-medium text-gray-900">Your first rate is below market</td>
                  <td className="px-4 py-3 text-gray-700">Your first rate is at or above market</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* How Rates Work */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">How Second Lien Rates Work</h2>
          <p className="text-gray-700 mb-4">
            Second lien rates are higher than first mortgage rates because the lender is in a
            subordinate position &mdash; if the borrower defaults, the first mortgage gets paid
            first. Several factors drive your rate:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
            <li><strong>Lien position:</strong> Second liens carry more risk for the lender, which means higher rates than first mortgages.</li>
            <li><strong>CLTV:</strong> The higher your combined loan-to-value, the higher your rate. Borrowing to 90% CLTV costs more than 80%.</li>
            <li><strong>Credit score:</strong> As with any mortgage, stronger credit scores earn better pricing.</li>
            <li><strong>Property type:</strong> Primary residence typically gets the best rates; investment properties cost more.</li>
            <li><strong>Draw amount:</strong> Some lenders offer better pricing on larger credit lines.</li>
          </ul>
          <p className="text-gray-700">
            Want to understand the full picture?{' '}
            <Link href="/equity-without-losing-rate" className="text-brand hover:underline">
              Learn how to access equity without losing your rate &rarr;
            </Link>
          </p>
        </section>

        {/* Disclaimer */}
        <div className="border-t border-gray-200 pt-6 text-sm text-gray-500">
          <p className="mb-2">
            Rates shown are approximate and subject to change without notice. HELOC rates are
            variable and tied to the Prime rate &mdash; your rate and payment can increase over
            the life of the loan. Qualification is subject to underwriting approval, credit
            review, and property valuation.
          </p>
          <p>
            NetRate Mortgage LLC &mdash; NMLS #1111861. Equal Housing Lender.
          </p>
        </div>
      </div>
    </>
  );
}
