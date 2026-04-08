import Link from 'next/link';

export const metadata = {
  title: 'What Are Closing Costs? The Three Categories Most Borrowers Don\'t Know | NetRate Mortgage',
  description: 'Closing costs aren\'t one thing — they\'re three different categories lumped together. Learn the difference between loan costs, third-party fees, and prepaids so you know what you\'re actually paying.',
  alternates: {
    canonical: 'https://netratemortgage.com/closing-costs',
  },
};

export default function ClosingCosts() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <nav className="text-sm text-gray-400 mb-8">
        <Link href="/" className="hover:text-brand">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-600">Closing Costs</span>
      </nav>

      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
        Understanding Closing Costs
      </h1>

      <div className="space-y-8 text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">&ldquo;Closing Costs&rdquo; Is a Misleading Term</h2>
          <p>
            On page 1 of every Loan Estimate, there&apos;s a field called &ldquo;Estimated Closing Costs.&rdquo; It shows one number — say, $7,361. What it doesn&apos;t tell you is that number includes three very different types of charges lumped together. Some are negotiable, some aren&apos;t, and some aren&apos;t really costs at all. Understanding the difference changes how you evaluate any mortgage offer.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Category 1: Loan Costs (Section A of Your Loan Estimate)</h2>
          <p>These are the charges your lender controls.</p>
          <p className="mt-4">
            <strong>Important:</strong> Section A varies a lot between lenders — but not always for the reason you&apos;d think. A lender with a low Section A might just be giving you a higher rate (lender credits reduce your upfront costs). A lender with a high Section A might be offering a lower rate (because you&apos;re paying points). If you only compare Section A without comparing the rate, you might think one offer is cheaper when it&apos;s actually just structured differently.
          </p>
          <p className="mt-4">
            You need both numbers — the rate AND Section A — to compare. One without the other is meaningless.
          </p>
          <p className="mt-4">Loan costs include:</p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li><strong>Origination fees</strong> — what the lender or broker charges to do the loan</li>
            <li><strong>Discount points</strong> — upfront fees you pay to buy down the rate</li>
            <li><strong>Underwriting fees</strong> — what the lender charges to review and approve your file</li>
            <li><strong>Processing fees</strong> — administrative costs for handling your application</li>
          </ul>
          <p className="mt-4">
            This is the section you should compare across lenders. If one lender&apos;s Section A is $3,000 higher than another&apos;s, that&apos;s $3,000 more in their pocket — not yours.
          </p>
          <p className="mt-4">
            When we talk about a &ldquo;no-cost&rdquo; loan, we mean the lender credit covers these charges.{' '}
            <Link href="/points-and-credits" className="text-brand hover:text-brand-dark font-medium">How that trade-off works &rarr;</Link>
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Category 2: Third-Party Fees (Section B of Your Loan Estimate)</h2>
          <p>
            These are services required to close the loan, but provided by outside companies — not your lender.
          </p>
          <p className="mt-4">Third-party fees include:</p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li><strong>Appraisal</strong> — an independent valuation of the property</li>
            <li><strong>Title search and title insurance</strong> — verifying ownership and protecting against claims</li>
            <li><strong>Escrow/settlement fees</strong> — the company that handles the closing</li>
            <li><strong>Credit report fee</strong> — pulling your credit</li>
            <li><strong>Recording fees</strong> — county charges to record the deed and mortgage</li>
            <li><strong>FHA upfront mortgage insurance premium</strong> — if applicable (this is a one-time fee on FHA loans, separate from the monthly MI)</li>
            <li><strong>Survey or flood certification</strong> — if required</li>
          </ul>
          <p className="mt-4">
            These fees are roughly similar no matter which lender you use — but not always. Some lenders steer you to affiliated title companies or add markups on third-party services. That&apos;s why Section B of the Loan Estimate matters too.
          </p>
          <p className="mt-4">
            If a lender&apos;s third-party fees seem unusually high compared to another lender&apos;s, ask why.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Category 3: Prepaids and Escrows (Section F and G of Your Loan Estimate)</h2>
          <p>
            The Loan Estimate calls these &ldquo;Other Costs&rdquo; — and borrowers see them as exactly that: costs. They&apos;re money you have to bring to closing, and if you roll them into the loan, they increase your loan amount. So they&apos;re real.
          </p>
          <p className="mt-4">
            But they&apos;re different from Sections A and B in one important way: they&apos;re not charges <em>for</em> the loan. They&apos;re charges <em>because of</em> the property.
          </p>
          <p className="mt-4">Prepaids and escrows include:</p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li><strong>Prepaid interest</strong> — the daily interest from your closing date to the end of the month</li>
            <li><strong>Homeowners insurance premium</strong> — usually the first year, paid upfront</li>
            <li><strong>Property taxes</strong> — a few months held in escrow as a cushion</li>
            <li><strong>Escrow reserves</strong> — additional months of taxes and insurance the lender holds as a buffer</li>
          </ul>
          <p className="mt-4">
            These amounts are roughly the same no matter which lender you use — because they&apos;re based on your property, not your lender&apos;s pricing.
          </p>
          <p className="mt-4">
            When comparing lenders, prepaids won&apos;t help you tell the difference. Two lenders quoting the same loan will have nearly identical prepaids. The real difference is in Sections A and B.
          </p>
          <p className="mt-4">
            <strong>If you&apos;re refinancing,</strong> the cash flow around prepaids gets more complicated — your old escrow account gets refunded, a new one starts, and the timing can affect how much cash you actually need at closing. We explain that scenario in detail here:{' '}
            <Link href="/refinance-playbook" className="text-brand hover:text-brand-dark font-medium">The Refinance Playbook &rarr;</Link>
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">The Number That Matters for Comparison</h2>
          <p>
            You cannot compare Section A in isolation. You have to compare the rate AND Section A together — because they move in opposite directions. A low Section A with a high rate isn&apos;t a better deal; it&apos;s a different structure.
          </p>
          <p className="mt-4">When comparing offers, look at:</p>
          <ol className="list-decimal pl-6 space-y-2 mt-2">
            <li><strong>The rate</strong> — at the same point/credit level (ideally par — zero points, zero credits)</li>
            <li><strong>Section A</strong> — at that same rate</li>
            <li><strong>Section B</strong> — to catch any inflated third-party fees</li>
          </ol>
          <p className="mt-4">
            One more thing: origination fees and discount points are often calculated as a percentage of the loan amount. That means the dollar amounts on two Loan Estimates can look very different even when the percentages are the same. A borrower with a $1,000,000 loan paying half a point sees $5,000 in Section A. A borrower with a $200,000 loan paying the same half point sees $1,000. Same deal, very different-looking numbers. Always compare the percentage, not just the dollar amount.
          </p>
          <p className="mt-4">
            Prepaids (Sections F and G) are real money at closing, but they&apos;ll be nearly the same across lenders for the same property. They don&apos;t help you tell which offer is better.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Hard Costs vs Soft Costs</h2>
          <p>Here&apos;s a simpler way to think about it:</p>
          <p className="mt-4">
            <strong>Hard closing costs</strong> are Sections A and B — the costs you would only pay by doing a new loan. If you don&apos;t get a mortgage, you don&apos;t pay these. Origination, underwriting, appraisal, title, escrow — all hard costs.
          </p>
          <p className="mt-4">
            <strong>Soft closing costs</strong> are the prepaids and escrows — costs you pay whether you do a new loan or not. Property taxes, homeowners insurance, daily interest — you owe these regardless. The loan just collects them at closing.
          </p>
          <p className="mt-4">
            This distinction matters because it changes what &ldquo;no cost&rdquo; actually means.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Where &ldquo;No-Cost&rdquo; Fits In</h2>
          <p>
            A no-cost loan means the lender credit covers your hard closing costs — Sections A and B. Your rate is slightly higher in exchange.
          </p>
          <p className="mt-4">
            There are exceptions: government funding fees (FHA upfront mortgage insurance premium, VA funding fee) typically can&apos;t be covered by lender credits. Those are either paid upfront or rolled into the loan amount.
          </p>
          <p className="mt-4">
            A no-cost loan does NOT mean you bring zero dollars to closing. Soft costs (prepaids and escrows) are still there. Down payment is still there. You&apos;re just not paying the hard costs — the fees that only exist because you&apos;re doing a loan.
          </p>
          <p className="mt-4">
            For a deeper look at whether no-cost makes sense for you:{' '}
            <Link href="/breakeven" className="text-brand hover:text-brand-dark font-medium">The Breakeven Question &rarr;</Link>
          </p>
        </section>

        <div className="pt-4">
          <Link href="/rates" className="inline-block bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors">
            See Today&apos;s Rates &rarr;
          </Link>
          <span className="block text-sm text-gray-500 mt-2">Every option shows the full cost breakdown.</span>
        </div>

        <p className="text-xs text-gray-400 pt-4 border-t border-gray-100">
          This is educational content, not financial advice. Closing costs vary based on loan type, property location, and lender. Licensed in California, Colorado, Oregon, and Texas. NMLS #1111861.
        </p>
      </div>
    </div>
  );
}
