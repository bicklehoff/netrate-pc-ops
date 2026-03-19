import Link from 'next/link';

export const metadata = {
  title: 'Mortgage Points vs Lender Credits — Which Option Saves You More? | NetRate Mortgage',
  description: 'Should you pay points for a lower rate, take lender credits for lower closing costs, or go somewhere in between? Here\'s how to think about it.',
};

export default function PointsAndCredits() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <nav className="text-sm text-gray-400 mb-8">
        <Link href="/" className="hover:text-brand">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-600">Points &amp; Credits</span>
      </nav>

      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
        Points, Credits, and the Trade-Off
      </h1>

      <div className="space-y-8 text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">There&apos;s No Such Thing as &ldquo;The Rate&rdquo;</h2>
          <p>
            For every loan, there isn&apos;t one rate — there&apos;s a range of rates, each with a different upfront cost. Lower rate? Higher fees. Lower fees? Higher rate.
          </p>
          <p className="mt-4">
            But that&apos;s not how most lenders present it. Most lenders will ask what you&apos;re looking for — and if you say &ldquo;the lowest rate&rdquo; (which most people do), they&apos;ll show you exactly that. One rate. With points baked in. You&apos;ll see a great rate and then be shocked by the fees on the Loan Estimate. But you got what you asked for.
          </p>
          <p className="mt-4">
            What they won&apos;t show you — unless you ask — is the full spectrum of options. The same loan at a higher rate with no fees. The same loan with a lender credit that reduces your cash to close. The no-cost option. The par rate.
          </p>
          <p className="mt-4">
            This is a decision that can cost or save you thousands of dollars — and most borrowers don&apos;t even know they&apos;re making it, because their lender already made it for them.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">How Discount Points Work</h2>
          <p>
            A full discount point equals 1% of your loan amount. On a $400,000 loan, one point costs $4,000. In exchange, your interest rate drops.
          </p>
          <p className="mt-4">
            But you don&apos;t have to pay a full point. You can pay an eighth of a point, a quarter, a half — whatever makes sense. The cost-to-rate reduction isn&apos;t a fixed ratio either. It depends on the rate sheet that day, and it changes at every increment.
          </p>
          <p className="mt-4">
            Here&apos;s what most borrowers don&apos;t know: <strong>there are sweet spots on every rate sheet.</strong> Wholesale lenders incentivize certain rates — the rate they want brokers to sell that day. At those sweet spots, you get more rate reduction per dollar of points (or more credit per rate bump). A good broker knows where those sweet spots are and can tell you when it makes sense to go an eighth lower — and when it doesn&apos;t.
          </p>
          <p className="mt-4 font-medium">Example:</p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li><strong>No points:</strong> 5.750% rate. Payment: $2,334/month.</li>
            <li><strong>0.5 points ($2,000):</strong> 5.625% rate. Payment: $2,302/month.</li>
            <li><strong>1 point ($4,000):</strong> 5.500% rate. Payment: $2,271/month.</li>
          </ul>
          <p className="mt-4">
            Points are sometimes called &ldquo;buying down the rate.&rdquo; They reduce your monthly payment for the life of the loan — but you have to stay in the loan long enough to recoup what you paid.{' '}
            <Link href="/breakeven" className="text-brand hover:text-brand-dark font-medium">More on that &rarr;</Link>
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">How Lender Credits Work</h2>
          <p>
            Lender credits are the opposite of points. Instead of paying the lender, the lender pays you — in the form of a credit toward your closing costs, both hard and soft.
          </p>
          <p className="mt-4">The trade-off: your rate goes up.</p>
          <p className="mt-4 font-medium">Example:</p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li><strong>No credits:</strong> 5.750% rate. Closing costs: $4,500.</li>
            <li><strong>With credit:</strong> 6.000% rate. Closing costs: $1,500 (lender credit covers $3,000).</li>
          </ul>
          <p className="mt-4">You save $3,000 at closing, but your monthly payment is higher for the life of the loan.</p>
          <p className="mt-4">This is a good option if:</p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li>You want to minimize cash out of pocket at closing</li>
            <li>You plan to refinance or sell within a few years</li>
            <li>You&apos;d rather keep your cash liquid than lock it into the mortgage</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">The &ldquo;No-Cost&rdquo; Option</h2>
          <p>
            A no-cost loan takes lender credits far enough to cover your hard closing costs — Sections A and B. If there&apos;s enough credit, it can cover soft costs (prepaids and escrows) too. Government funding fees (FHA upfront MI, VA funding fee) are exceptions — those typically can&apos;t be covered by credits.
          </p>
          <p className="mt-4">
            &ldquo;No cost&rdquo; doesn&apos;t mean free. It means you&apos;re paying through a higher rate instead of upfront.{' '}
            <Link href="/closing-costs" className="text-brand hover:text-brand-dark font-medium">Hard vs soft costs explained &rarr;</Link>
          </p>
          <p className="mt-4">
            But for borrowers who want the lowest cash-to-close — or who aren&apos;t sure how long they&apos;ll keep the loan — no-cost is worth considering. The only way to know for sure is to run the breakeven math for your specific scenario.{' '}
            <Link href="/breakeven" className="text-brand hover:text-brand-dark font-medium">The Breakeven Question &rarr;</Link>
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">The &ldquo;Par&rdquo; Rate</h2>
          <p>
            In between points and credits, there&apos;s usually a rate where you don&apos;t pay anything extra and you don&apos;t receive any credit. This is sometimes called the &ldquo;par&rdquo; rate — the rate at zero cost.
          </p>
          <p className="mt-4">
            This is the baseline. Everything above it gives you credits; everything below it costs you points.
          </p>
          <p className="mt-4">
            When you&apos;re comparing lenders, the par rate is the most honest comparison — it strips out the points-and-credits trade-off and shows you the lender&apos;s actual pricing.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">How to Decide</h2>
          <p>
            The right option depends on your circumstances — not a fixed number of years. Ask yourself:
          </p>
          <ul className="list-disc pl-6 space-y-4 mt-4">
            <li>
              <strong>Do I think rates are going to drop?</strong> If rates are likely to come down, you&apos;ll probably refinance at some point. Paying points on a loan you&apos;re going to replace doesn&apos;t make sense.
            </li>
            <li>
              <strong>Am I likely to move?</strong> If there&apos;s a chance you&apos;ll sell within the next few years, keep your upfront costs low.
            </li>
            <li>
              <strong>Is my life about to change?</strong> Going self-employed, changing careers, retiring — these can make it harder to refinance later. If you&apos;re locking in a loan you&apos;ll keep for a long time, points might make sense.
            </li>
            <li>
              <strong>Do I need my cash for something else?</strong> Money spent on points is locked into the mortgage. If you&apos;d rather have it available for emergencies, investments, or home improvements, take the credit.
            </li>
          </ul>
          <p className="mt-4">
            If you&apos;re unsure about any of these, lean toward no-cost. You can always refinance into a lower rate later. You can&apos;t get your points back.
          </p>
          <p className="mt-4">
            Our rate tool shows every option on the spectrum — with the breakeven calculated — so you can see the trade-off before you commit.
          </p>
        </section>

        <div className="pt-4">
          <Link href="/rates" className="inline-block bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors">
            Compare Your Options &rarr;
          </Link>
        </div>

        <p className="text-xs text-gray-400 pt-4 border-t border-gray-100">
          This is educational content, not financial advice. Rate and point pricing varies daily. Licensed in California, Colorado, Oregon, and Texas. NMLS #1111861.
        </p>
      </div>
    </div>
  );
}
