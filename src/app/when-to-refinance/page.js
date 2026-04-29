import Link from 'next/link';
import { OG_IMAGES, TWITTER_IMAGES } from '@/lib/og';

export const metadata = {
  title: 'Should I Refinance? How to Know When It Makes Sense | NetRate Mortgage',
  description: 'A refinance isn\'t always worth it. Here\'s how to figure out if the math works for your situation.',
  openGraph: {
    type: 'article',
    publishedTime: '2026-03-27T00:00:00Z',
    siteName: 'NetRate Mortgage',
    title: 'Should I Refinance? How to Know When It Makes Sense',
    description: 'A refinance isn\'t always worth it. Here\'s how to figure out if the math works for your situation.',
    url: 'https://www.netratemortgage.com/when-to-refinance',
    images: OG_IMAGES,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Should I Refinance? How to Know When It Makes Sense',
    description: 'A refinance isn\'t always worth it. Here\'s how to figure out if the math works for your situation.',
    images: TWITTER_IMAGES,
  },
  alternates: {
    canonical: 'https://www.netratemortgage.com/when-to-refinance',
  },
}

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Should I Refinance? How to Know When It Makes Sense',
    description: 'A refinance isn\'t always worth it. Here\'s how to figure out if the math works for your situation.',
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
      '@id': 'https://www.netratemortgage.com/when-to-refinance',
    },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'When should I refinance my mortgage?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'You should refinance when the math works in your favor. Calculate your breakeven point by dividing total closing costs by your monthly savings. If you plan to keep the loan longer than the breakeven period, the refinance makes sense. Common good reasons include your rate being well above current market rates, switching from an ARM to a fixed rate, removing PMI, or shortening your loan term.',
        },
      },
      {
        '@type': 'Question',
        name: 'What is a no-cost refinance?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'A no-cost refinance means the lender covers your closing costs through a lender credit, usually in exchange for a slightly higher interest rate. Your breakeven point is effectively day one since you pay nothing out of pocket. This can be a smart option if you are unsure how long you will keep the loan or if the rate improvement is modest.',
        },
      },
      {
        '@type': 'Question',
        name: 'How do I calculate breakeven on a refinance?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Divide your total closing costs by your monthly payment savings. For example, if closing costs are $4,000 and you save $200 per month, your breakeven is 20 months. If you plan to keep the loan longer than 20 months, the refinance pays for itself. Factor in any changes to your loan balance or term as well.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is it worth refinancing for half a percent?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'It depends on your loan balance and how long you plan to keep the loan. On a $400,000 loan, half a percent can save roughly $120-140 per month. If closing costs are $4,000, your breakeven is around 30 months. If you plan to stay in the home longer than that, the refinance is likely worth it. A no-cost refinance option can make even smaller rate improvements worthwhile.',
        },
      },
    ],
  },
]

export default function WhenToRefinancePage() {
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
          <span>When to Refinance</span>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
          Should I Refinance? How to Know When It Makes Sense
        </h1>

        <div className="space-y-8 text-gray-700 leading-relaxed">
          <section>
            <p>
              A refinance can save you real money &mdash; or it can be a waste of time and closing costs. The difference comes down to math, not feelings. Here&apos;s how to figure out whether a refinance actually makes sense for your situation.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              The Three Questions That Matter
            </h2>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-2">
              1. What&apos;s Your Breakeven?
            </h3>
            <p>
              Breakeven is the number of months it takes for your monthly savings to cover the cost of refinancing. Divide total closing costs by monthly savings. If you&apos;ll keep the loan longer than that, the refinance pays off.
            </p>

            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm border border-gray-200 rounded-lg">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-3 border-b border-gray-200 font-semibold"></th>
                    <th className="text-left p-3 border-b border-gray-200 font-semibold">Current Loan</th>
                    <th className="text-left p-3 border-b border-gray-200 font-semibold">After Refinance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="p-3 font-medium">Rate</td>
                    <td className="p-3">7.250% (7.619% APR)</td>
                    <td className="p-3">6.500% (6.869% APR)</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="p-3 font-medium">Monthly P&amp;I</td>
                    <td className="p-3">$2,731</td>
                    <td className="p-3">$2,528</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="p-3 font-medium">Monthly Savings</td>
                    <td className="p-3" colSpan={2}>$203/month</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="p-3 font-medium">Closing Costs</td>
                    <td className="p-3" colSpan={2}>$4,200</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">Breakeven</td>
                    <td className="p-3" colSpan={2}>~21 months</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Based on a $400,000 loan balance, 30-year fixed.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-2">
              2. What&apos;s the Cost of Waiting?
            </h3>
            <p>
              Every month you wait is a month of savings you don&apos;t get. If a refinance would save you $200 per month and you wait 12 months to pull the trigger, that&apos;s $2,400 gone. Waiting for rates to drop another quarter point can cost more than it saves.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-2">
              3. How Long Will You Keep the Loan?
            </h3>
            <p>
              If you&apos;re planning to sell in two years, a refinance with a 21-month breakeven barely makes sense. If you&apos;re staying for ten years, the math is obvious. Be honest about your timeline &mdash; it&apos;s the most important variable.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              When a Refinance Makes Sense
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Your rate is well above current market rates</strong> &mdash; if you locked during a rate spike, a 0.75%+ improvement can be significant</li>
              <li><strong>You have an ARM and want to switch to fixed</strong> &mdash; locking in a fixed rate removes future rate risk</li>
              <li><strong>Your escrow went up and you want to restructure</strong> &mdash; rolling an escrow shortfall into a new loan can lower your total monthly payment</li>
              <li><strong>You can remove PMI</strong> &mdash; if your home has appreciated past 80% LTV, refinancing eliminates private mortgage insurance</li>
              <li><strong>You want to shorten your term</strong> &mdash; moving from a 30-year to a 20 or 15-year saves substantial interest over the life of the loan</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              When It Doesn&apos;t Make Sense
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Your rate is close to market</strong> &mdash; a 0.125% or 0.25% improvement rarely justifies closing costs unless you go with a no-cost option</li>
              <li><strong>You&apos;re about to sell</strong> &mdash; if you&apos;re moving within a year or two, you won&apos;t hit breakeven</li>
              <li><strong>You just want to &quot;do something&quot;</strong> &mdash; refinancing because rates are in the news isn&apos;t a strategy. Run the numbers first.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              The No-Cost Refinance Option
            </h2>
            <p>
              A no-cost refinance means the lender covers your closing costs through a lender credit. You&apos;ll typically accept a slightly higher rate in exchange &mdash; maybe 0.125% to 0.25% higher than the lowest available rate. The trade-off is that your breakeven is effectively day one, since you pay nothing out of pocket.
            </p>
            <p className="mt-4">
              This is a smart option when the rate improvement is modest or when you&apos;re unsure how long you&apos;ll keep the loan. If rates drop further, you can refinance again without feeling like you wasted money on closing costs.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Run Your Numbers
            </h2>
            <p>
              Use our{' '}
              <Link href="/breakeven" className="text-brand hover:underline">breakeven calculator</Link>{' '}
              to see your specific payback period. Review{' '}
              <Link href="/closing-costs" className="text-brand hover:underline">what closing costs to expect</Link>, and check{' '}
              <Link href="/rates" className="text-brand hover:underline">today&apos;s rates</Link>{' '}
              to see where you stand.
            </p>
            <p className="mt-4">
              Have questions about whether a refinance makes sense for you?{' '}
              <Link href="/contact" className="text-brand hover:underline">Get in touch</Link> &mdash; we&apos;ll walk through the math together.
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
            <p>
              This information is provided for educational purposes and does not constitute financial advice. Rates shown are for illustration only and may not reflect current market conditions. Actual savings depend on your loan balance, credit profile, property value, and other factors. Contact a licensed loan officer to evaluate your specific refinance scenario. NetRate Mortgage LLC NMLS #1111861. Equal Housing Lender.
            </p>
          </section>
        </div>
      </article>
    </>
  )
}
