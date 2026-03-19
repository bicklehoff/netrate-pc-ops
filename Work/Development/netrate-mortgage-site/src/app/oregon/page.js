import Link from 'next/link';
import CountyLoanLimits from '@/components/CountyLoanLimits';

export const metadata = {
  title: 'Oregon Mortgage Rates — Wholesale Rates from a Licensed Broker | NetRate Mortgage',
  description: 'NetRate Mortgage is licensed in Oregon. See today\'s wholesale mortgage rates — refinance, purchase, and reverse mortgage — before you apply.',
};

export default function Oregon() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <nav className="text-sm text-gray-400 mb-8">
        <Link href="/" className="hover:text-brand">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-600">Oregon</span>
      </nav>

      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
        Oregon Mortgage Rates
      </h1>
      <p className="text-lg text-gray-500 mb-10">Licensed in Oregon.</p>

      <div className="space-y-8 text-gray-700 leading-relaxed">
        <section>
          <p>
            NetRate Mortgage is a mortgage broker licensed to originate loans in Oregon. We work with wholesale lenders to get you access to rates and pricing that aren&apos;t available through retail banks or direct lenders.
          </p>
          <p className="mt-4">
            Pricing can vary by state — not every wholesale lender operates in every state, and some lenders price differently depending on the market. What doesn&apos;t change is our approach: we shop multiple wholesale lenders on your behalf and show you the options side by side.{' '}
            <Link href="/how-pricing-works" className="text-brand hover:text-brand-dark font-medium">How mortgage pricing works &rarr;</Link>
          </p>
          <p className="mt-4">A few things that vary in Oregon specifically:</p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li><strong>Closing costs</strong> — title insurance rates, recording fees, and transfer taxes vary by county and state</li>
            <li><strong>Loan limits</strong> — conforming loan limits differ by county, which affects whether your loan is conforming, high-balance, or jumbo</li>
            <li><strong>Third-party fees</strong> — escrow, title, and settlement costs differ by state</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Oregon Residents: Something Most Brokers Won&apos;t Tell You</h2>
          <p>
            Oregon has a unique licensing rule: if you&apos;re an Oregon resident, your mortgage loan originator must be licensed in Oregon — even if you&apos;re buying property in another state.
          </p>
          <p className="mt-4">
            That means if you live in Oregon and want to purchase a vacation home in Arizona, an investment property in Texas, or help your parents with a home in California, you need a broker who&apos;s licensed in Oregon AND the state where the property is located. Many out-of-state brokers can&apos;t do this.
          </p>
          <p className="mt-4">
            We&apos;re licensed in Colorado, California, Texas, and Oregon — so we can help Oregon residents with purchases and refinances both in-state and in any of our other licensed states.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">What We Offer in Oregon</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Refinance</strong> — Rate-and-term, cash-out, no-cost options. <Link href="/refinance-playbook" className="text-brand hover:text-brand-dark font-medium">The Refinance Playbook &rarr;</Link></li>
            <li><strong>Home Purchase</strong> — Conventional, FHA, VA</li>
            <li><strong>Reverse Mortgage</strong> — HECM and proprietary products. <Link href="/reverse-mortgage" className="text-brand hover:text-brand-dark font-medium">Reverse Mortgage Guide &rarr;</Link></li>
            <li><strong>DSCR Loans</strong> — Investment property loans qualified on rental income, not personal income</li>
            <li><strong>Bank Statement Loans</strong> — For self-employed borrowers who can&apos;t document income through tax returns</li>
            <li><strong>Second Mortgages</strong> — HELOCs and closed-end seconds</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">How It Works</h2>
          <p className="mb-4">Same as anywhere else:</p>
          <ol className="list-decimal pl-6 space-y-4">
            <li>
              <strong>See the rates</strong> — <Link href="/rates?state=OR" className="text-brand hover:text-brand-dark font-medium">Check today&apos;s Oregon rates</Link>. No application, no credit pull.
            </li>
            <li>
              <strong>Compare your options</strong> — Every rate, every point/credit combination, side by side.
            </li>
            <li>
              <strong>Apply when you&apos;re ready</strong> — We handle everything from application to closing.
            </li>
          </ol>
          <p className="mt-4">
            We&apos;re a mortgage broker — not a bank, not a call center.{' '}
            <Link href="/why-netrate" className="text-brand hover:text-brand-dark font-medium">Why that matters &rarr;</Link>
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Oregon Licensing</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>David Burson</strong> — NMLS #641790</li>
            <li><strong>NetRate Mortgage LLC</strong> — NMLS #1111861</li>
            <li><strong>Regulated by the Oregon Division of Financial Regulation</strong></li>
            <li><a href="https://nmlsconsumeraccess.org" target="_blank" rel="noopener noreferrer" className="text-brand hover:text-brand-dark font-medium">Verify on NMLS Consumer Access &rarr;</a></li>
          </ul>
        </section>

        <CountyLoanLimits defaultState="OR" />

        <div className="pt-4">
          <Link href="/rates?state=OR" className="inline-block bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors">
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
