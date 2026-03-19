import Link from 'next/link';

export const metadata = {
  title: 'Texas Mortgage Rates — Wholesale Rates from a Licensed Broker | NetRate Mortgage',
  description: 'NetRate Mortgage is licensed in Texas. See today\'s wholesale mortgage rates — refinance, purchase, and reverse mortgage — before you apply.',
};

export default function Texas() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <nav className="text-sm text-gray-400 mb-8">
        <Link href="/" className="hover:text-brand">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-600">Texas</span>
      </nav>

      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
        Texas Mortgage Rates
      </h1>
      <p className="text-lg text-gray-500 mb-10">Licensed in Texas. Same Low Rates.</p>

      <div className="space-y-8 text-gray-700 leading-relaxed">
        <section>
          <p>
            NetRate Mortgage is licensed to originate loans in Texas. Our rates are the same whether you&apos;re in Denver or Dallas — because wholesale pricing doesn&apos;t change by state.
          </p>
          <p className="mt-4">What does change by state:</p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li><strong>Closing costs</strong> — title insurance rates, recording fees, and transfer taxes vary by county and state</li>
            <li><strong>Loan limits</strong> — conforming loan limits differ by county, which affects whether your loan is conforming, high-balance, or jumbo</li>
            <li><strong>Third-party fees</strong> — escrow, title, and settlement costs differ by state</li>
          </ul>
          <p className="mt-4">
            The rate itself — and everything that drives it (market, lender margin, LLPAs) — works the same nationwide.{' '}
            <Link href="/how-pricing-works" className="text-brand hover:text-brand-dark font-medium">How mortgage pricing works &rarr;</Link>
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Texas-Specific Rules Worth Knowing</h2>
          <p className="mb-4">Texas has a few mortgage rules that don&apos;t exist in other states:</p>
          <ul className="list-disc pl-6 space-y-3">
            <li><strong>Attorney state</strong> — Texas requires that mortgage closing documents be prepared or reviewed by a Texas-licensed attorney. This is a closing cost you&apos;ll see in Section B that may be higher than in non-attorney states.</li>
            <li><strong>Homestead protections</strong> — Texas has some of the strongest homestead protections in the country. There&apos;s no monetary cap on the homestead exemption for your primary residence.</li>
            <li><strong>Home equity 80% LTV cap</strong> — If you&apos;re doing a home equity loan or HELOC in Texas, you can&apos;t borrow more than 80% of your home&apos;s value. This is a Texas constitutional requirement.</li>
            <li><strong>Community property</strong> — Texas is a community property state, which means both spouses typically need to sign mortgage documents, even if only one is on the loan.</li>
          </ul>
          <p className="mt-4">These rules affect how loans are structured in Texas but don&apos;t change the rate itself.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">What We Offer in Texas</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Refinance</strong> — Rate-and-term, cash-out, no-cost options. <Link href="/refinance-playbook" className="text-brand hover:text-brand-dark font-medium">The Refinance Playbook &rarr;</Link></li>
            <li><strong>Home Purchase</strong> — Conventional, FHA, VA</li>
            <li><strong>Reverse Mortgage</strong> — HECM and proprietary products. <Link href="/reverse-mortgage" className="text-brand hover:text-brand-dark font-medium">Reverse Mortgage Guide &rarr;</Link></li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">How It Works</h2>
          <p className="mb-4">Same as anywhere else:</p>
          <ol className="list-decimal pl-6 space-y-4">
            <li>
              <strong>See the rates</strong> — <Link href="/rates" className="text-brand hover:text-brand-dark font-medium">Check today&apos;s rates</Link>. No application, no credit pull.
            </li>
            <li>
              <strong>Compare your options</strong> — Every rate, every point/credit combination, side by side.
            </li>
            <li>
              <strong>Apply when you&apos;re ready</strong> — We handle everything from application to closing.
            </li>
          </ol>
          <p className="mt-4">
            We&apos;re a wholesale mortgage broker — not a bank, not a call center.{' '}
            <Link href="/why-netrate" className="text-brand hover:text-brand-dark font-medium">Why that matters &rarr;</Link>
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Texas Licensing</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>David Burson</strong> — NMLS #641790</li>
            <li><strong>NetRate Mortgage LLC</strong> — NMLS #1111861</li>
            <li><strong>Regulated by the Texas Department of Savings and Mortgage Lending</strong></li>
            <li><a href="https://nmlsconsumeraccess.org" target="_blank" rel="noopener noreferrer" className="text-brand hover:text-brand-dark font-medium">Verify on NMLS Consumer Access &rarr;</a></li>
          </ul>
        </section>

        <div className="pt-4">
          <Link href="/rates" className="inline-block bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors">
            See Today&apos;s Rates &rarr;
          </Link>
        </div>

        <p className="text-xs text-gray-400 pt-4 border-t border-gray-100">
          Licensed in California, Colorado, Oregon, and Texas. NMLS #1111861. Equal Housing Opportunity. Rates shown are approximate and subject to change. Not a commitment to lend.
        </p>
      </div>
    </div>
  );
}
