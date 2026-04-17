import Link from 'next/link';

export const metadata = {
  title: 'How Mortgage Pricing Works — Rates, Points, and Credits Explained | NetRate Mortgage',
  description: 'Most borrowers don\'t know how mortgage rates are built. Learn what drives your rate, how points and lender credits work, and how to tell if you\'re getting a good deal.',
  alternates: {
    canonical: 'https://www.netratemortgage.com/how-pricing-works',
  },
};

export default function HowPricingWorks() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <nav className="text-sm text-gray-400 mb-8">
        <Link href="/" className="hover:text-brand">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-600">How Pricing Works</span>
      </nav>

      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
        How Mortgage Pricing Actually Works
      </h1>

      <div className="space-y-8 text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Rate Is Not One Number</h2>
          <p>
            When someone says &ldquo;I got a 6% rate,&rdquo; they&apos;re leaving out most of the story.
          </p>
          <p className="mt-4">
            A mortgage rate is part of a package. That package includes the interest rate, the points or credits attached to it, and the APR. And those are all driven by the market, your lender&apos;s margin, your loan amount, credit score, property type, occupancy, and loan purpose. Change any one of those inputs and the whole package shifts.
          </p>
          <p className="mt-4">
            Understanding how these pieces fit together is the difference between knowing you got a good deal and hoping you did.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">What Drives Your Rate</h2>
          <p className="mb-4">Your mortgage rate is built from layers:</p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-2">1. The market</h3>
          <p>
            Mortgage rates move with the secondary market — specifically, mortgage-backed securities. This changes daily, sometimes multiple times a day. The market sets the baseline that every lender starts from.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-2">2. The lender&apos;s margin</h3>
          <p>
            On top of the market rate, every lender adds their margin — the amount they charge on top of the rate for their profit and operating costs. Two lenders with access to the same rates can quote you very different numbers — because their margins are different. One lender might add half a point; another might add a full point or more. That difference comes directly out of your pocket, either as a higher rate or higher fees.
          </p>
          <p className="mt-4">
            <strong>This is the only thing you can change.</strong> The market is the market. The LLPAs are standardized — every lender uses the same grid. Your credit score is your credit score. If everything else about your loan is the same, the only variable left is who you go to. The lender&apos;s margin is the one lever you can actually shop — and it&apos;s what determines whether you&apos;re getting a good deal or not.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-2">3. Your loan profile</h3>
          <p>
            Your individual rate is adjusted based on your credit score, loan amount, down payment, property type, and loan purpose. These adjustments are called LLPAs — Loan-Level Price Adjustments. They&apos;re standardized by Fannie Mae and Freddie Mac, so they&apos;re the same no matter which lender you use.
          </p>
          <p className="mt-4">
            Higher credit score, larger down payment, single-family primary residence — those get the best pricing. Lower credit score, investment property, cash-out refinance — those cost more. Every lender uses the same adjustment grid.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Points and Credits: The Trade-Off</h2>
          <p>
            Here&apos;s where most borrowers get confused — and where most lenders take advantage of that confusion.
          </p>
          <p className="mt-4">
            For any given loan, there isn&apos;t one rate. There&apos;s a menu of rates, each with a different cost.
          </p>
          <p className="mt-4">
            <strong>Discount points</strong> are upfront fees you pay to get a lower rate. One point = 1% of the loan amount. On a $400,000 loan, one point costs $4,000 — and it might lower your rate by about 0.25%.
          </p>
          <p className="mt-4">
            <strong>Lender credits</strong> are the opposite. The lender gives you money toward closing costs — in exchange for a higher rate. You pay less upfront, but more per month.
          </p>
          <p className="mt-4">
            <strong>A &ldquo;no-cost&rdquo; option</strong> means the lender credit covers your loan costs — origination fees, lender charges, and sometimes third-party fees like title and appraisal. Your rate is slightly higher, but you bring less cash to closing. (Prepaids like escrows, taxes, and daily interest are separate — those aren&apos;t really &ldquo;costs,&rdquo; they&apos;re your own money being set aside. We break this down in detail here:{' '}
            <Link href="/closing-costs" className="text-brand hover:text-brand-dark font-medium">Understanding Closing Costs &rarr;</Link>)
          </p>
          <p className="mt-4">
            There&apos;s no right answer. It depends on how long you plan to keep the loan. We go deeper on the points vs. credits decision here:{' '}
            <Link href="/points-and-credits" className="text-brand hover:text-brand-dark font-medium">Points, Credits, and the Trade-Off &rarr;</Link>
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">The Breakeven Question</h2>
          <p>
            If you pay points to get a lower rate, there&apos;s a breakeven period — the number of months it takes for the monthly savings to exceed what you paid upfront.
          </p>
          <p className="mt-4 font-medium">Example:</p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li><strong>Option A:</strong> 5.750% with no points. Payment: $2,334/month.</li>
            <li><strong>Option B:</strong> 5.500% with 1 point ($4,000). Payment: $2,271/month.</li>
            <li><strong>Monthly savings:</strong> $63/month.</li>
            <li><strong>Breakeven:</strong> $4,000 &divide; $63 = <strong>63 months (about 5 years).</strong></li>
          </ul>
          <p className="mt-4">
            If you&apos;ll keep the loan longer than 5 years, paying the point saves money. If you&apos;ll refinance or sell sooner, the no-cost option wins.
          </p>
          <p className="mt-4">
            This is one of the most misunderstood concepts in mortgages. Borrowers fixate on getting the lowest rate without realizing they&apos;re paying thousands upfront that they may never recoup. We break this down fully here:{' '}
            <Link href="/breakeven" className="text-brand hover:text-brand-dark font-medium">The Breakeven Question: When Points Make Sense &rarr;</Link>
          </p>
          <p className="mt-4">
            Our rate tool shows you every option side by side — with the breakeven calculated — so you can see the trade-off before you commit.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">APR: The Number That&apos;s Supposed to Help</h2>
          <p>
            APR — Annual Percentage Rate — was created to give borrowers a single number to compare offers. It rolls in the interest rate plus fees, spread over the loan term.
          </p>
          <p className="mt-4">In theory, it&apos;s useful. In practice, it&apos;s confusing because:</p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li>It assumes you keep the loan for the full 30 years (almost nobody does)</li>
            <li>Different lenders include different fees in the APR calculation</li>
            <li>It makes points look more expensive than they sometimes are</li>
          </ul>
          <p className="mt-4">
            APR is worth looking at, but it&apos;s not the whole picture. Compare rate, APR, monthly payment, and total closing costs together. That&apos;s what our rate tool does.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">How to Tell If You&apos;re Getting a Good Deal</h2>
          <p>This is harder than it should be — and that&apos;s by design.</p>

          <p className="mt-4">
            <strong>The Freddie Mac national average</strong> is published weekly, but it&apos;s a lagging indicator. By the time it&apos;s reported, the market has already moved. It&apos;s useful as a rough benchmark, not a real-time comparison.
          </p>

          <p className="mt-4">
            <strong>APR</strong> is supposed to help, but lenders have some discretion in what fees they include in the calculation. Two lenders can show you different APRs on the same deal depending on how they calculate it.
          </p>

          <p className="mt-4">
            <strong>The Loan Estimate</strong> is the most reliable comparison tool. Every lender is required to give you one within 3 business days of application. Section A shows the lender&apos;s own charges — that&apos;s the apples-to-apples number. Section B shows third-party fees — title, appraisal, escrow services. Watch this section too, because lenders can steer you to more expensive providers or tack on extra fees here that inflate your total cost.
          </p>

          <p className="mt-4">
            The problem? To get a Loan Estimate, you have to apply, which means a credit pull. And once you&apos;ve applied and spent an hour on the phone with a loan officer, most people don&apos;t have the energy to start the process over somewhere else. Lenders know this. That&apos;s why they keep you on the phone. That&apos;s why they call back five times before you&apos;ve even decided. Because once they&apos;ve got you on the line, you&apos;re hooked — and they know you&apos;re not going to go through the whole process again with someone else.
          </p>

          <p className="mt-4">
            <strong>Rate sheets</strong> — the actual pricing grids lenders use — are proprietary. You can ask for one, but the lender probably won&apos;t give it to you. They&apos;re not supposed to share them.
          </p>

          <blockquote className="border-l-4 border-brand pl-6 py-2 text-gray-800 font-medium italic mt-6">
            The system is set up so that by the time you have enough information to compare, you&apos;re already committed.
          </blockquote>

          <p className="mt-4">
            <strong>That&apos;s why we built this site the way we did.</strong> You can see our rates — every option, with the math — before you apply, before a credit pull, before you talk to anyone. Compare us to whatever quote you&apos;ve already got. If we&apos;re better, you&apos;ll know. If we&apos;re not, you&apos;ve lost nothing.
          </p>

          <p className="mt-4">
            We go deeper on this topic here:{' '}
            <Link href="/good-deal" className="text-brand hover:text-brand-dark font-medium">How to Know If You&apos;re Getting a Good Deal &rarr;</Link>
          </p>
        </section>

        <div className="pt-4">
          <Link href="/rates" className="inline-block bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors">
            See Today&apos;s Rates &rarr;
          </Link>
        </div>

        <p className="text-xs text-gray-400 pt-4 border-t border-gray-100">
          This is educational content, not financial advice. Rates and terms vary based on individual circumstances. Licensed in California, Colorado, Oregon, and Texas. NMLS #1111861.
        </p>
      </div>
    </div>
  );
}
