import Link from 'next/link';
import CountyLoanLimits from '@/components/CountyLoanLimits';

export const metadata = {
  title: 'Colorado Mortgage Rates — Licensed Mortgage Broker | NetRate Mortgage',
  description: 'NetRate Mortgage is headquartered in Louisville, Colorado. See today\'s mortgage rates — refinance, purchase, and reverse mortgage — before you apply.',
  alternates: { canonical: 'https://netratemortgage.com/colorado' },
};

export default function Colorado() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <nav className="text-sm text-gray-400 mb-8">
        <Link href="/" className="hover:text-brand">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-600">Colorado</span>
      </nav>

      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
        Colorado Mortgage Rates
      </h1>
      <p className="text-lg text-gray-500 mb-10">Headquartered in Louisville, Colorado.</p>

      <div className="space-y-8 text-gray-700 leading-relaxed">
        <section>
          <p>
            NetRate Mortgage is a mortgage broker headquartered in Louisville, Colorado. We work with wholesale lenders to get you access to rates and pricing that aren&apos;t available through retail banks or direct lenders.
          </p>
          <p className="mt-4">
            Colorado is our home state — we&apos;ve been originating loans here since 2013. We know the market, we know the lenders, and we know how to get Colorado borrowers the best pricing available.{' '}
            <Link href="/how-pricing-works" className="text-brand hover:text-brand-dark font-medium">How mortgage pricing works &rarr;</Link>
          </p>
          <p className="mt-4">A few things specific to Colorado:</p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li><strong>Loan limits</strong> — conforming loan limits vary by county. Boulder, Denver, and many Front Range counties have higher limits due to elevated home values</li>
            <li><strong>Closing costs</strong> — Colorado closing costs are moderate compared to other states. No transfer tax on residential property</li>
            <li><strong>Third-party fees</strong> — title insurance, escrow, and settlement costs are competitive</li>
          </ul>
        </section>

        <CountyLoanLimits defaultState="CO" />

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">What We Offer in Colorado</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Refinance</strong> — Rate-and-term, cash-out, no-cost options. <Link href="/refinance-playbook" className="text-brand hover:text-brand-dark font-medium">The Refinance Playbook &rarr;</Link></li>
            <li><strong>Home Purchase</strong> — Conventional, FHA, VA</li>
            <li><strong>Reverse Mortgage</strong> — HECM and proprietary products. <Link href="/reverse-mortgage" className="text-brand hover:text-brand-dark font-medium">Reverse Mortgage Guide &rarr;</Link></li>
            <li><strong>Jumbo Loans</strong> — For loan amounts above the conforming limit</li>
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
              <strong>See the rates</strong> — <Link href="/rates?state=CO" className="text-brand hover:text-brand-dark font-medium">Check today&apos;s Colorado rates</Link>. No application, no credit pull.
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
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Colorado Licensing</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>David Burson</strong> — NMLS #641790</li>
            <li><strong>NetRate Mortgage LLC</strong> — NMLS #1111861</li>
            <li><strong>Regulated by the Colorado Division of Real Estate</strong></li>
            <li><strong>Office:</strong> 357 S McCaslin Blvd #200, Louisville, CO 80027</li>
            <li><a href="https://nmlsconsumeraccess.org" target="_blank" rel="noopener noreferrer" className="text-brand hover:text-brand-dark font-medium">Verify on NMLS Consumer Access &rarr;</a></li>
          </ul>
        </section>

        <div className="pt-4">
          <Link href="/rates?state=CO" className="inline-block bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors">
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
