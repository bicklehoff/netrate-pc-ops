import Link from 'next/link';
import { OG_IMAGES, TWITTER_IMAGES } from '@/lib/og';

export const metadata = {
  title: 'California Housing Update: SB 79 Transit Housing + New Condo Rules | NetRate Mortgage',
  description: 'California is building more housing near transit and Fannie Mae just made condo financing easier. Here\'s what changed and what it means if you\'re buying or refinancing.',
  openGraph: {
    title: 'California Housing Update: SB 79 Transit Housing + New Condo Rules',
    description: 'California is building more housing near transit and Fannie Mae just made condo financing easier. Here\'s what changed and what it means if you\'re buying or refinancing.',
    type: 'article',
    publishedTime: '2026-03-27T00:00:00Z',
    siteName: 'NetRate Mortgage',
    url: 'https://www.netratemortgage.com/california-housing-update',
    images: OG_IMAGES,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'California Housing Update: SB 79 Transit Housing + New Condo Rules',
    description: 'California is building more housing near transit and Fannie Mae just made condo financing easier. Here\'s what changed and what it means if you\'re buying or refinancing.',
    images: TWITTER_IMAGES,
  },
  alternates: {
    canonical: 'https://www.netratemortgage.com/california-housing-update',
  },
}

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'California Housing Update: SB 79 Transit Housing + New Condo Rules',
    description: 'California is building more housing near transit and Fannie Mae just made condo financing easier. Here\'s what changed and what it means if you\'re buying or refinancing.',
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
        name: 'What is California SB 79?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'SB 79 is a California law taking effect July 1, 2026 that streamlines housing development near major transit stations. It applies to eight counties in the Bay Area and Southern California, allowing increased density and reduced parking requirements for projects within a half-mile of qualifying transit stops.',
        },
      },
      {
        '@type': 'Question',
        name: 'How do new condo rules affect California buyers?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Fannie Mae Lender Letter 2026-03 removes the investor concentration limit that previously blocked financing in buildings where more than 50% of units were investor-owned. It also provides insurance relief for HOAs, raises the allowable deductible cap, and expands project review waivers. These changes make it easier to get a conventional loan on condos that were previously ineligible.',
        },
      },
      {
        '@type': 'Question',
        name: 'What dates should California condo owners know?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Key dates: July 1, 2026 for SB 79 taking effect and transit-oriented development streamlining; August 1, 2026 for Fannie Mae investor concentration retirement and insurance relief changes; and January 1, 2027 for expanded project review waivers.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can I refinance my California condo now?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'If your condo was previously blocked due to investor concentration limits, wait until August 1, 2026 when that restriction is retired. If your condo has other eligibility issues like pending litigation or budget shortfalls, the expanded waiver program starting January 1, 2027 may help. If your condo is already eligible, you can refinance now at current rates.',
        },
      },
    ],
  },
]

export default function CaliforniaHousingUpdate() {
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
          <Link href="/california" className="text-brand hover:underline">California</Link>
          <span className="mx-2">/</span>
          <span>Housing Update: SB 79 + Condo Rules</span>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
          California Housing Update: SB 79 Transit Housing + New Condo Rules
        </h1>

        <div className="space-y-8 text-gray-700 leading-relaxed">
          <section>
            <p>
              Two changes are converging that affect California homebuyers and condo owners. One is a state law &mdash; SB 79 &mdash; that streamlines housing development near transit stations. The other is a Fannie Mae policy update that removes longstanding barriers to condo financing. Together, they should expand inventory and improve access to conventional mortgage financing in the state&apos;s most supply-constrained markets.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">SB 79: Transit-Oriented Development</h2>
            <p>
              California Senate Bill 79 takes effect on <strong>July 1, 2026</strong>. The law creates a streamlined approval process for housing projects built within a half-mile of major transit stations in eight counties: Los Angeles, Orange, San Diego, San Bernardino, Riverside, San Francisco, Alameda, and Santa Clara.
            </p>
            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-2">What SB 79 Does</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Allows increased density for residential projects near qualifying transit stops</li>
              <li>Reduces or eliminates minimum parking requirements for transit-adjacent developments</li>
              <li>Streamlines the local approval process &mdash; qualifying projects get ministerial (by-right) approval</li>
              <li>Applies to both rental and for-sale housing, including condominiums</li>
              <li>Requires an affordability component for projects above a certain size</li>
            </ul>
            <p className="mt-4">
              For buyers, SB 79 means more condos and townhomes coming to market in transit-rich areas over the next few years. For existing condo owners near transit, it could mean increased competition but also improved neighborhood amenities and property values as areas densify.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Fannie Mae Condo Rule Changes (LL-2026-03)</h2>
            <p>
              Fannie Mae Lender Letter 2026-03 overhauls several condo project eligibility rules that have blocked financing in California buildings for years. Here&apos;s what&apos;s changing.
            </p>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm border border-gray-200 rounded-lg">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-3 border-b border-gray-200 font-semibold">Change</th>
                    <th className="text-left p-3 border-b border-gray-200 font-semibold">Old Rule</th>
                    <th className="text-left p-3 border-b border-gray-200 font-semibold">New Rule</th>
                    <th className="text-left p-3 border-b border-gray-200 font-semibold">Effective</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-3 border-b border-gray-200 font-medium">Investor concentration</td>
                    <td className="p-3 border-b border-gray-200">Blocked if &gt;50% investor-owned</td>
                    <td className="p-3 border-b border-gray-200">Limit retired entirely</td>
                    <td className="p-3 border-b border-gray-200">Aug 1, 2026</td>
                  </tr>
                  <tr>
                    <td className="p-3 border-b border-gray-200 font-medium">Insurance relief</td>
                    <td className="p-3 border-b border-gray-200">Full replacement cost required</td>
                    <td className="p-3 border-b border-gray-200">Allows gap coverage and alternative structures</td>
                    <td className="p-3 border-b border-gray-200">Aug 1, 2026</td>
                  </tr>
                  <tr>
                    <td className="p-3 border-b border-gray-200 font-medium">Deductible cap</td>
                    <td className="p-3 border-b border-gray-200">$10,000 or 1% of coverage</td>
                    <td className="p-3 border-b border-gray-200">Raised to $25,000 or 5% of coverage</td>
                    <td className="p-3 border-b border-gray-200">Aug 1, 2026</td>
                  </tr>
                  <tr>
                    <td className="p-3 border-b border-gray-200 font-medium">Project review waiver</td>
                    <td className="p-3 border-b border-gray-200">Limited to established projects</td>
                    <td className="p-3 border-b border-gray-200">Expanded to more project types and LTV tiers</td>
                    <td className="p-3 border-b border-gray-200">Jan 1, 2027</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4">
              The investor concentration change alone is significant. In cities like Los Angeles, San Francisco, and San Diego, many condo buildings exceed 50% investor ownership &mdash; especially smaller buildings with 10&ndash;20 units. Under the old rule, buyers in those buildings couldn&apos;t get conventional financing. That restriction goes away on August 1.
            </p>
            <p className="mt-4">
              For a deeper look at how all the condo rule changes work, see our{' '}
              <Link href="/condo-rules-changed" className="text-brand hover:underline">full condo rules breakdown</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">The Combined Effect</h2>
            <p>
              These two changes work in tandem. SB 79 will produce more condo and townhome inventory near California transit stations over the coming years. The Fannie Mae condo rule changes make it easier to finance those units &mdash; and the existing units in buildings that were previously blocked.
            </p>
            <p className="mt-4">
              For buyers, this means more options and fewer financing dead ends. For existing condo owners who&apos;ve been stuck with unfavorable loan terms because their building failed Fannie Mae&apos;s project review, refinancing may finally become an option.
            </p>
            <p className="mt-4">
              The impact will be felt most in California&apos;s dense metro cores &mdash; downtown LA, San Francisco, Oakland, San Jose, and San Diego &mdash; where both transit access and condo concentration are highest.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">What&apos;s Coming &mdash; Timeline</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200 rounded-lg">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-3 border-b border-gray-200 font-semibold">Date</th>
                    <th className="text-left p-3 border-b border-gray-200 font-semibold">What Happens</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-3 border-b border-gray-200 font-medium">July 1, 2026</td>
                    <td className="p-3 border-b border-gray-200">SB 79 takes effect &mdash; transit-oriented development streamlining begins in 8 counties</td>
                  </tr>
                  <tr>
                    <td className="p-3 border-b border-gray-200 font-medium">August 1, 2026</td>
                    <td className="p-3 border-b border-gray-200">Fannie Mae retires investor concentration limit, implements insurance relief and deductible cap changes</td>
                  </tr>
                  <tr>
                    <td className="p-3 border-b border-gray-200 font-medium">January 1, 2027</td>
                    <td className="p-3 border-b border-gray-200">Expanded project review waivers take effect &mdash; more condos eligible for streamlined financing</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">What This Means for You</h2>
            <p>
              <strong>If you&apos;re buying a condo in California:</strong> Check whether your target building was previously blocked by investor concentration rules. If so, you may want to time your purchase for after August 1 when conventional financing becomes available, potentially saving you from higher-rate non-warrantable condo loans.
            </p>
            <p className="mt-4">
              <strong>If you own a California condo and want to refinance:</strong> If your building failed Fannie Mae project review due to investor concentration, insurance issues, or deductible caps, one of these upcoming changes may resolve the problem. We can check your building&apos;s eligibility and tell you which date to target.
            </p>
            <p className="mt-4">
              <strong>If you&apos;re looking at new construction near transit:</strong> SB 79 will bring more options to market, but the first projects under the new streamlined process won&apos;t deliver units for 18&ndash;24 months. In the meantime, existing transit-adjacent condos that become newly financeable on August 1 are the most immediate opportunity.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Check Your California Condo&apos;s Eligibility</h2>
            <p>
              Not sure if your building qualifies for conventional financing today &mdash; or if it will after the August changes? We can run a project review check and let you know where things stand.
            </p>
            <p className="mt-4">
              <Link href="/rates" className="inline-block bg-brand text-white px-6 py-3 rounded-lg hover:bg-brand-dark transition-colors font-medium">
                See Today&apos;s Rates &rarr;
              </Link>
            </p>
            <p className="mt-4">
              Or{' '}
              <Link href="/contact" className="text-brand hover:underline">reach out directly</Link>
              {' '}to discuss your situation. You can also{' '}
              <a href="/book" className="text-brand hover:underline">book a call</a>
              {' '}at a time that works for you.
            </p>
          </section>

          <section className="border-t border-gray-200 pt-6 text-sm text-gray-500">
            <p className="font-medium mb-2">Sources</p>
            <ul className="list-disc pl-5 space-y-1 mb-4">
              <li>California SB 79 (signed October 10, 2025, effective July 1, 2026)</li>
              <li>Fannie Mae Lender Letter LL-2026-03 (March 18, 2026)</li>
            </ul>
            <p>
              This article is for educational purposes only and does not constitute financial advice. Legislative and agency guidelines are subject to change. Condo project eligibility depends on individual building characteristics and lender overlays. Contact a licensed mortgage professional for guidance specific to your situation. NetRate Mortgage LLC NMLS #1111861. Equal Housing Lender.
            </p>
          </section>
        </div>
      </article>
    </>
  )
}
