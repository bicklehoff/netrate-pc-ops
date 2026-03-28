import Link from 'next/link'

export const metadata = {
  title: 'HELOC vs Cash-Out Refinance — Which Is Better for Accessing Equity? | NetRate Mortgage',
  description: 'Two ways to access your home equity. One keeps your current rate. One replaces it. Here\'s how to figure out which is right for your situation.',
  openGraph: {
    title: 'HELOC vs Cash-Out Refinance — Which Is Better for Accessing Equity?',
    description: 'Two ways to access your home equity. One keeps your current rate. One replaces it. Here\'s how to figure out which is right for your situation.',
    type: 'article',
    publishedTime: '2026-03-27T00:00:00Z',
    siteName: 'NetRate Mortgage',
    url: 'https://netratemortgage.com/heloc-vs-cashout',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HELOC vs Cash-Out Refinance — Which Is Better for Accessing Equity?',
    description: 'Two ways to access your home equity. One keeps your current rate. One replaces it. Here\'s how to figure out which is right for your situation.',
  },
  alternates: {
    canonical: 'https://netratemortgage.com/heloc-vs-cashout',
  },
}

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'HELOC vs Cash-Out Refinance — Which Is Better for Accessing Equity?',
    description: 'Two ways to access your home equity. One keeps your current rate. One replaces it. Here\'s how to figure out which is right for your situation.',
    datePublished: '2026-03-27T00:00:00Z',
    author: {
      '@type': 'Organization',
      name: 'NetRate Mortgage',
      url: 'https://netratemortgage.com',
    },
    publisher: {
      '@type': 'Organization',
      name: 'NetRate Mortgage',
      url: 'https://netratemortgage.com',
    },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'When is a HELOC better than a cash-out refinance?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'A HELOC is typically better when you have a low rate on your existing mortgage that you want to keep, you need flexible access to funds over time rather than a lump sum, or you want lower upfront closing costs.',
        },
      },
      {
        '@type': 'Question',
        name: 'When does a cash-out refinance make more sense?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'A cash-out refinance makes more sense when your current rate is close to or above today\'s rates, when you want a single fixed-rate payment, when you need to consolidate debt, or when you qualify for FHA or VA programs that offer easier approval.',
        },
      },
      {
        '@type': 'Question',
        name: 'What is the difference between a HELOC and a closed-end second?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'A HELOC gives you a revolving line of credit with a variable rate that you draw from as needed. A closed-end second gives you a lump sum at a fixed rate with a set repayment schedule. Both sit behind your first mortgage.',
        },
      },
      {
        '@type': 'Question',
        name: 'How do I decide between a HELOC and cash-out refinance?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Compare your current first mortgage rate to today\'s rates. If your rate is well below market, a second lien (HELOC or closed-end second) lets you keep it. If your rate is at or above market, a cash-out refinance lets you replace it and pull equity in one loan.',
        },
      },
    ],
  },
]

export default function HelocVsCashout() {
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
          <span>HELOC vs Cash-Out Refinance</span>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
          HELOC vs Cash-Out Refinance &mdash; Which Is Better for Accessing Equity?
        </h1>

        <div className="space-y-8 text-gray-700 leading-relaxed">
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Two Ways to Access Your Equity</h2>
            <p>
              If you&apos;ve built up equity in your home, there are two main ways to tap into it: a cash-out refinance or a second lien (HELOC or closed-end second). Both give you access to cash. But they work very differently &mdash; and the right choice depends on your current mortgage rate, how much you need, and how you plan to use the money.
            </p>
            <p className="mt-4">
              A cash-out refinance replaces your existing mortgage with a new, larger loan. A second lien sits behind your current mortgage and leaves it untouched. That distinction matters more now than it has in years, because many homeowners locked in rates below 4% that would be expensive to give up.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Side-by-Side Comparison</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200 rounded-lg">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-3 border-b border-gray-200 font-semibold">&nbsp;</th>
                    <th className="text-left p-3 border-b border-gray-200 font-semibold">Cash-Out Refinance</th>
                    <th className="text-left p-3 border-b border-gray-200 font-semibold">HELOC / Second Lien</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-3 border-b border-gray-200 font-medium">First mortgage</td>
                    <td className="p-3 border-b border-gray-200">Replaced with new loan</td>
                    <td className="p-3 border-b border-gray-200">Stays in place</td>
                  </tr>
                  <tr>
                    <td className="p-3 border-b border-gray-200 font-medium">How you get cash</td>
                    <td className="p-3 border-b border-gray-200">Lump sum at closing</td>
                    <td className="p-3 border-b border-gray-200">Draw as needed (HELOC) or lump sum (closed-end)</td>
                  </tr>
                  <tr>
                    <td className="p-3 border-b border-gray-200 font-medium">Payments</td>
                    <td className="p-3 border-b border-gray-200">One payment (new first mortgage)</td>
                    <td className="p-3 border-b border-gray-200">Two payments (existing first + second lien)</td>
                  </tr>
                  <tr>
                    <td className="p-3 border-b border-gray-200 font-medium">Rate type</td>
                    <td className="p-3 border-b border-gray-200">Fixed</td>
                    <td className="p-3 border-b border-gray-200">Variable (HELOC) or fixed (closed-end)</td>
                  </tr>
                  <tr>
                    <td className="p-3 border-b border-gray-200 font-medium">Closing costs</td>
                    <td className="p-3 border-b border-gray-200">Full refi costs (2&ndash;5% of loan)</td>
                    <td className="p-3 border-b border-gray-200">Lower (often under $1,000)</td>
                  </tr>
                  <tr>
                    <td className="p-3 border-b border-gray-200 font-medium">Best when</td>
                    <td className="p-3 border-b border-gray-200">Current rate is at or above market</td>
                    <td className="p-3 border-b border-gray-200">Current rate is well below market</td>
                  </tr>
                  <tr>
                    <td className="p-3 border-b border-gray-200 font-medium">Access to more later</td>
                    <td className="p-3 border-b border-gray-200">Requires another refinance</td>
                    <td className="p-3 border-b border-gray-200">HELOC: draw again during draw period</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">When Cash-Out Makes Sense</h2>
            <p>
              If your current mortgage rate is already close to today&apos;s market rates, a cash-out refinance can simplify things. You replace your existing loan with one larger loan, pull equity at closing, and make a single payment going forward.
            </p>
            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-2">Easier Qualifying with FHA and VA</h3>
            <p>
              FHA and VA cash-out programs have more flexible qualifying standards than conventional loans. FHA allows cash-out up to 80% LTV with credit scores down to 580. VA allows cash-out up to 100% LTV with no mortgage insurance. If qualifying is tight, these government-backed options open doors that conventional second liens don&apos;t.
            </p>
            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-2">One Payment, One Rate</h3>
            <p>
              Some borrowers prefer the simplicity of a single fixed-rate payment. If you&apos;re pulling a large amount of equity and want rate certainty, a cash-out refi gives you that without the variable rate risk of a HELOC.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">When a Second Lien Makes Sense</h2>
            <p>
              If you locked in a first mortgage rate at 3.25% (3.619% APR) or 3.50% (3.869% APR) during 2020&ndash;2021, replacing that loan with today&apos;s rates would cost you hundreds per month in added interest &mdash; even before you factor in the cash you&apos;re pulling. A second lien lets you keep that low rate and borrow only what you need on top.
            </p>
            <p className="mt-4">
              Second liens also work well when you need a smaller amount &mdash; say $30,000 to $75,000 &mdash; where the closing costs of a full refinance don&apos;t make economic sense.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">How to Run the Math</h2>
            <p>
              The real comparison comes down to total monthly cost and total interest paid. Here&apos;s a simplified example pulling $100,000 from a home worth $500,000.
            </p>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm border border-gray-200 rounded-lg">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-3 border-b border-gray-200 font-semibold">&nbsp;</th>
                    <th className="text-left p-3 border-b border-gray-200 font-semibold">Cash-Out Refi</th>
                    <th className="text-left p-3 border-b border-gray-200 font-semibold">Keep First + HELOC</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-3 border-b border-gray-200 font-medium">Current first mortgage</td>
                    <td className="p-3 border-b border-gray-200">$300K at 3.25% (3.619% APR) &rarr; replaced</td>
                    <td className="p-3 border-b border-gray-200">$300K at 3.25% (3.619% APR) &rarr; kept</td>
                  </tr>
                  <tr>
                    <td className="p-3 border-b border-gray-200 font-medium">New loan</td>
                    <td className="p-3 border-b border-gray-200">$400K at 6.75% (7.119% APR)</td>
                    <td className="p-3 border-b border-gray-200">$100K HELOC at 8.50% (variable)</td>
                  </tr>
                  <tr>
                    <td className="p-3 border-b border-gray-200 font-medium">Combined monthly payment</td>
                    <td className="p-3 border-b border-gray-200">~$2,594</td>
                    <td className="p-3 border-b border-gray-200">~$1,306 (first) + ~$633 (HELOC IO) = ~$1,939</td>
                  </tr>
                  <tr>
                    <td className="p-3 border-b border-gray-200 font-medium">Monthly difference</td>
                    <td className="p-3 border-b border-gray-200" colSpan={2}>HELOC saves ~$655/mo in this scenario</td>
                  </tr>
                  <tr>
                    <td className="p-3 border-b border-gray-200 font-medium">Closing costs</td>
                    <td className="p-3 border-b border-gray-200">~$8,000&ndash;$12,000</td>
                    <td className="p-3 border-b border-gray-200">~$500&ndash;$1,500</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-sm text-gray-500">
              Example is illustrative. Your numbers will depend on your specific rate, balance, credit profile, and lender.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">HELOC vs Closed-End Second</h2>
            <p>
              If you decide a second lien is the way to go, you still have a choice between two types.
            </p>
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm border border-gray-200 rounded-lg">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-3 border-b border-gray-200 font-semibold">&nbsp;</th>
                    <th className="text-left p-3 border-b border-gray-200 font-semibold">HELOC</th>
                    <th className="text-left p-3 border-b border-gray-200 font-semibold">Closed-End Second</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-3 border-b border-gray-200 font-medium">How funds work</td>
                    <td className="p-3 border-b border-gray-200">Revolving line &mdash; draw, repay, draw again</td>
                    <td className="p-3 border-b border-gray-200">Lump sum at closing, no re-draw</td>
                  </tr>
                  <tr>
                    <td className="p-3 border-b border-gray-200 font-medium">Rate</td>
                    <td className="p-3 border-b border-gray-200">Variable (typically Prime + margin)</td>
                    <td className="p-3 border-b border-gray-200">Fixed for the life of the loan</td>
                  </tr>
                  <tr>
                    <td className="p-3 border-b border-gray-200 font-medium">Payment structure</td>
                    <td className="p-3 border-b border-gray-200">Interest-only during draw period, then amortizing</td>
                    <td className="p-3 border-b border-gray-200">Fully amortizing from day one</td>
                  </tr>
                  <tr>
                    <td className="p-3 border-b border-gray-200 font-medium">Best for</td>
                    <td className="p-3 border-b border-gray-200">Ongoing projects, flexible spending</td>
                    <td className="p-3 border-b border-gray-200">One-time need, payment certainty</td>
                  </tr>
                  <tr>
                    <td className="p-3 border-b border-gray-200 font-medium">Risk</td>
                    <td className="p-3 border-b border-gray-200">Rate can rise with Prime</td>
                    <td className="p-3 border-b border-gray-200">Higher starting rate than HELOC</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Questions to Ask Yourself</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>What is my current first mortgage rate? Would I lose significant value by replacing it?</li>
              <li>How much equity do I need to access? Is it a one-time need or ongoing?</li>
              <li>Can I qualify for FHA or VA cash-out if conventional options are tight?</li>
              <li>Am I comfortable with a variable rate, or do I need payment certainty?</li>
              <li>How long do I plan to stay in this home?</li>
              <li>What are the total closing costs for each option?</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">We Can Run Both Scenarios</h2>
            <p>
              The best way to decide is to see real numbers for both options side by side. We&apos;ll pull your current loan details, run a cash-out refi quote and a second lien quote, and show you the monthly cost difference, the break-even timeline, and the total interest comparison.
            </p>
            <p className="mt-4">
              <Link href="/rates" className="inline-block bg-brand text-white px-6 py-3 rounded-lg hover:bg-brand-dark transition-colors font-medium">
                See Today&apos;s Rates &rarr;
              </Link>
            </p>
            <p className="mt-4">
              Or{' '}
              <Link href="/contact" className="text-brand hover:underline">reach out directly</Link>
              {' '}to talk through your situation. You can also{' '}
              <a href="https://book.netratemortgage.com" className="text-brand hover:underline" target="_blank" rel="noopener noreferrer">book a call</a>
              {' '}at a time that works for you.
            </p>
          </section>

          <section className="border-t border-gray-200 pt-6 text-sm text-gray-500">
            <p>
              This article is for educational purposes only and does not constitute financial advice. Mortgage rates, terms, and availability vary by lender, credit profile, and market conditions. All examples are illustrative and may not reflect current pricing. Contact a licensed mortgage professional for guidance specific to your situation. NetRate Mortgage LLC NMLS #1111861. Equal Housing Lender.
            </p>
          </section>
        </div>
      </article>
    </>
  )
}
