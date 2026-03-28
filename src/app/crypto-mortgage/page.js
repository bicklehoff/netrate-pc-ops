import Link from 'next/link'

export const metadata = {
  title: 'Can Crypto Assets Qualify You for a Mortgage? | NetRate Mortgage',
  description: 'Some mortgage programs now accept cryptocurrency as qualifying assets. Here\'s what counts, what doesn\'t, and how it works for conventional, government, and non-QM loans.',
  openGraph: {
    type: 'article',
    publishedTime: '2026-03-27T00:00:00Z',
    siteName: 'NetRate Mortgage',
    title: 'Can Crypto Assets Qualify You for a Mortgage?',
    description: 'Some mortgage programs now accept cryptocurrency as qualifying assets. Here\'s what counts, what doesn\'t, and how it works for conventional, government, and non-QM loans.',
    url: 'https://netratemortgage.com/crypto-mortgage',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Can Crypto Assets Qualify You for a Mortgage?',
    description: 'Some mortgage programs now accept cryptocurrency as qualifying assets. Here\'s what counts, what doesn\'t, and how it works.',
  },
  alternates: {
    canonical: 'https://netratemortgage.com/crypto-mortgage',
  },
}

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Can Crypto Assets Qualify You for a Mortgage?',
    description: 'Some mortgage programs now accept cryptocurrency as qualifying assets. Here\'s what counts, what doesn\'t, and how it works for conventional, government, and non-QM loans.',
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
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': 'https://netratemortgage.com/crypto-mortgage',
    },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Can I use crypto for a mortgage down payment?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes, but most lenders require you to convert cryptocurrency to USD first and deposit it into a traditional bank account. You will need to document the conversion with exchange statements, transfer records, and bank statements showing the deposit.',
        },
      },
      {
        '@type': 'Question',
        name: 'Do lenders accept crypto as reserves?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Some lenders will count cryptocurrency toward reserve requirements, but typically at a 50-70% discount to current market value due to volatility. Non-QM lenders tend to be more flexible than conventional or government loan programs.',
        },
      },
      {
        '@type': 'Question',
        name: 'Which loan types accept cryptocurrency?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Conventional loans accept crypto that has been converted to USD with a documented paper trail. FHA, VA, and USDA loans follow similar rules. Non-QM loans offer the most flexibility, including asset depletion programs that can count crypto holdings without requiring conversion.',
        },
      },
      {
        '@type': 'Question',
        name: 'What documentation do I need to use crypto for a mortgage?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'You will need exchange account statements showing ownership and balances, conversion and transfer records, bank statements showing deposits from crypto sales, documentation of the source of the crypto assets, and a timeline showing how long you have held the assets.',
        },
      },
    ],
  },
]

export default function CryptoMortgagePage() {
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
          <span>Crypto Mortgage</span>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
          Can Crypto Assets Qualify You for a Mortgage?
        </h1>

        <div className="space-y-8 text-gray-700 leading-relaxed">
          <section>
            <p>
              Cryptocurrency isn&apos;t just a speculative asset anymore &mdash; it&apos;s becoming part of the mortgage conversation. If you hold Bitcoin, Ethereum, or other digital assets, there are now ways to use them when qualifying for a home loan. But the rules vary significantly depending on the loan type and how you plan to use the assets.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Three Ways Crypto Can Work in Mortgage Qualifying
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-gray-200 rounded-lg">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-3 border-b border-gray-200 font-semibold">Use Case</th>
                    <th className="text-left p-3 border-b border-gray-200 font-semibold">How It Works</th>
                    <th className="text-left p-3 border-b border-gray-200 font-semibold">Key Detail</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="p-3 font-medium">Down Payment Source</td>
                    <td className="p-3">Convert crypto to USD, deposit into bank account, document the trail</td>
                    <td className="p-3">Requires full paper trail from exchange to bank</td>
                  </tr>
                  <tr className="border-b border-gray-100">
                    <td className="p-3 font-medium">Reserves</td>
                    <td className="p-3">Lender counts crypto holdings toward reserve requirements</td>
                    <td className="p-3">Typically valued at 50&ndash;70% discount due to volatility</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">Asset-Based Qualification</td>
                    <td className="p-3">Non-QM asset depletion programs count crypto without converting</td>
                    <td className="p-3">Most flexible option &mdash; no W-2 or income documentation needed</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              By Loan Type
            </h2>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-2">
              Conventional Loans
            </h3>
            <p>
              Fannie Mae and Freddie Mac don&apos;t recognize cryptocurrency as an asset on its own. You&apos;ll need to convert to USD and deposit the funds into a verified bank account. The key is documentation &mdash; a clean paper trail from exchange to bank, with statements showing the conversion, transfer, and deposit. Seasoning requirements apply, so plan ahead.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-2">
              FHA, VA, and USDA Loans
            </h3>
            <p>
              Government-backed programs follow similar rules to conventional. Convert first, document everything, deposit into a traditional account. These agencies haven&apos;t issued specific crypto guidance, so underwriters apply existing large-deposit and source-of-funds rules.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-2">
              Non-QM Loans
            </h3>
            <p>
              This is where crypto holders have the most options. Non-QM lenders operate outside agency guidelines, which means more flexibility. Asset depletion programs can count your crypto portfolio toward qualifying income without requiring conversion. Some lenders will accept exchange statements directly. If you have significant crypto holdings but limited traditional income documentation, non-QM is likely the path.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Documentation You&apos;ll Need
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Exchange account statements</strong> &mdash; showing ownership, balances, and transaction history</li>
              <li><strong>Conversion records</strong> &mdash; documenting when crypto was sold and at what price</li>
              <li><strong>Bank statements</strong> &mdash; showing the deposit of converted funds into your account</li>
              <li><strong>Source documentation</strong> &mdash; how you acquired the crypto (mining, purchase, compensation, etc.)</li>
              <li><strong>Timeline</strong> &mdash; how long you&apos;ve held the assets, which affects seasoning requirements</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              What Doesn&apos;t Work (Yet)
            </h2>
            <p>
              Some things aren&apos;t accepted in mortgage qualifying today:
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-2">
              <li><strong>Paying your mortgage in crypto</strong> &mdash; no major servicer accepts crypto payments</li>
              <li><strong>Unverifiable holdings</strong> &mdash; assets in cold wallets without exchange documentation are difficult to verify</li>
              <li><strong>Stablecoins and DeFi positions</strong> &mdash; the space is evolving, but underwriting standards haven&apos;t caught up to decentralized finance protocols</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Seasoning Matters
            </h2>
            <p>
              Most lenders want to see funds sitting in a bank account for at least 60 days before they&apos;re considered &quot;seasoned.&quot; If you&apos;re planning to use crypto proceeds for a down payment, convert and deposit well in advance of your mortgage application. Last-minute conversions create large-deposit flags that require extra documentation and can delay closing.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Next Steps
            </h2>
            <p>
              If you hold crypto and are thinking about buying a home, the strategy depends on your full financial picture &mdash; how much you hold, what type of loan makes sense, and whether converting is the right move for your situation.
            </p>
            <p className="mt-4">
              <Link href="/contact" className="text-brand hover:underline">Reach out to us</Link> or{' '}
              <a href="https://book.netratemortgage.com" className="text-brand hover:underline" target="_blank" rel="noopener noreferrer">book a call</a> to walk through your options.
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
              <li>Newrez Wholesale Announcement (March 2026)</li>
              <li>Fannie Mae Selling Guide</li>
            </ul>
            <p>
              This information is provided for educational purposes and does not constitute financial or legal advice. Cryptocurrency policies vary by lender and are subject to change. Loan approval depends on individual borrower qualifications, property type, and program guidelines. Contact a licensed loan officer to discuss your specific situation. NetRate Mortgage LLC NMLS #1111861. Equal Housing Lender.
            </p>
          </section>
        </div>
      </article>
    </>
  )
}
