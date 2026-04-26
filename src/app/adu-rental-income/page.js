import Link from 'next/link'

export const metadata = {
  title: 'ADU Rental Income for Mortgage Qualifying — New Fannie Mae Rule | NetRate Mortgage',
  description: 'Fannie Mae now allows rental income from your ADU to count toward mortgage qualifying. Here\'s how it works, what qualifies, and what the limits are.',
  openGraph: {
    title: 'ADU Rental Income for Mortgage Qualifying — New Fannie Mae Rule',
    description: 'Fannie Mae now allows rental income from your ADU to count toward mortgage qualifying. Here\'s how it works, what qualifies, and what the limits are.',
    type: 'article',
    publishedTime: '2026-03-27T00:00:00Z',
    siteName: 'NetRate Mortgage',
    url: 'https://www.netratemortgage.com/adu-rental-income',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ADU Rental Income for Mortgage Qualifying — New Fannie Mae Rule',
    description: 'Fannie Mae now allows rental income from your ADU to count toward mortgage qualifying. Here\'s how it works, what qualifies, and what the limits are.',
  },
  alternates: {
    canonical: 'https://www.netratemortgage.com/adu-rental-income',
  },
}

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'ADU Rental Income for Mortgage Qualifying — New Fannie Mae Rule',
    description: 'Fannie Mae now allows rental income from your ADU to count toward mortgage qualifying. Here\'s how it works, what qualifies, and what the limits are.',
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
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Can ADU rental income help me qualify for a mortgage?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. As of March 21, 2026, Fannie Mae Desktop Underwriter (DU 12.1) allows projected rental income from an accessory dwelling unit on the subject property to count toward qualifying income on purchase and limited cash-out refinance transactions for primary residences.',
        },
      },
      {
        '@type': 'Question',
        name: 'How much ADU income can count toward mortgage qualifying?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'ADU rental income is capped at 30% of the borrower\'s total qualifying income. For example, if your employment income is $7,000 per month, the maximum ADU income that can be counted is $3,000 per month.',
        },
      },
      {
        '@type': 'Question',
        name: 'What types of properties qualify for ADU rental income?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The property must be a primary residence with one ADU. Eligible property types include single-family homes with a detached ADU, homes with a basement apartment or above-garage unit, properties with a converted guest house, and new construction with a planned ADU. The property cannot have more than one ADU.',
        },
      },
      {
        '@type': 'Question',
        name: 'Does ADU rental income work for cash-out refinance?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'No. The current rule applies only to purchase transactions and limited cash-out (rate/term) refinances. Full cash-out refinances are not eligible for ADU rental income qualifying.',
        },
      },
    ],
  },
]

export default function AduRentalIncome() {
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
          <span>ADU Rental Income for Mortgage Qualifying</span>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
          ADU Rental Income for Mortgage Qualifying &mdash; New Fannie Mae Rule
        </h1>

        <div className="space-y-8 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">What Changed</h2>
            <p>
              On March 21, 2026, Fannie Mae released Desktop Underwriter version 12.1, which introduced a significant change: projected rental income from an accessory dwelling unit (ADU) on the subject property can now count toward a borrower&apos;s qualifying income.
            </p>
            <p className="mt-4">
              This is a meaningful shift. Previously, ADU income could only be used if the borrower had a documented rental history for that specific unit. Now, projected rental income &mdash; supported by an appraisal or market rent analysis &mdash; can help borrowers qualify for the purchase of a home with an ADU, even before a tenant is in place.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Requirements at a Glance</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200 rounded-lg">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-3 border-b border-gray-200 font-semibold">Requirement</th>
                    <th className="text-left p-3 border-b border-gray-200 font-semibold">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-3 border-b border-gray-200 font-medium">Occupancy</td>
                    <td className="p-3 border-b border-gray-200">Primary residence only</td>
                  </tr>
                  <tr>
                    <td className="p-3 border-b border-gray-200 font-medium">Transaction type</td>
                    <td className="p-3 border-b border-gray-200">Purchase or limited cash-out refinance only</td>
                  </tr>
                  <tr>
                    <td className="p-3 border-b border-gray-200 font-medium">Number of ADUs</td>
                    <td className="p-3 border-b border-gray-200">One ADU on the property</td>
                  </tr>
                  <tr>
                    <td className="p-3 border-b border-gray-200 font-medium">Income cap</td>
                    <td className="p-3 border-b border-gray-200">ADU income limited to 30% of total qualifying income</td>
                  </tr>
                  <tr>
                    <td className="p-3 border-b border-gray-200 font-medium">Documentation</td>
                    <td className="p-3 border-b border-gray-200">Appraisal with market rent analysis or existing lease</td>
                  </tr>
                  <tr>
                    <td className="p-3 border-b border-gray-200 font-medium">Underwriting</td>
                    <td className="p-3 border-b border-gray-200">Must be submitted through DU 12.1 or later</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">How the Math Works</h2>
            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-2">Example 1: First-Time Buyer</h3>
            <p>
              A borrower earns $7,000/month from employment and is purchasing a single-family home with a detached ADU. The appraiser estimates the ADU would rent for $1,800/month. After the standard 25% vacancy factor, the usable ADU income is $1,350/month. Since $1,350 is under 30% of total qualifying income ($2,505), the full $1,350 counts.
            </p>
            <p className="mt-2">
              Total qualifying income: $7,000 + $1,350 = <strong>$8,350/month</strong>. That additional income could support roughly $50,000&ndash;$60,000 in additional borrowing capacity depending on the rate and other debts.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-2">Example 2: Higher ADU Rent, Cap Applies</h3>
            <p>
              A borrower earns $6,000/month. The ADU has an existing lease at $2,400/month. After the 25% vacancy factor, usable income is $1,800/month. But 30% of total qualifying income (before ADU) is $1,800 &mdash; so the cap allows the full $1,800 in this case. If the ADU rent were higher, the 30% cap would limit how much could be counted.
            </p>
            <p className="mt-2">
              Total qualifying income: $6,000 + $1,800 = <strong>$7,800/month</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">State-by-State Relevance</h2>
            <p>
              This rule applies nationally, but it&apos;s especially impactful in states where ADUs are common or where zoning has been loosened to encourage them.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-2">Colorado</h3>
            <p>
              Basement apartments are everywhere along the Front Range, from Denver to Boulder to Fort Collins. Many homes already have finished basements with separate entrances that qualify as ADUs. This rule makes those units financially productive for qualifying purposes. <Link href="/colorado-mortgage" className="text-brand hover:underline">Learn more about Colorado mortgage options</Link>.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-2">California</h3>
            <p>
              California leads the nation in ADU construction. State law (AB 68, SB 13, and subsequent legislation) has made it easier to build ADUs by right in most residential zones. With home prices among the highest in the country, the ability to count ADU income toward qualifying is a significant boost for buyers. <Link href="/california-mortgage" className="text-brand hover:underline">Learn more about California mortgage options</Link>.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-2">Oregon</h3>
            <p>
              Portland has been at the forefront of ADU-friendly zoning for over a decade. Oregon&apos;s statewide reforms (HB 2001) require cities to allow ADUs in single-family zones. The combination of supportive zoning and this new qualifying rule makes Oregon a strong market for ADU-equipped purchases. <Link href="/oregon-mortgage" className="text-brand hover:underline">Learn more about Oregon mortgage options</Link>.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-2">Texas</h3>
            <p>
              Austin has seen a growing casita and ADU market, especially in central neighborhoods. While Texas zoning varies more by city, the demand for secondary units is increasing. Buyers in Austin, San Antonio, and other metro areas can now factor ADU income into their qualifying picture. <Link href="/texas-mortgage" className="text-brand hover:underline">Learn more about Texas mortgage options</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">What Qualifies as an ADU</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Detached guest house or cottage with kitchen and bathroom</li>
              <li>Above-garage apartment</li>
              <li>Basement apartment with separate entrance</li>
              <li>Converted garage with full living facilities</li>
              <li>New construction ADU (planned or completed)</li>
              <li>Addition to the primary structure with separate access</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">What Doesn&apos;t Qualify</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Second home or investment property (must be primary residence)</li>
              <li>Properties with more than one ADU</li>
              <li>Full cash-out refinance transactions</li>
              <li>Rooms rented within the primary dwelling (boarder income has separate rules)</li>
              <li>Short-term rental income (Airbnb/VRBO) &mdash; this requires a different income documentation approach</li>
              <li>ADUs that don&apos;t meet local building code or permitting requirements</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Source</h2>
            <p>
              This rule was introduced in Fannie Mae Desktop Underwriter Version 12.1, effective March 21, 2026. PennyMac Announcement #26-15 provides additional implementation guidance for lenders.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">See How ADU Income Affects Your Qualifying</h2>
            <p>
              If you&apos;re looking at a property with an ADU &mdash; or already own one and want to refinance &mdash; we can run the numbers and show you exactly how much the rental income adds to your qualifying power.
            </p>
            <p className="mt-4">
              <Link href="/rates" className="inline-block bg-brand text-white px-6 py-3 rounded-lg hover:bg-brand-dark transition-colors font-medium">
                See Today&apos;s Rates &rarr;
              </Link>
            </p>
            <p className="mt-4">
              Or{' '}
              <Link href="/contact" className="text-brand hover:underline">reach out directly</Link>
              {' '}to walk through your scenario. You can also{' '}
              <a href="/book" className="text-brand hover:underline">book a call</a>
              {' '}at a time that works for you.
            </p>
          </section>

          <section className="border-t border-gray-200 pt-6 text-sm text-gray-500">
            <p className="font-medium mb-2">Sources</p>
            <ul className="list-disc pl-5 space-y-1 mb-4">
              <li>Fannie Mae Desktop Underwriter version 12.1 (March 21, 2026)</li>
              <li>PennyMac Announcement #26-15</li>
            </ul>
            <p>
              This article is for educational purposes only and does not constitute financial advice. Fannie Mae guidelines are subject to change. Lender overlays may apply. Contact a licensed mortgage professional for guidance specific to your situation. NetRate Mortgage LLC NMLS #1111861. Equal Housing Lender.
            </p>
          </section>
        </div>
      </article>
    </>
  )
}
