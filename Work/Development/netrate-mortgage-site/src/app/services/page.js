import Link from 'next/link';

export const metadata = {
  title: 'Services | NetRate Mortgage',
  description: 'Refinance, home purchase, and cash-out loans. Conventional, FHA, VA, and jumbo. Licensed in Colorado, Oregon, and Texas.',
};

export default function ServicesPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">What We Do</h1>
      <p className="text-lg text-gray-600 mb-12">
        NetRate Mortgage is an independent mortgage broker. We don&apos;t lend our own money — we shop
        across wholesale lenders to find you the best rate and terms. Here&apos;s what that looks like in practice.
      </p>

      {/* Refinance */}
      <section id="refinance" className="mb-14 scroll-mt-24">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Refinance Your Mortgage</h2>
        <p className="text-gray-600 leading-relaxed mb-4">
          Refinancing made up 54% of our loan volume in 2025. It&apos;s what we do most, and we&apos;re good at it.
        </p>
        <p className="text-gray-600 leading-relaxed mb-6">
          Whether you want to lower your monthly payment, shorten your loan term, or tap your home equity
          for cash, we&apos;ll run the numbers across our lending partners and show you which option saves you the most.
        </p>
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">What we&apos;ll show you</h3>
        <ul className="space-y-2 text-sm text-gray-600 mb-6">
          <li>Your new rate vs. your current rate</li>
          <li>Monthly payment difference</li>
          <li>Total closing costs</li>
          <li>Break-even timeline (how many months until the savings cover the costs)</li>
          <li>Cash-out amount (if applicable)</li>
        </ul>
        <p className="text-sm text-gray-500 mb-4">
          Not sure if it&apos;s worth it? Use our rate tool to check current pricing for your scenario,
          or reach out for a no-commitment comparison.
        </p>
        <Link href="/rates" className="text-brand font-medium hover:text-brand-dark transition-colors">
          Check Refi Rates &rarr;
        </Link>
      </section>

      {/* Purchase */}
      <section id="purchase" className="mb-14 scroll-mt-24">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Home Purchase Financing</h2>
        <p className="text-gray-600 leading-relaxed mb-4">
          Buying a home? We&apos;ll give you a rate, a payment, and a closing cost breakdown — without the sales pitch.
        </p>
        <p className="text-gray-600 leading-relaxed mb-6">
          We work with buyers who do their own research and want to know the numbers before committing.
          You won&apos;t get follow-up calls you didn&apos;t ask for. You won&apos;t get pressured to apply.
          You&apos;ll get clear information and a direct answer to &ldquo;what will this cost me?&rdquo;
        </p>
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">What we&apos;ll show you</h3>
        <ul className="space-y-2 text-sm text-gray-600 mb-6">
          <li>Rate options across multiple lenders</li>
          <li>Monthly payment (principal, interest, taxes, insurance)</li>
          <li>Down payment scenarios (3%, 5%, 10%, 20%)</li>
          <li>Closing cost estimate</li>
          <li>Pre-approval letter (when you&apos;re ready)</li>
        </ul>
        <Link href="/rates" className="text-brand font-medium hover:text-brand-dark transition-colors">
          See Purchase Rates &rarr;
        </Link>
      </section>

      {/* Loan Types Grid */}
      <section className="mb-14">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Loan Programs We Offer</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="font-semibold text-gray-900 mb-1">Conventional</h3>
            <p className="text-xs text-gray-500 mb-2">As low as 3% down</p>
            <p className="text-sm text-gray-600">Standard financing for qualified borrowers. Best rates for 720+ credit.</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="font-semibold text-gray-900 mb-1">FHA</h3>
            <p className="text-xs text-gray-500 mb-2">3.5% minimum down</p>
            <p className="text-sm text-gray-600">Lower credit or down payment requirements. Credit scores down to 580.</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="font-semibold text-gray-900 mb-1">VA</h3>
            <p className="text-xs text-gray-500 mb-2">0% down</p>
            <p className="text-sm text-gray-600">Active military, veterans, and eligible spouses. No PMI, competitive rates.</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="font-semibold text-gray-900 mb-1">Jumbo</h3>
            <p className="text-xs text-gray-500 mb-2">Down payment varies</p>
            <p className="text-sm text-gray-600">Loan amounts above conforming limits. We funded loans up to $1.2M in 2025.</p>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          All programs available for purchase and refinance. Rate and terms depend on your specific scenario — check the rate tool for current pricing.
        </p>
      </section>

      {/* States We Serve */}
      <section className="mb-14">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Where We&apos;re Licensed</h2>
        <p className="text-gray-600 mb-6">
          We&apos;re currently licensed and originating loans in:
        </p>
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-1">Colorado</h3>
            <p className="text-sm text-gray-600">Our home state and primary market. 92% of our 2025 volume.</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-1">Texas</h3>
            <p className="text-sm text-gray-600">Active and growing. LLC registration in progress for 2026.</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-1">Oregon</h3>
            <p className="text-sm text-gray-600">Licensed and lending.</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-1">California</h3>
            <p className="text-sm text-gray-500 italic">License application in progress. Coming soon.</p>
          </div>
        </div>
        <p className="text-sm text-gray-500">
          We&apos;re an independent broker, not a national bank — we add states where we can genuinely serve borrowers, not just plant a flag.
        </p>
      </section>

      {/* Bottom CTA */}
      <section className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Want to talk through your options?</h2>
        <p className="text-gray-600 mb-6">
          We&apos;ll give you a straight answer — whether that&apos;s &ldquo;refinancing saves you $400/month&rdquo;
          or &ldquo;honestly, it doesn&apos;t make sense right now.&rdquo;
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link
            href="/portal/apply"
            className="bg-brand text-white px-8 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors"
          >
            Apply Now
          </Link>
          <Link
            href="/contact"
            className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg font-medium hover:border-brand hover:text-brand transition-colors"
          >
            Get a Free Quote
          </Link>
        </div>
      </section>
    </div>
  );
}
