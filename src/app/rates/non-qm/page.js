import Link from 'next/link';

export const metadata = {
  title: 'Non-QM Mortgage Rates — DSCR, Bank Statement, Foreign National | NetRate Mortgage',
  description: 'Non-QM mortgage rates for investors, self-employed borrowers, and foreign nationals. DSCR loans, bank statement programs, ITIN, and asset depletion. Updated daily.',
  openGraph: {
    title: 'Non-QM Mortgage Rates — DSCR, Bank Statement, Foreign National | NetRate Mortgage',
    description: 'Non-QM mortgage rates for investors, self-employed borrowers, and foreign nationals. DSCR loans, bank statement programs, ITIN, and asset depletion. Updated daily.',
    type: 'website',
    siteName: 'NetRate Mortgage',
    url: 'https://netratemortgage.com/rates/non-qm',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Non-QM Mortgage Rates — DSCR, Bank Statement, Foreign National | NetRate Mortgage',
    description: 'Non-QM mortgage rates for investors, self-employed borrowers, and foreign nationals. DSCR loans, bank statement programs, ITIN, and asset depletion. Updated daily.',
  },
  alternates: {
    canonical: 'https://netratemortgage.com/rates/non-qm',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Non-QM Mortgage Rates',
  description: 'Non-QM mortgage rates for investors, self-employed borrowers, and foreign nationals. DSCR loans, bank statement programs, ITIN, and asset depletion.',
  url: 'https://netratemortgage.com/rates/non-qm',
  publisher: {
    '@type': 'Organization',
    name: 'NetRate Mortgage',
    url: 'https://netratemortgage.com',
  },
  author: {
    '@type': 'Organization',
    name: 'NetRate Mortgage',
    url: 'https://netratemortgage.com',
  },
};

export default function NonQmRatesPage() {
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
          <span className="text-gray-900">Non-QM</span>
        </nav>

        {/* Hero */}
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
          Non-QM Mortgage Rates
        </h1>
        <p className="text-lg text-gray-700 mb-4">
          Not every borrower fits the conventional mold. If you&apos;re self-employed, an investor,
          a foreign national, or someone whose income doesn&apos;t show up neatly on a W-2 &mdash;
          Non-QM (Non-Qualified Mortgage) programs exist specifically for you.
        </p>
        <p className="text-gray-600 mb-10">
          These programs use alternative documentation and underwriting methods to qualify borrowers
          who have strong financials but don&apos;t meet agency guidelines. Rates are typically
          higher than conventional loans, but the flexibility can be worth it.
        </p>

        {/* Rate Tool Placeholder */}
        {/* TODO: Dev — wire rate tool component here, filtered to Non-QM products */}
        <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-12 text-center text-gray-400 mb-12">
          <p className="text-lg font-medium">Rate tool loading...</p>
          <p className="text-sm mt-2">Personalized rates coming soon. <Link href="/rates" className="text-brand hover:underline">See agency rates</Link></p>
        </div>

        {/* DSCR */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">DSCR Loans (Debt Service Coverage Ratio)</h2>
          <p className="text-gray-700 mb-4">
            DSCR loans qualify based on the property&apos;s rental income rather than your personal
            income. If the property cash-flows, you can qualify &mdash; no tax returns, no W-2s,
            no employment verification required.
          </p>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-2">DSCR Ratio Tiers</h3>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm border border-gray-200 rounded-lg">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 border-b border-gray-200">DSCR Ratio</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 border-b border-gray-200">Meaning</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700 border-b border-gray-200">Typical Impact</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">1.25+</td>
                  <td className="px-4 py-3 text-gray-700">Rent exceeds PITIA by 25%+</td>
                  <td className="px-4 py-3 text-gray-700">Best rates, lowest adjustments</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">1.00 &ndash; 1.24</td>
                  <td className="px-4 py-3 text-gray-700">Rent covers PITIA</td>
                  <td className="px-4 py-3 text-gray-700">Standard pricing</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-900">0.75 &ndash; 0.99</td>
                  <td className="px-4 py-3 text-gray-700">Rent falls short of PITIA</td>
                  <td className="px-4 py-3 text-gray-700">Higher rates, limited LTV</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium text-gray-900">No Ratio</td>
                  <td className="px-4 py-3 text-gray-700">No rental income considered</td>
                  <td className="px-4 py-3 text-gray-700">Highest rates, lowest LTV caps</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-2">DSCR Requirements</h3>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            <li>Investment property only (no primary residence)</li>
            <li>Minimum credit score: typically 660+</li>
            <li>Minimum down payment: 20&ndash;25%</li>
            <li>Appraisal with rent schedule or lease required</li>
            <li>Available for SFR, 2&ndash;4 unit, condos, and some 5&ndash;8 unit properties</li>
            <li>Loan amounts from $100K to $3M+ depending on lender</li>
            <li>No personal income documentation required</li>
          </ul>
        </section>

        {/* Bank Statement */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Bank Statement Programs</h2>
          <p className="text-gray-700 mb-4">
            Designed for self-employed borrowers who show less income on tax returns than they
            actually earn. Instead of tax returns, lenders analyze 12&ndash;24 months of bank
            statements to calculate qualifying income.
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            <li>12 or 24 months of personal or business bank statements</li>
            <li>Minimum credit score: typically 620+</li>
            <li>Must be self-employed for at least 2 years</li>
            <li>CPA letter or P&amp;L may be required</li>
            <li>Primary residence, second home, or investment property</li>
            <li>Down payment: 10&ndash;20% depending on credit and property type</li>
          </ul>
        </section>

        {/* Asset Depletion */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Asset Depletion</h2>
          <p className="text-gray-700 mb-4">
            For high-net-worth borrowers with significant liquid assets but limited traditional
            income. The lender divides your eligible assets over a set period (typically 60&ndash;84
            months) to calculate a monthly qualifying income.
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            <li>Minimum credit score: typically 680+</li>
            <li>Eligible assets: checking, savings, investment accounts, retirement (discounted)</li>
            <li>Divisor: 60&ndash;84 months depending on lender</li>
            <li>No employment or income documentation required</li>
            <li>Primary residence, second home, or investment</li>
            <li>Ideal for retirees, high-net-worth individuals, and trust-funded borrowers</li>
          </ul>
        </section>

        {/* Foreign National */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Foreign National</h2>
          <p className="text-gray-700 mb-4">
            For non-US citizens who want to purchase investment property in the United States.
            No SSN or US credit history required &mdash; qualification is based on the property
            and borrower&apos;s global financial profile.
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            <li>Valid passport required</li>
            <li>Investment property only (no primary residence)</li>
            <li>Minimum down payment: 25%</li>
            <li>Maximum loan amount: typically $1.5M</li>
            <li>Reserves: 12&ndash;18 months PITIA</li>
            <li>No US credit score required (international credit may be reviewed)</li>
          </ul>
        </section>

        {/* ITIN */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">ITIN Loans</h2>
          <p className="text-gray-700 mb-4">
            For borrowers with an Individual Taxpayer Identification Number instead of a Social
            Security Number. These programs provide a path to homeownership for residents who
            file US taxes but aren&apos;t eligible for a SSN.
          </p>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            <li>Valid ITIN required</li>
            <li>2 years of US tax returns filed with ITIN</li>
            <li>Primary residence or investment property</li>
            <li>Minimum credit score varies by lender (alternative credit may be accepted)</li>
            <li>Down payment: 15&ndash;25% depending on program</li>
          </ul>
        </section>

        {/* How Non-QM Rates Compare */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">How Non-QM Rates Compare</h2>
          <p className="text-gray-700 mb-4">
            Non-QM rates are generally higher than conventional or government loan rates. The
            premium reflects the added risk and flexibility these programs offer. Expect rates
            to run 1&ndash;3% above comparable agency products, depending on the program,
            credit score, LTV, and documentation type.
          </p>
          <p className="text-gray-700 mb-4">
            That said, Non-QM rates have come down significantly in recent years as more
            investors enter the space. Competition is driving better pricing, especially for
            DSCR and bank statement programs with strong borrower profiles.
          </p>
          <p className="text-gray-700">
            Understanding how pricing adjustments work can help you position yourself for the
            best rate. Learn more about{' '}
            <Link href="/how-pricing-works" className="text-brand hover:underline">how mortgage pricing works</Link>{' '}
            and how{' '}
            <Link href="/points-and-credits" className="text-brand hover:underline">points and credits</Link>{' '}
            can shift your rate up or down.
          </p>
        </section>

        {/* Disclaimer */}
        <div className="border-t border-gray-200 pt-6 text-sm text-gray-500">
          <p className="mb-2">
            Rates shown are approximate and subject to change without notice. Non-QM programs
            have specific eligibility requirements that vary by lender and investor. Not all
            programs are available in all states. Qualification is subject to underwriting
            approval.
          </p>
          <p>
            NetRate Mortgage LLC &mdash; NMLS #1111861. Equal Housing Lender.
          </p>
        </div>
      </div>
    </>
  );
}
