import Link from 'next/link';

export const metadata = {
  title: 'Should You Pay Mortgage Points? The Breakeven Math That Tells You | NetRate Mortgage',
  description: 'Paying points for a lower rate sounds smart — but most borrowers never recoup the cost. Here\'s the simple math that shows when it\'s worth it and when it\'s not.',
  alternates: {
    canonical: 'https://www.netratemortgage.com/breakeven',
  },
};

export default function Breakeven() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <nav className="text-sm text-gray-400 mb-8">
        <Link href="/" className="hover:text-brand">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-600">Breakeven</span>
      </nav>

      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
        The Breakeven Question: When Do Points Make Sense?
      </h1>

      <div className="space-y-8 text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">The Myth: &ldquo;I Need to Drop My Rate at Least One Point for It to Make Sense&rdquo;</h2>
          <p>
            This is one of the most common things borrowers say — and it&apos;s not how the math works.
          </p>
          <p className="mt-4">
            Whether a refinance or a rate buydown &ldquo;makes sense&rdquo; has nothing to do with how big the rate drop looks. It&apos;s about the breakeven. On a $5,000,000 loan, dropping an eighth of a point could save a fortune. On a $150,000 loan, dropping a full point might not be worth the upfront cost. The rate drop doesn&apos;t tell you anything by itself. The payback period does.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">The Simple Math</h2>
          <p>
            When you pay points, you&apos;re making a bet: that you&apos;ll keep the loan long enough for the monthly savings to exceed what you paid upfront.
          </p>
          <p className="mt-4">The breakeven period tells you how long that takes.</p>
          <p className="mt-4 font-medium">Example: $400,000 loan, 30-year fixed.</p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li><strong>Option A:</strong> 5.750% with no points. Payment: $2,334/month.</li>
            <li><strong>Option B:</strong> 5.500% with 1 point ($4,000). Payment: $2,271/month.</li>
            <li><strong>Monthly savings:</strong> $63</li>
            <li><strong>Breakeven:</strong> $4,000 &divide; $63 = <strong>63 months — just over 5 years.</strong></li>
          </ul>
          <p className="mt-4">
            If you keep the loan past 63 months, Option B saves you money. If you sell, refinance, or pay off the loan before then, you lost money by paying the point.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Is It Worth It?</h2>
          <p>
            There&apos;s no universal answer. It depends entirely on the breakeven for your specific loan.
          </p>
          <p className="mt-4">
            Run the math: divide what you&apos;d pay in points by the monthly savings. That gives you the number of months to recoup. Then ask yourself whether you&apos;ll realistically keep this loan that long.
          </p>
          <p className="mt-4">
            The problem is that most people can&apos;t predict the future — and paying points is a bet on the future. Rates could drop and you&apos;ll want to refinance. You could get a job offer in another state. Your life could change in ways that make this loan temporary.
          </p>
          <p className="mt-4">
            <strong>The only time points clearly make sense</strong> is when the breakeven is short AND you have high confidence nothing will change. If the payback is 18 months and you know you&apos;re staying put, that&apos;s a good deal. If the payback is 5 years and you&apos;re not sure about anything — it&apos;s not.
          </p>
          <p className="mt-4">
            When in doubt, don&apos;t pay points. You can&apos;t get them back.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">The Cost of Waiting</h2>
          <p>
            There&apos;s a flip side to the breakeven question that almost nobody talks about: <strong>what does it cost you to NOT act?</strong>
          </p>
          <p className="mt-4">
            We&apos;ve had borrowers wait two, three years to refinance — holding out for rates to drop further. They&apos;re still waiting. Meanwhile, they could have done a no-cost refinance — zero out of pocket — and been saving $350 a month the entire time. They weren&apos;t being asked to spend money. They were being offered free savings, and they said no because it wasn&apos;t enough.
          </p>
          <p className="mt-4">
            Do the math: $350/month x 36 months = <strong>$12,600</strong> they didn&apos;t save because they were waiting for a &ldquo;better&rdquo; deal.
          </p>
          <p className="mt-4">
            The most common thing we hear is: &ldquo;That hardly moves the needle.&rdquo; But think about what $350/month actually is. That&apos;s $4,200 a year. Over 10 years, that&apos;s $42,000. Invested at a modest return, it&apos;s more. That&apos;s not &ldquo;hardly moving the needle&rdquo; — that&apos;s a retirement contribution, a college fund, or a paid-off car.
          </p>
          <p className="mt-4">
            Perfect is the enemy of good. The borrowers who wait for the perfect rate are running a breakeven calculation in reverse — and losing. Every month you wait for a better deal, you&apos;re paying the higher rate. That cost is real, it&apos;s accumulating, and you don&apos;t get it back.
          </p>

          <blockquote className="border-l-4 border-brand pl-6 py-2 text-gray-800 font-medium italic mt-6">
            The best time to refinance isn&apos;t when rates hit bottom. It&apos;s when the math works — and the math might already work today.
          </blockquote>

          <p className="mt-4">
            Use our{' '}
            <Link href="/tools/cost-of-waiting" className="text-brand hover:text-brand-dark font-medium">Cost of Waiting Calculator &rarr;</Link>
            {' '}to see exactly what you&apos;re losing by not acting — and what a no-cost refinance could save you starting today.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">The Hidden Problem with Points</h2>
          <p>
            Even when the breakeven math works out, there&apos;s an opportunity cost. That $4,000 you spent on points could have been:
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li>Invested in the stock market (historical average ~7-10% annual return)</li>
            <li>Used for home improvements that increase property value</li>
            <li>Kept as an emergency fund</li>
            <li>Applied toward principal to pay down the loan faster</li>
          </ul>
          <p className="mt-4">
            Paying points is essentially lending money to your lender at whatever rate the point buys down. If a point saves you 0.25% on a $400,000 loan, you&apos;re earning roughly a 6% return on that $4,000 — but only if you keep the loan long enough. And that return is locked up in the mortgage — you can&apos;t get it back without refinancing or selling.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">What About Half a Point?</h2>
          <p>
            You don&apos;t have to pay a full point. Lenders offer fractional points — 0.25, 0.5, 0.75 — with proportional rate reductions.
          </p>
          <p className="mt-4">
            Sometimes a small amount of points gets you just below a pricing threshold that makes a meaningful difference. Your loan officer (or our rate tool) can show you exactly where those breakpoints are.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">The Right Way to Compare</h2>
          <p>
            Don&apos;t compare rates. Compare total cost over the time you plan to keep the loan.
          </p>
          <p className="mt-4">
            Our rate tool shows every option — from maximum credits (lowest closing costs, highest rate) to maximum points (highest closing costs, lowest rate) — with the breakeven calculated for each.
          </p>
          <p className="mt-4">
            Pick the option that matches how long you&apos;ll actually keep the loan. Not the option with the lowest rate on paper.
          </p>
        </section>

        <div className="pt-4">
          <Link href="/rates" className="inline-block bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors">
            See All Your Options &rarr;
          </Link>
        </div>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">The Bottom Line</h2>
          <p>
            If someone tells you &ldquo;it doesn&apos;t make sense unless the rate drops a full point,&rdquo; ask them to run the breakeven. On a large enough loan, an eighth of a point could pay for itself in months. On a smaller loan, a full point might never pay off. The size of the rate drop is irrelevant — the payback period is everything.
          </p>
          <p className="mt-4">
            The lowest rate isn&apos;t always the best deal. The best deal is the one that costs you the least over the time you&apos;ll actually have the loan.
          </p>
        </section>

        <p className="text-xs text-gray-400 pt-4 border-t border-gray-100">
          This is educational content, not financial advice. Rate and point pricing varies daily and by loan scenario. Licensed in California, Colorado, Oregon, and Texas. NMLS #1111861.
        </p>
      </div>
    </div>
  );
}
