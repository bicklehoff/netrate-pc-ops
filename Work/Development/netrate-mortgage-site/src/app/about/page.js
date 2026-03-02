import Link from 'next/link';

export const metadata = {
  title: 'About | NetRate Mortgage',
  description: 'Meet David Burson, mortgage broker at NetRate Mortgage. Direct-to-consumer lending in CO, OR, and TX.',
};

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-10">About NetRate Mortgage</h1>

      {/* David's Story */}
      <div className="space-y-5 text-gray-600 leading-relaxed mb-12">
        <p>
          I started brokering mortgages in 2013 under the name Locus Mortgage. The idea was simple:
          help people get better rates by shopping across wholesale lenders instead of going to one bank.
          That idea hasn&apos;t changed. The name has.
        </p>
        <p>
          In 2025, I rebranded to NetRate Mortgage — a name that says what we actually do. We find you
          the net best rate by comparing options across our lending partners. No markup, no loyalty to one
          lender, no games with pricing.
        </p>
        <p>
          I&apos;m based in Louisville, Colorado and licensed in Colorado, Texas, and Oregon (California is
          in progress). I run a lean operation — one loan officer, no branch office overhead, no corporate
          layers. That means lower costs, which means better pricing for you.
        </p>
      </div>

      {/* Why Direct-to-Consumer */}
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Why Direct-to-Consumer</h2>
      <div className="space-y-5 text-gray-600 leading-relaxed mb-12">
        <p>
          Most mortgage brokers rely on realtors for referrals. I don&apos;t. I work directly with borrowers —
          people who found me on their own, compared their options, and chose to work with me because the
          numbers made sense.
        </p>
        <p>
          That means I&apos;m not chasing referral relationships or spending my time networking at open houses.
          I&apos;m spending it on the part that matters to you: getting you the best rate and closing your loan
          without surprises.
        </p>
        <p>
          If you&apos;re the kind of person who does your own research before making a big financial decision,
          you&apos;re exactly who I built this for.
        </p>
      </div>

      {/* The Rate Tool */}
      <h2 className="text-2xl font-bold text-gray-900 mb-4">The Rate Tool</h2>
      <div className="space-y-5 text-gray-600 leading-relaxed mb-12">
        <p>
          I got tired of the standard mortgage website experience: &ldquo;Fill out this form and someone
          will call you.&rdquo; Nobody wants that.
        </p>
        <p>
          So I built a rate tool that shows you real wholesale pricing — the same data I use to price
          loans — before you share a single piece of personal information. Pick your loan amount, credit
          range, and property type, and you&apos;ll see actual rates with points, lender credits, and monthly
          payments broken down.
        </p>
        <p>
          AI can tell you what a 30-year fixed is. It can&apos;t tell you what YOUR rate is today, for your
          specific scenario. That&apos;s our edge, and we give it away for free on the website.
        </p>
        <div className="mt-6">
          <Link
            href="/rates"
            className="bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors inline-block"
          >
            Try the Rate Tool &rarr;
          </Link>
        </div>
      </div>

      {/* Credentials */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">David Burson — Mortgage Broker</h2>
        <p className="text-sm text-gray-500 mb-4">NMLS #641790 | Company NMLS #1111861</p>
        <ul className="space-y-2 text-sm text-gray-600">
          <li>Licensed in Colorado, Texas, and Oregon</li>
          <li>California license in progress (2026)</li>
          <li>Founded 2013 (originally Locus Mortgage, now NetRate Mortgage)</li>
          <li>50 loans funded in 2025 — $26.6M total volume</li>
          <li>87.7% application-to-funding rate</li>
          <li>11 wholesale lending partners</li>
        </ul>
        <div className="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-600">
          <p>357 S McCaslin Blvd., #200, Louisville, CO 80027</p>
          <p>303-444-5251 | david@netratemortgage.com</p>
        </div>
      </div>
    </div>
  );
}
