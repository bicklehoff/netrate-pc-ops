import Link from 'next/link'

export const metadata = {
  title: 'How to Finance an Airbnb or Short-Term Rental Property | NetRate Mortgage',
  description: 'Yes, you can get a mortgage on a short-term rental property. DSCR loans qualify on rental income — no W-2s, no tax returns. Here\'s how it works.',
  openGraph: {
    type: 'article',
    publishedTime: '2026-03-27T00:00:00Z',
    siteName: 'NetRate Mortgage',
    title: 'How to Finance an Airbnb or Short-Term Rental Property',
    description: 'Yes, you can get a mortgage on a short-term rental property. DSCR loans qualify on rental income — no W-2s, no tax returns. Here\'s how it works.',
    url: 'https://www.netratemortgage.com/airbnb-financing',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How to Finance an Airbnb or Short-Term Rental Property',
    description: 'DSCR loans qualify on rental income — no W-2s, no tax returns. Here\'s how it works.',
  },
  alternates: {
    canonical: 'https://www.netratemortgage.com/airbnb-financing',
  },
}

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'How to Finance an Airbnb or Short-Term Rental Property',
    description: 'Yes, you can get a mortgage on a short-term rental property. DSCR loans qualify on rental income — no W-2s, no tax returns. Here\'s how it works.',
    datePublished: '2026-03-27T00:00:00Z',
    author: {
      '@type': 'Organization',
      name: 'NetRate Mortgage',
      url: 'https://www.netratemortgage.com',
    },
    publisher: {
      '@type': 'Organization',
      name: 'NetRate Mortgage',
      url: 'https://www.netratemortgage.com',
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': 'https://www.netratemortgage.com/airbnb-financing',
    },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Can you finance an Airbnb property?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. DSCR (Debt Service Coverage Ratio) loans are designed specifically for investment properties including short-term rentals. They qualify based on the property\'s rental income rather than your personal income, so no W-2s or tax returns are required. These are investment-only loans with a typical down payment of 20-25%.',
        },
      },
      {
        '@type': 'Question',
        name: 'What is a DSCR loan for short-term rentals?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'A DSCR loan measures whether the property\'s rental income covers the mortgage payment. The ratio is calculated by dividing net rental income by the total monthly payment (PITIA). For short-term rentals, lenders apply a 20% expense factor to gross rent to account for platform fees, cleaning, furnishing, and vacancy. A DSCR of 1.0 or higher means the property covers its own payment.',
        },
      },
      {
        '@type': 'Question',
        name: 'What documentation do I need for STR financing?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Lenders accept several forms of income documentation for short-term rentals: a Form 1007 single-family comparable rent schedule, an AIRDNA Rentalizer report projecting market rents, 12 months of platform booking history from Airbnb or VRBO, or bank statements showing rental deposits. The documentation accepted depends on whether the property is a new purchase or a refinance.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can I refinance an existing Airbnb property?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. If you already own a short-term rental, you can refinance into a DSCR loan using your actual rental history. Twelve months of platform booking history or bank statements showing rental income make documentation straightforward. This can be useful for pulling equity out to buy another property or lowering your rate.',
        },
      },
    ],
  },
]

export default function AirbnbFinancingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <article className="max-w-3xl mx-auto px-6 py-16">
        <nav className="text-sm text-gray-500 mb-8">
          <Link href="/" className="text-brand hover:underline">Home</Link>
          <span className="mx-2">/</span>
          <span>Airbnb Financing</span>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
          How to Finance an Airbnb or Short-Term Rental Property
        </h1>

        <div className="space-y-8 text-gray-700 leading-relaxed">
          <section>
            <p>
              Short-term rental properties can be excellent investments, but financing them works differently than a traditional home purchase. Conventional lenders often won&apos;t count Airbnb income for qualifying. The solution is a DSCR loan &mdash; a mortgage product designed specifically for investment properties that qualifies on the property&apos;s rental income, not yours.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              How DSCR Works for Short-Term Rentals
            </h2>
            <p>
              DSCR stands for Debt Service Coverage Ratio. It measures whether the property&apos;s income covers its mortgage payment. For short-term rentals, lenders apply a 20% expense factor to gross rental income to account for platform fees, cleaning costs, furnishing, and vacancy.
            </p>

            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm border border-gray-200 rounded-lg">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-3 border-b border-gray-200 font-semibold">Line Item</th>
                    <th className="text-left p-3 border-b border-gray-200 font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="p-3">Gross Monthly Rent</td>
                    <td className="p-3">$4,000</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="p-3">Minus 20% Expense Factor</td>
                    <td className="p-3">-$800</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="p-3 font-medium">Net Rental Income</td>
                    <td className="p-3 font-medium">$3,200</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="p-3">Monthly PITIA (Principal, Interest, Taxes, Insurance, HOA)</td>
                    <td className="p-3">$2,800</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">DSCR Ratio</td>
                    <td className="p-3 font-medium">1.14 ($3,200 &divide; $2,800)</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4">
              A DSCR of 1.0 means the property breaks even. Above 1.0, it cash flows. Most lenders want to see at least 1.0, and better ratios get better pricing.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Income Documentation Options
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200 rounded-lg">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-3 border-b border-gray-200 font-semibold">Documentation Type</th>
                    <th className="text-left p-3 border-b border-gray-200 font-semibold">What It Is</th>
                    <th className="text-left p-3 border-b border-gray-200 font-semibold">Best For</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="p-3 font-medium">Form 1007</td>
                    <td className="p-3">Single-family comparable rent schedule prepared by an appraiser</td>
                    <td className="p-3">New purchases with no rental history</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="p-3 font-medium">AIRDNA Rentalizer</td>
                    <td className="p-3">Market-based projection of short-term rental income for the specific property</td>
                    <td className="p-3">New purchases &mdash; shows STR-specific income potential</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="p-3 font-medium">12-Month Platform History</td>
                    <td className="p-3">Actual booking and income data from Airbnb, VRBO, or other platforms</td>
                    <td className="p-3">Refinancing an existing STR</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">Bank Statements</td>
                    <td className="p-3">12 months of deposits showing rental income</td>
                    <td className="p-3">Refinancing with income from multiple platforms or direct bookings</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              DSCR Loan Requirements for STR
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200 rounded-lg">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-3 border-b border-gray-200 font-semibold">Requirement</th>
                    <th className="text-left p-3 border-b border-gray-200 font-semibold">Typical Guideline</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="p-3 font-medium">Property Use</td>
                    <td className="p-3">Investment only &mdash; cannot be your primary residence</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="p-3 font-medium">Down Payment</td>
                    <td className="p-3">20&ndash;25% (75&ndash;80% LTV)</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="p-3 font-medium">Credit Score</td>
                    <td className="p-3">620 minimum, better pricing at 700+</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="p-3 font-medium">Loan Amounts</td>
                    <td className="p-3">Up to $3.5M</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="p-3 font-medium">Income Documentation</td>
                    <td className="p-3">None required from borrower &mdash; qualification is based on property income</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">Reserves</td>
                    <td className="p-3">6&ndash;12 months PITIA depending on DSCR and credit</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Condo Hotels and Unique Properties
            </h2>
            <p>
              Condo hotels &mdash; units in properties that operate as hotels but are individually owned &mdash; are a popular choice for short-term rental investors. Not all DSCR lenders finance condo hotels, but programs do exist. The key requirements are typically a higher down payment (25&ndash;30%) and the property must be in an approved project. If you&apos;re looking at a condo hotel in a resort market, ask about eligibility before making an offer.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Refinancing an Existing Short-Term Rental
            </h2>
            <p>
              If you already own a short-term rental, refinancing into a DSCR loan can be straightforward &mdash; especially if you have 12 months of booking history. Common reasons to refinance include pulling equity out to purchase another property, lowering your interest rate, or moving from a conventional loan that required you to qualify on personal income.
            </p>
            <p className="mt-4">
              Your actual platform history and bank statements make the income documentation piece simple. The property&apos;s track record speaks for itself.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              The 20% Expense Factor Explained
            </h2>
            <p>
              Lenders don&apos;t use your gross rent number directly. They apply a 20% expense factor to account for the real costs of running a short-term rental:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong>Platform fees</strong> &mdash; Airbnb and VRBO charge 3&ndash;15% of each booking</li>
              <li><strong>Cleaning and turnover costs</strong> &mdash; professional cleaning between guests</li>
              <li><strong>Furnishing and maintenance</strong> &mdash; STR properties require more upkeep than long-term rentals</li>
              <li><strong>Vacancy</strong> &mdash; seasonal gaps and booking fluctuations</li>
            </ul>
            <p className="mt-4">
              This 20% haircut is standard across most DSCR lenders for short-term rental properties. Long-term rentals typically don&apos;t have this adjustment.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Next Steps
            </h2>
            <p>
              Whether you&apos;re buying your first Airbnb property or refinancing an existing one, the process starts with understanding the numbers. Check{' '}
              <Link href="/rates/non-qm" className="text-brand hover:underline">current non-QM rates</Link>{' '}
              to see where DSCR pricing stands today.
            </p>
            <p className="mt-4">
              Ready to talk specifics?{' '}
              <Link href="/contact" className="text-brand hover:underline">Contact us</Link> or{' '}
              <a href="/book" className="text-brand hover:underline">book a call</a> to run the numbers on a property you&apos;re considering.
            </p>
          </section>

          <div className="mt-8">
            <Link
              href="/rates"
              className="inline-block bg-brand text-white px-6 py-3 rounded-lg hover:bg-brand-dark transition-colors font-medium"
            >
              View Today&apos;s Rates &rarr;
            </Link>
          </div>

          <section className="border-t border-gray-200 pt-6 text-sm text-gray-500">
            <p className="font-medium mb-2">Sources</p>
            <ul className="list-disc pl-5 space-y-1 mb-4">
              <li>theLender (Hometown Equity Mortgage) theNONI Product Matrix</li>
              <li>AIRDNA Rentalizer documentation</li>
            </ul>
            <p>
              This information is provided for educational purposes and does not constitute financial advice. DSCR loan programs, requirements, and pricing vary by lender and are subject to change. Investment property loans carry different terms and risks than primary residence financing. Rental income projections are not guaranteed. Contact a licensed loan officer to discuss your specific situation. NetRate Mortgage LLC NMLS #1111861. Equal Housing Lender.
            </p>
          </section>
        </div>
      </article>
    </>
  )
}
