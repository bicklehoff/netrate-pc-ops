import Link from 'next/link';
import { OG_IMAGES, TWITTER_IMAGES } from '@/lib/og';

export const metadata = {
  title: 'New Condo Mortgage Rules: What Changed and Why It Matters | NetRate Mortgage',
  description: 'Fannie Mae just retired the investor concentration limit for condos. If your building was blocked from conventional financing because too many units were rentals, that rule is gone.',
  openGraph: {
    title: 'New Condo Mortgage Rules: What Changed and Why It Matters',
    description: 'Fannie Mae just retired the investor concentration limit for condos. If your building was blocked from conventional financing because too many units were rentals, that rule is gone.',
    url: 'https://www.netratemortgage.com/condo-rules-changed',
    siteName: 'NetRate Mortgage',
    type: 'article',
    publishedTime: '2026-03-27T00:00:00Z',
    images: OG_IMAGES,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'New Condo Mortgage Rules: What Changed and Why It Matters',
    description: 'Fannie Mae just retired the investor concentration limit for condos. If your building was blocked from conventional financing, that rule is gone.',
    images: TWITTER_IMAGES,
  },
  alternates: {
    canonical: 'https://www.netratemortgage.com/condo-rules-changed',
  },
};

// Article + FAQPage structured data
const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'A Rule That Was Blocking Your Condo Loan Just Changed',
    description: 'Fannie Mae just retired the investor concentration limit for condos. If your building was blocked from conventional financing because too many units were rentals, that rule is gone.',
    datePublished: '2026-03-27',
    dateModified: '2026-03-27',
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
      '@id': 'https://www.netratemortgage.com/condo-rules-changed',
    },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What changed with Fannie Mae condo rules in 2026?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Fannie Mae published Lender Letter LL-2026-03 on March 18, 2026, retiring the 50% investor concentration limit for established condo projects. Buildings with high rental ratios can now qualify for conventional financing. Insurance requirements were also relaxed, and the waiver of project review was expanded to buildings with 10 or fewer units.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can I refinance my condo if more than 50% of units are rentals?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. As of March 18, 2026, Fannie Mae removed the investor concentration limit for established condo projects. Buildings that were previously blocked because more than 50% of units were non-owner-occupied can now qualify for conventional mortgage financing.',
        },
      },
      {
        '@type': 'Question',
        name: 'What is the new condo reserve requirement?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Starting January 4, 2027, the minimum reserve allocation for condo projects increases from 10% to 15% of annual budgeted assessment income. HOAs that don\'t meet this threshold could lose conventional financing eligibility for their building.',
        },
      },
      {
        '@type': 'Question',
        name: 'When does Fannie Mae Limited Review end for condos?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Fannie Mae is retiring the Limited Review process on August 3, 2026. After that date, every established condo project will need either a Full Review or qualify for the Waiver of Project Review (available for buildings with 10 or fewer units).',
        },
      },
    ],
  },
];

export default function CondoRulesChanged() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="max-w-3xl mx-auto px-6 py-16">
        <nav className="text-sm text-gray-400 mb-8">
          <Link href="/" className="hover:text-brand">Home</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-600">Condo Rules Changed</span>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
          A Rule That Was Blocking Your Condo Loan Just Changed
        </h1>

        <div className="space-y-8 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">If You Own a Condo, This Affects You</h2>
            <p>
              Until last week, there was a rule that most condo owners didn&apos;t know existed &mdash; and it was costing them money.
            </p>
            <p className="mt-4">
              If more than 50% of the units in your condo building were owned by investors &mdash; rentals, Airbnbs, second homes that aren&apos;t owner-occupied &mdash; the entire building was ineligible for conventional mortgage financing. Not just the investors. Everyone. Including you, living in your unit, paying your mortgage, minding your own business.
            </p>
            <p className="mt-4">
              That meant if you wanted to refinance, you couldn&apos;t get a conventional loan. If you wanted to sell, your buyer couldn&apos;t either. The only options were portfolio loans (harder to get, worse terms) or cash buyers (fewer of them, lower offers).
            </p>
            <p className="mt-4">
              You didn&apos;t do anything wrong. You just lived in a building where too many of your neighbors rented their units out. And Fannie Mae treated the whole building like a risk.
            </p>
            <p className="mt-4">
              <strong>On March 18, 2026, Fannie Mae retired that rule.</strong> The 50% investor concentration limit is gone for established condo projects. Lenders can implement the change immediately.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">What Actually Changed</h2>
            <p>
              Fannie Mae published Lender Letter LL-2026-03 on March 18, 2026. Here&apos;s what matters if you own a condo or you&apos;re looking to buy one:
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-2">The investor concentration limit is gone</h3>
            <p>
              The old rule: if more than 50% of units in a condo building were non-owner-occupied, the building couldn&apos;t get conventional financing through a Full Review.
            </p>
            <p className="mt-4">
              The new rule: there is no investor concentration limit for established projects. A building that&apos;s 70% rentals can now qualify for conventional loans &mdash; for owner-occupants, investors, everyone.
            </p>
            <p className="mt-4">This is effective immediately. Lenders don&apos;t have to wait.</p>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-2">Condo insurance just got more flexible</h3>
            <p>Fannie Mae also changed the insurance requirements for condo buildings:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong>Roofs no longer need full replacement cost coverage.</strong> Actual cash value (ACV) coverage is now acceptable. This was a major issue &mdash; the old rule priced many HOAs out of the insurance market entirely, which made their buildings ineligible for conventional loans. That bottleneck is gone.</li>
              <li><strong>Deductible cap: $50,000 per unit</strong> on master property insurance policies, effective July 1, 2026. This gives lenders a clear standard instead of the inconsistent decisions that were happening before.</li>
              <li><strong>Inflation guard requirement removed.</strong> One less hurdle for HOAs trying to maintain adequate coverage.</li>
            </ul>
            <p className="mt-4">
              For buildings that lost eligibility because they couldn&apos;t afford replacement cost insurance &mdash; especially in wildfire-prone areas of California or hail-prone areas of Colorado &mdash; these changes could bring them back into the conventional lending market.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-2">Small buildings get a shortcut</h3>
            <p>
              Fannie Mae expanded the Waiver of Project Review from buildings with 4 or fewer units to buildings with <strong>10 or fewer units.</strong> If the project isn&apos;t part of a larger development, it can skip the full review process entirely. That means less paperwork, less time, and less cost for buyers in smaller condo communities.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-2">The &ldquo;limited review&rdquo; is going away</h3>
            <p>
              Here&apos;s the trade-off. Fannie Mae is retiring the Limited Review process &mdash; which handled about 40% of all condo project reviews. Starting August 3, 2026, every established condo project will need a Full Review (or qualify for the Waiver described above).
            </p>
            <p className="mt-4">
              Full Reviews require more documentation from the HOA and more verification from the lender. That means more time per transaction and more work for condo associations to stay compliant.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-2">Reserve requirements are going up</h3>
            <p>
              Starting January 4, 2027, the minimum reserve allocation for condo projects goes from 10% to 15% of the annual budgeted assessment income. HOAs that don&apos;t meet this threshold could lose their conventional financing eligibility &mdash; which affects every owner in the building.
            </p>
            <p className="mt-4">
              If your HOA is currently at 10% reserves, your board needs to start planning now. January 2027 is not far away, and raising assessments to hit 15% takes time and board approval.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Who This Helps</h2>
            <p>
              <strong>Condo owners in buildings with high rental ratios.</strong> If you&apos;ve been stuck &mdash; unable to refinance or sell because your building had too many investor-owned units &mdash; that barrier is removed. Immediately.
            </p>
            <p className="mt-4">This is especially relevant in:</p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong><Link href="/colorado" className="text-brand hover:underline">Colorado</Link>:</strong> Boulder, downtown Denver, Capitol Hill, and mountain communities like Summit and Eagle counties where short-term rental units pushed investor ratios above 50%.</li>
              <li><strong><Link href="/california" className="text-brand hover:underline">California</Link>:</strong> Coastal condo buildings and urban high-rises with high investor ownership.</li>
              <li><strong><Link href="/texas" className="text-brand hover:underline">Texas</Link>:</strong> Investment-heavy condo complexes in Austin, Dallas, and Houston.</li>
              <li><strong><Link href="/oregon" className="text-brand hover:underline">Oregon</Link>:</strong> Portland condos with mixed owner/investor populations.</li>
            </ul>
            <p className="mt-4">
              <strong>Condo buyers who were previously shut out.</strong> Buildings that were off-limits for conventional financing are now back on the table. If your agent told you a building &ldquo;doesn&apos;t qualify for financing&rdquo; &mdash; it might now.
            </p>
            <p className="mt-4">
              <strong>HOAs dealing with insurance costs.</strong> The insurance relief is real and immediate. If your building was ineligible because of roof coverage or deductible requirements, check with your insurer. The rules changed.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Who This Hurts &mdash; Or At Least Complicates Things</h2>
            <p>
              <strong>HOAs with low reserves.</strong> If your association is at 10% reserves today, you have until January 2027 to get to 15%. That probably means higher assessments. If the board doesn&apos;t act, the building could lose conventional financing eligibility &mdash; which hurts every owner&apos;s property value.
            </p>
            <p className="mt-4">
              <strong>Condo transactions from August 2026 onward.</strong> The retirement of Limited Review means every condo purchase or refinance will take more time and require more documentation. The 40% of transactions that used to go through Limited Review will now need Full Review paperwork. HOAs need to be ready to produce documentation on demand.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">What You Should Do</h2>
            <p>
              <strong>If you own a condo and want to refinance:</strong> Check whether your building was previously blocked by the investor concentration rule. If it was, you may now qualify for conventional financing. The rate tool on our site shows you what today&apos;s numbers look like &mdash; no login, no application required.
            </p>
            <p className="mt-4">
              <strong>If you&apos;re buying a condo:</strong> Buildings that were ineligible for conventional financing a month ago may now be eligible. Your agent probably won&apos;t know this &mdash; most agents don&apos;t track Fannie Mae guideline changes. This is something your lender checks during the project review. If you&apos;ve been told a building &ldquo;doesn&apos;t qualify,&rdquo; it&apos;s worth having your lender look again under the new rules.
            </p>
            <p className="mt-4">
              <strong>If you&apos;re on an HOA board:</strong> Start planning for the reserve increase now. Get a current reserve study, review your budget, and figure out what it takes to hit 15% by January 2027. Talk to your management company about the Full Review documentation your building will need starting August 2026.
            </p>
            <p className="mt-8">
              <Link href="/rates" className="inline-block bg-brand text-white px-6 py-3 rounded-lg hover:bg-brand-dark transition-colors font-medium">
                See Today&apos;s Rates &rarr;
              </Link>
            </p>
          </section>

          <section className="border-t border-gray-200 pt-6 text-sm text-gray-500">
            <p>
              Source: Fannie Mae Lender Letter LL-2026-03, published March 18, 2026. This is educational content, not financial advice. Condo eligibility depends on individual project review. Licensed in California, Colorado, Oregon, and Texas. NMLS #1111861.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
