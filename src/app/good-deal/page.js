import Link from 'next/link';

export const metadata = {
  title: 'How to Tell If Your Mortgage Rate Is a Good Deal | NetRate Mortgage',
  description: 'The mortgage industry makes it hard to comparison shop on purpose. Here\'s why — and what to watch out for.',
  alternates: {
    canonical: 'https://www.netratemortgage.com/good-deal',
  },
};

export default function GoodDeal() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <nav className="text-sm text-gray-400 mb-8">
        <Link href="/" className="hover:text-brand">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-600">Good Deal</span>
      </nav>

      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
        How to Know If You&apos;re Getting a Good Deal
      </h1>

      <div className="space-y-8 text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Why This Is So Hard</h2>
          <p>
            There are two reasons most borrowers can&apos;t tell if they&apos;re getting a good deal:
          </p>

          <p className="mt-4">
            <strong>1. They don&apos;t know what to look for.</strong> Most people have never been taught how mortgage pricing works. They know they want a &ldquo;good rate&rdquo; but don&apos;t understand how points, credits, and lender margin connect to the number they&apos;re being quoted. Without that knowledge, every offer looks like a different language.{' '}
            <Link href="/how-pricing-works" className="text-brand hover:text-brand-dark font-medium">We break down how pricing works here &rarr;</Link>
          </p>

          <p className="mt-4">
            <strong>2. They can&apos;t get real numbers without committing first.</strong> To get a Loan Estimate — the only document that shows you the actual costs — you have to apply, which means a credit pull. And once you&apos;ve applied and spent an hour on the phone, you&apos;re in the lender&apos;s pipeline.{' '}
            <Link href="/closing-costs" className="text-brand hover:text-brand-dark font-medium">More on what to look for on a Loan Estimate &rarr;</Link>
          </p>

          <blockquote className="border-l-4 border-brand pl-6 py-2 text-gray-800 font-medium italic mt-6">
            The system is set up so that by the time you have enough information to compare, you&apos;re already committed.
          </blockquote>

          <p className="mt-4">
            That&apos;s not an accident. It&apos;s a business model. The less you know and the harder it is to compare, the easier it is for lenders to charge more.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">What to Watch Out For</h2>

          <p className="mt-4">
            <strong>&ldquo;Call for rates&rdquo;</strong> — If a lender won&apos;t publish rates, they&apos;re setting the price based on how much they think they can charge you. The less you know, the higher the margin.
          </p>

          <p className="mt-4">
            <strong>Rates with asterisks</strong> — If the advertised rate has a footnote that says &ldquo;with X points&rdquo; or &ldquo;assumes 800+ FICO,&rdquo; the real rate is higher.
          </p>

          <p className="mt-4">
            <strong>&ldquo;Lock now&rdquo; pressure</strong> — If a lender is pushing you to lock before you&apos;ve compared, they don&apos;t want you to compare.
          </p>

          <p className="mt-4">
            <strong>Unusually low rate + high fees</strong> — A rate that&apos;s lower than everyone else&apos;s but comes with $5,000 more in fees isn&apos;t a better deal — it&apos;s just structured differently. You&apos;re paying for that rate in Section A.{' '}
            <Link href="/closing-costs" className="text-brand hover:text-brand-dark font-medium">What Section A means &rarr;</Link>
          </p>

          <p className="mt-4">
            <strong>&ldquo;We&apos;ll match any rate&rdquo;</strong> — This usually means they&apos;ll match the rate but make it up in fees elsewhere. Ask for the full Loan Estimate, not just a rate quote.
          </p>

          <p className="mt-4">
            <strong>One option, no alternatives</strong> — If a lender gives you one rate and one set of fees with no other options, they chose the one that makes them the most money. A good lender shows you the spectrum — from no-cost to discounted — and lets you decide.{' '}
            <Link href="/points-and-credits" className="text-brand hover:text-brand-dark font-medium">How points and credits work &rarr;</Link>
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">What We Do Differently</h2>
          <p>We built this site to solve both problems.</p>

          <p className="mt-4">
            <strong>Problem 1: You don&apos;t know what to look for.</strong> We wrote an entire series explaining how it works —{' '}
            <Link href="/how-pricing-works" className="text-brand hover:text-brand-dark font-medium">pricing</Link>,{' '}
            <Link href="/closing-costs" className="text-brand hover:text-brand-dark font-medium">closing costs</Link>,{' '}
            <Link href="/points-and-credits" className="text-brand hover:text-brand-dark font-medium">points and credits</Link>,{' '}
            <Link href="/breakeven" className="text-brand hover:text-brand-dark font-medium">breakeven</Link>.
            {' '}Read them. They&apos;re free. And they&apos;ll make you a better-informed borrower whether you use us or not.
          </p>

          <p className="mt-4">
            <strong>Problem 2: You can&apos;t get numbers without committing.</strong> Our rates are on the site, live, updated daily. Every option — rate, APR, points, credits, monthly payment — before you apply, before a credit pull, before you talk to anyone.
          </p>

          <p className="mt-4">
            Compare us to whatever quote you already have. If we&apos;re better, you&apos;ll see it. If we&apos;re not, you&apos;ve lost nothing.
          </p>
        </section>

        <div className="pt-4">
          <Link href="/rates" className="inline-block bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors">
            See Today&apos;s Rates &rarr;
          </Link>
        </div>

        <p className="text-xs text-gray-400 pt-4 border-t border-gray-100">
          This is educational content, not financial advice. Rates and terms vary by loan scenario. Licensed in California, Colorado, Oregon, and Texas. NMLS #1111861.
        </p>
      </div>
    </div>
  );
}
