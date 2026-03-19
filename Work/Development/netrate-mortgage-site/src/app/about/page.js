import Link from 'next/link';

export const metadata = {
  title: 'About | NetRate Mortgage',
  description: 'Meet David Burson, mortgage broker at NetRate Mortgage. Direct-to-consumer lending in CO, OR, and TX.',
};

const VALUE_PROPS = [
  {
    title: 'Why Wholesale?',
    body: 'We shop across 11 lenders to find the lowest rate for your scenario. Banks sell their own products. We sell the market.',
    icon: '⚖️',
  },
  {
    title: 'How It Works',
    body: 'Check real rates on our rate tool — no application, no credit pull. When you\'re ready, we lock the best option and close your loan.',
    icon: '🔧',
  },
  {
    title: 'Direct-to-Consumer',
    body: 'No realtor referral fees. No branch office overhead. No corporate layers. Lower costs = better pricing for you.',
    icon: '🎯',
  },
  {
    title: 'The Rate Tool',
    body: 'Real wholesale pricing — the same data we use to price loans — before you share a single piece of personal information.',
    icon: '📊',
  },
];

const CREDENTIALS = [
  { label: 'NMLS (Individual)', value: '#641790' },
  { label: 'NMLS (Company)', value: '#1111861' },
  { label: 'Licensed States', value: 'CO, TX, OR' },
  { label: 'Founded', value: '2013' },
  { label: 'Loans Funded (2025)', value: '50' },
  { label: 'Volume (2025)', value: '$26.6M' },
  { label: 'App-to-Fund Rate', value: '87.7%' },
  { label: 'Lending Partners', value: '11' },
];

export default function AboutPage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-deep py-16">
        <div className="max-w-5xl mx-auto px-6">
          <h1 className="text-4xl font-extrabold text-white mb-4">
            About NetRate Mortgage
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl leading-relaxed">
            I started brokering mortgages in 2013 under the name Locus Mortgage. The idea was simple:
            help people get better rates by shopping across wholesale lenders instead of going to one bank.
            That idea hasn&apos;t changed. The name has.
          </p>
        </div>
      </section>

      {/* Value Prop Cards */}
      <section className="max-w-5xl mx-auto px-6 -mt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {VALUE_PROPS.map((prop) => (
            <div
              key={prop.title}
              className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="text-2xl mb-3">{prop.icon}</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{prop.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{prop.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Who Is David */}
      <section className="max-w-5xl mx-auto px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-10 items-start">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Meet David Burson</h2>
            <div className="space-y-4 text-gray-600 leading-relaxed">
              <p>
                In 2025, I rebranded to NetRate Mortgage — a name that says what we actually do. We find you
                the net best rate by comparing options across our lending partners. No markup, no loyalty to one
                lender, no games with pricing.
              </p>
              <p>
                I&apos;m based in Louisville, Colorado. I run a lean operation — one loan officer, no branch office
                overhead, no corporate layers. That means lower costs, which means better pricing for you.
              </p>
              <p>
                If you&apos;re the kind of person who does your own research before making a big financial decision,
                you&apos;re exactly who I built this for.
              </p>
            </div>
            <div className="mt-6">
              <Link
                href="/rates"
                className="bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark hover:shadow-[0_0_20px_rgba(34,211,238,0.2)] transition-all inline-block"
              >
                Try the Rate Tool &rarr;
              </Link>
            </div>
          </div>

          {/* Google Reviews */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-10 h-10 rounded-full bg-[#4285f4] text-white flex items-center justify-center text-lg font-extrabold">G</span>
              <div>
                <div className="text-yellow-500 text-lg tracking-wide">★★★★★</div>
                <div className="text-sm text-gray-600"><strong className="text-gray-900">4.9</strong> on Google Reviews</div>
              </div>
            </div>
            <a
              href="https://www.google.com/maps/search/?api=1&query=Locus+Mortgage&query_place_id=ChIJa5-5jCXza4cRptwJxaP23eU"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-brand font-semibold hover:text-brand-dark transition-colors"
            >
              Read Reviews on Google &rarr;
            </a>
          </div>
        </div>
      </section>

      {/* Credentials Grid */}
      <section className="bg-gray-50 border-y border-gray-200 py-12">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-lg font-bold text-gray-900 mb-6 uppercase tracking-wider text-center">Credentials</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {CREDENTIALS.map((cred) => (
              <div key={cred.label} className="bg-white rounded-lg border border-gray-200 p-4 text-center">
                <div className="text-xl font-extrabold text-gray-900 tabular-nums">{cred.value}</div>
                <div className="text-xs text-gray-500 mt-1">{cred.label}</div>
              </div>
            ))}
          </div>
          <div className="text-center mt-6 text-sm text-gray-500">
            <p>357 S McCaslin Blvd., #200, Louisville, CO 80027</p>
            <p className="mt-1">303-444-5251 · david@netratemortgage.com</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand py-14 text-center">
        <h2 className="text-2xl font-extrabold text-white mb-3">Ready to see your rate?</h2>
        <p className="text-brand-light/80 mb-6">No application, no credit pull. Real rates in 30 seconds.</p>
        <Link
          href="/rates"
          className="bg-white text-brand px-8 py-3.5 rounded-xl text-base font-bold hover:bg-gray-100 transition-colors inline-block"
        >
          Check Today&apos;s Rates &rarr;
        </Link>
      </section>
    </div>
  );
}
