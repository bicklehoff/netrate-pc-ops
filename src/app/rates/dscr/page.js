import Link from 'next/link';
import DscrRateWidget from '@/components/DscrRateWidget';

export const metadata = {
  title: 'DSCR Loan Rates — Investment Property Mortgages | NetRate Mortgage',
  description: 'Live DSCR loan rates for investment property. No tax returns, no W-2s — qualify on rental income. Instant quote for 1–4 unit properties in CO, CA, TX, OR.',
  openGraph: {
    title: 'DSCR Loan Rates — Investment Property Mortgages | NetRate Mortgage',
    description: 'Live DSCR loan rates for investment property. No tax returns, no W-2s — qualify on rental income. Instant quote for 1–4 unit properties.',
    type: 'website',
    siteName: 'NetRate Mortgage',
    url: 'https://www.netratemortgage.com/rates/dscr',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DSCR Loan Rates — Investment Property Mortgages | NetRate Mortgage',
    description: 'Live DSCR loan rates for investment property. No tax returns, no W-2s — qualify on rental income.',
  },
  alternates: {
    canonical: 'https://www.netratemortgage.com/rates/dscr',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'DSCR Loan Rates',
  description: 'Live DSCR loan rates for investment property. Qualify on rental income, not personal income.',
  url: 'https://www.netratemortgage.com/rates/dscr',
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

export default function DscrRatesPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 mb-6" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-brand">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/rates" className="hover:text-brand">Rates</Link>
          <span className="mx-2">/</span>
          <Link href="/rates/non-qm" className="hover:text-brand">Non-QM</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900">DSCR</span>
        </nav>

        {/* Hero */}
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
          DSCR Loan Rates
        </h1>
        <p className="text-lg text-gray-700 mb-2">
          Real wholesale DSCR pricing &mdash; for 1&ndash;4 unit investment properties.
          Qualify on rental income, not W-2s.
        </p>
        <p className="text-gray-600 mb-8">
          Enter your scenario below to see live pricing across the rate ladder. No credit pull.
          No SSN. Pricing updates whenever the lender publishes a new sheet.
        </p>

        {/* Live widget */}
        <DscrRateWidget />

        {/* What is DSCR */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">What is a DSCR loan?</h2>
          <p className="text-gray-700 mb-4">
            DSCR stands for Debt Service Coverage Ratio. It&apos;s the simple math of whether a
            property pays for itself:
          </p>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-4 text-center">
            <div className="text-lg font-semibold text-gray-900 mb-1">DSCR = Monthly Rent &divide; Monthly PITIA</div>
            <div className="text-sm text-gray-500">(Principal + Interest + Taxes + Insurance + HOA)</div>
          </div>
          <p className="text-gray-700">
            A DSCR of 1.25 means the rent covers PITIA with 25% to spare. Lenders price DSCR loans
            based on that ratio &mdash; the stronger the cash flow, the better the pricing.
          </p>
        </section>

        {/* DSCR Tiers */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">DSCR Ratio Tiers</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-200 rounded-lg">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 border-b">DSCR</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 border-b">Meaning</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 border-b">Pricing impact</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">1.30+</td>
                  <td className="px-4 py-3 text-gray-700">Rent exceeds PITIA by 30%+</td>
                  <td className="px-4 py-3 text-gray-700">Best pricing &mdash; often a rate credit</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">1.15 &ndash; 1.29</td>
                  <td className="px-4 py-3 text-gray-700">Comfortably covers PITIA</td>
                  <td className="px-4 py-3 text-gray-700">Standard pricing</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">1.00 &ndash; 1.14</td>
                  <td className="px-4 py-3 text-gray-700">Rent just covers PITIA</td>
                  <td className="px-4 py-3 text-gray-700">Small LLPA</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-gray-900">Below 1.00</td>
                  <td className="px-4 py-3 text-gray-700">Rent falls short of PITIA</td>
                  <td className="px-4 py-3 text-gray-700">Limited LTV, larger LLPA</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Requirements */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">DSCR Requirements</h2>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            <li>Investment property only (no primary residence, no second home)</li>
            <li>Minimum FICO: 660 for most LTV bands, 700+ for best pricing</li>
            <li>Maximum LTV: 80% on SFR, 75% on 2&ndash;4 unit</li>
            <li>Minimum loan amount: $100K &middot; Maximum: $3M+ depending on tier</li>
            <li>Appraisal with rent schedule (1007) or signed lease required</li>
            <li>12 months PITIA reserves (2&ndash;4 unit), 6 months (SFR)</li>
            <li>No personal income documentation &mdash; no tax returns, no W-2s, no pay stubs</li>
            <li>Entity vesting allowed (LLC, trust)</li>
          </ul>
        </section>

        {/* Product variations */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">DSCR Product Variations</h2>
          <p className="text-gray-700 mb-3">
            Most DSCR loans are 30-year fixed or ARM. Common variations:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            <li><strong>30-year fixed</strong> &mdash; predictable payment for the life of the loan</li>
            <li><strong>7/6 ARM, 5/6 ARM, 10/6 ARM</strong> &mdash; lower intro rate, adjusts after fixed period</li>
            <li><strong>Interest-only</strong> &mdash; IO period (typically 10 yr) improves cash flow at cost of amortization</li>
            <li><strong>Prepay penalty options</strong> &mdash; 5/4/3/2/1 step-down reduces rate; 0-yr prepay costs ~0.5 pt</li>
            <li><strong>Short-term rental OK</strong> &mdash; Airbnb/VRBO properties qualify (LLPA applies)</li>
          </ul>
        </section>

        {/* How pricing works */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">How DSCR Pricing Works</h2>
          <p className="text-gray-700 mb-3">
            DSCR pricing starts with a base rate sheet, then adds LLPAs (loan-level price
            adjustments) for the specific scenario. Common LLPAs:
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
            <li>FICO &times; CLTV grid &mdash; higher FICO and lower LTV get the best pricing</li>
            <li>DSCR ratio band &mdash; strong cash flow earns a credit; weak cash flow costs points</li>
            <li>Property type &mdash; SFR is par; 2&ndash;4 unit, condo, non-warrantable condo take hits</li>
            <li>Loan size &mdash; very small loans ({'<'} $200K) and very large loans ({'>'} $1.5M) cost more</li>
            <li>Prepay penalty term &mdash; longer prepay = lower rate; no prepay = higher rate</li>
            <li>State SRP &mdash; some states add a small adjustment</li>
            <li>Feature add-ons &mdash; IO, short-term rental, foreign national each have a cost</li>
          </ul>
          <p className="text-gray-700">
            Learn more about{' '}
            <Link href="/how-pricing-works" className="text-brand hover:underline">how mortgage pricing works</Link>{' '}
            and how{' '}
            <Link href="/points-and-credits" className="text-brand hover:underline">points and credits</Link>{' '}
            translate to real dollars at closing.
          </p>
        </section>

        {/* CTAs */}
        <section className="mb-10 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
          <h2 className="text-lg font-bold text-gray-900 mb-2">Ready to run the numbers?</h2>
          <p className="text-sm text-gray-500 mb-5">
            The full DSCR calculator lets you model down payment, compare tiers, and see net cost to close.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/tools/dscr-calculator"
              className="bg-brand text-white px-6 py-2.5 rounded-lg font-bold hover:bg-brand-dark transition-colors"
            >
              Open DSCR calculator
            </Link>
            <Link
              href="/contact"
              className="border-2 border-brand text-brand px-6 py-2.5 rounded-lg font-medium hover:bg-brand hover:text-white transition-colors text-sm"
            >
              Talk to a DSCR specialist
            </Link>
          </div>
        </section>

        {/* Disclaimer */}
        <div className="border-t border-gray-200 pt-6 text-sm text-gray-500">
          <p className="mb-2">
            Rates shown are wholesale lender pricing before broker compensation. Final rate and
            price depend on complete underwriting, property appraisal, and lender approval.
            Not all programs are available in all states.
          </p>
          <p>
            NetRate Mortgage LLC &mdash; NMLS #1111861. Equal Housing Lender.
          </p>
        </div>
      </div>
    </>
  );
}
