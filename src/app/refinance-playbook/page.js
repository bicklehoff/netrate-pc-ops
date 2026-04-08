import Link from 'next/link';

export const metadata = {
  title: 'How to Structure a Refinance — Four Strategies and How the Cash Flow Works | NetRate Mortgage',
  description: 'There\'s more than one way to refinance. Here are four strategies — from no-cost to buying the rate down — and how the cash flow actually works.',
  alternates: {
    canonical: 'https://netratemortgage.com/refinance-playbook',
  },
};

export default function RefinancePlaybook() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <nav className="text-sm text-gray-400 mb-8">
        <Link href="/" className="hover:text-brand">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-600">Refinance Playbook</span>
      </nav>

      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
        The Refinance Playbook: Four Ways to Structure Your Refinance
      </h1>

      <div className="space-y-8 text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">The Balance-to-Balance Transaction</h2>
          <p className="text-sm text-gray-500 italic mb-4">
            Note: &ldquo;Balance-to-balance,&rdquo; &ldquo;hard costs,&rdquo; and &ldquo;soft costs&rdquo; aren&apos;t official mortgage industry terms — they&apos;re the way we explain it because the official terminology makes things harder to understand, not easier.
          </p>
          <p>
            When you refinance, you&apos;re replacing one loan with another. There&apos;s no single &ldquo;right&rdquo; way to structure it — it depends on your priorities. Here are four approaches, starting with the one that keeps your loan amount flat.
          </p>
          <p className="mt-4">
            A <strong>balance-to-balance transaction</strong> means your current payoff equals your new loan amount. You don&apos;t add to what you owe. You just swap one loan for a better one.
          </p>
          <p className="mt-4">
            One thing to know: your current payoff is not the same as your current principal balance. Your payoff includes interest that has accrued since your last payment — because mortgage interest accrues in arrears. So the payoff will be slightly higher than what you see on your statement.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">How It Works</h2>
          <p>
            In a balance-to-balance refinance, the lender credit covers your hard closing costs — Sections A and B of the Loan Estimate.{' '}
            <Link href="/closing-costs" className="text-brand hover:text-brand-dark font-medium">What are hard costs? &rarr;</Link>
          </p>
          <p className="mt-4">
            That takes care of the loan costs. But there&apos;s still money due at closing for soft costs — the new escrow account (property taxes and insurance reserves) and prepaid interest. These are pass-through expenses — they&apos;re your costs as a homeowner, not costs of the loan. But they still show up on the Loan Estimate, and they still need to be funded.
          </p>
          <p className="mt-4">
            So if the new loan amount equals your payoff, and the lender credit covers Sections A and B, <strong>who pays for the escrow setup and prepaids?</strong>
          </p>
          <p className="mt-4">The answer: the borrower brings that cash to closing.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Why That&apos;s Not as Bad as It Sounds</h2>
          <p>Here&apos;s where the cash flow works in your favor.</p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-2">1. You &ldquo;miss&rdquo; a payment.</h3>
          <p>
            Because mortgage interest accrues in arrears, there&apos;s a month where no payment is due — your old loan has been paid off and your new loan&apos;s first payment isn&apos;t due yet. That&apos;s real cash that stays in your pocket. If your current payment is $3,000, that&apos;s $3,000 you didn&apos;t spend that month.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-2">2. You get an escrow refund.</h3>
          <p>
            Your old lender has been holding an escrow cushion — your money, set aside for taxes and insurance. When the old loan is paid off, that escrow account closes and the balance is refunded to you, typically within 20-30 business days. That refund is usually about 80% of what you funded for the new escrow account — sometimes more, depending on timing.
          </p>

          <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-2">Put it together:</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>You bring, say, $8,000 to closing for escrow setup and prepaids</li>
            <li>Within 30 days, you receive ~$4,000 back from the missed payment you didn&apos;t make</li>
            <li>Within 30 days, you receive ~$4,000 back from the old escrow refund</li>
            <li><strong>Net cash flow: close to zero</strong></li>
          </ul>
          <p className="mt-4">
            You brought money to closing, but it came back. The timing is weeks, not months. And during that same period, your new lower payment kicks in.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">The Net Result</h2>
          <p>On a properly structured balance-to-balance refinance:</p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li><strong>Loan amount:</strong> Same as your old payoff — you didn&apos;t add to your debt</li>
            <li><strong>Hard closing costs:</strong> $0 — covered by lender credit</li>
            <li><strong>Cash to closing:</strong> Escrow setup + prepaids (real money, but temporary)</li>
            <li><strong>Cash back within 30 days:</strong> Missed payment + old escrow refund (offsets what you brought)</li>
            <li><strong>Net out-of-pocket:</strong> Close to zero — often exactly zero</li>
            <li><strong>Monthly savings:</strong> Starts immediately with the lower payment</li>
          </ul>
          <p className="mt-4">
            This is what a no-cost refinance actually looks like when you trace the cash flow. The borrower didn&apos;t spend money. They didn&apos;t increase their loan. They lowered their rate, lowered their payment, and the cash flow balanced out within a month.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Option 2: Roll Everything In</h2>
          <p>
            Balance-to-balance isn&apos;t the only way to structure a refinance. Some borrowers want maximum cash freedom — and that means a different trade-off.
          </p>
          <p className="mt-4">
            Let&apos;s say you&apos;re at 7.5% and can refinance to 6%. You want to:
          </p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li>Miss two payments instead of one</li>
            <li>Get your old escrow refund and keep it</li>
            <li>Bring zero cash to closing</li>
            <li>Still lower your rate and payment</li>
          </ul>
          <p className="mt-4">
            This is achievable. How? You roll everything into the new loan — hard costs, soft costs, escrow setup, all of it. The lender credit covers Section A and B, and the remaining items get added to the loan balance.
          </p>
          <p className="mt-4">
            <strong>The trade-off:</strong> Your new loan amount is higher than your current payoff. You&apos;re adding to your debt. But you&apos;re also dropping your rate significantly, lowering your payment, keeping thousands of dollars in your pocket (missed payments + escrow refund), and not spending a dime out of pocket.
          </p>
          <p className="mt-4">
            For a borrower going from 7.5% to 6%, even with a slightly higher loan amount, the monthly savings are substantial — and the cash they freed up is real money they can use immediately.
          </p>
          <p className="mt-4">
            This isn&apos;t the right choice for everyone. If keeping your loan amount flat matters to you, balance-to-balance is the way. But if freeing up cash while lowering your rate is the priority, rolling everything in is a legitimate option.
          </p>
          <p className="mt-4">
            The key is understanding the trade-off — and making the choice intentionally, not having someone else make it for you.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Option 3: Split the Difference</h2>
          <p>
            Sometimes balance-to-balance requires bringing too much cash, and rolling everything in pushes the loan amount past what the home will appraise for. The solution is somewhere in between.
          </p>
          <p className="mt-4">
            Here&apos;s how it works: you raise the rate slightly — maybe an eighth — to generate a larger lender credit. That extra credit covers more of the soft costs at closing, so you bring less (or no) cash to the table. Your loan amount goes up a little, but stays within the appraised value — say, 80% loan-to-value.
          </p>
          <p className="mt-4 font-medium">When this makes sense:</p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li>Your hard stop is &ldquo;I don&apos;t want to bring cash to closing&rdquo;</li>
            <li>You&apos;re less concerned about the loan amount, but the appraisal limits how much you can roll in</li>
            <li>The rate difference between balance-to-balance and this option is small enough that the monthly payment barely changes</li>
          </ul>
          <p className="mt-4">
            This is a judgment call — and it&apos;s exactly the kind of scenario where having a broker who knows the rate sheet matters. A small rate bump at the right spot on the pricing grid can generate enough credit to close the gap without meaningfully changing your payment.
          </p>
          <p className="mt-4">
            We&apos;re building a calculator to model all four options side by side so you can see the trade-offs before you decide.{' '}
            <Link href="/tools/refi-analyzer" className="text-brand hover:text-brand-dark font-medium">Refinance Calculator &rarr;</Link>
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Option 4: Buy the Rate Down</h2>
          <p>
            The first three options all use lender credits to minimize or eliminate closing costs. This one goes the other direction.
          </p>
          <p className="mt-4">
            If you don&apos;t think rates are going to drop — or if this is the last time you plan to refinance — paying points to buy down the rate can make sense. You pay higher closing costs upfront, but you get a lower rate and a lower payment for the life of the loan.
          </p>
          <p className="mt-4">
            This is the opposite of no-cost. You&apos;re spending money now to save money later. The trade-off works if the breakeven is short enough and you&apos;re confident you&apos;ll keep the loan.{' '}
            <Link href="/breakeven" className="text-brand hover:text-brand-dark font-medium">How to run the breakeven math &rarr;</Link>
          </p>
          <p className="mt-4 font-medium">When this makes sense:</p>
          <ul className="list-disc pl-6 space-y-2 mt-2">
            <li>You believe rates are at or near bottom and won&apos;t drop further</li>
            <li>You&apos;re not planning to move or refinance again</li>
            <li>You have cash available and want the lowest possible monthly payment</li>
            <li>The breakeven on the points is short enough to justify the upfront cost</li>
          </ul>
          <p className="mt-4">
            This is a legitimate strategy — but only if you go in with your eyes open. Most borrowers default to &ldquo;give me the lowest rate&rdquo; without running the math. Don&apos;t be that borrower.{' '}
            <Link href="/points-and-credits" className="text-brand hover:text-brand-dark font-medium">Points, Credits, and the Trade-Off &rarr;</Link>
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">&ldquo;Do I Skip a Payment?&rdquo;</h2>
          <p>
            Technically, no. Interest is still accruing on the new loan from the day it closes — that&apos;s what prepaid interest covers at closing. But there is a month where no payment is due, and that&apos;s real cash you keep.
          </p>
          <p className="mt-4">
            You&apos;re not getting a free month. You&apos;re benefiting from the way mortgage interest timing works. It&apos;s a legitimate part of the refinance cash flow, not a gimmick.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Why This Matters</h2>
          <p>
            When borrowers see the Loan Estimate for a refinance and it shows $8,000 or more in &ldquo;Estimated Cash to Close,&rdquo; they often walk away. They think they need to write a check for $8,000 and they&apos;ll never see it again.
          </p>
          <p className="mt-4">
            But most of that number is escrow and prepaids — and most of it comes back within weeks. The actual cost of the refinance, on a balance-to-balance no-cost structure, is zero. The cash flow is a timing issue, not a cost issue.
          </p>
          <p className="mt-4">
            This is the conversation we have with every refinance borrower. Once they see how the money flows — out at closing, back within a month — the decision becomes much simpler.
          </p>
          <p className="mt-4">
            <Link href="/breakeven" className="text-brand hover:text-brand-dark font-medium">Is it worth it? The breakeven math &rarr;</Link>
          </p>
        </section>

        <div className="pt-4">
          <Link href="/rates" className="inline-block bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors">
            See Today&apos;s Rates &rarr;
          </Link>
        </div>

        <p className="text-xs text-gray-400 pt-4 border-t border-gray-100">
          This is educational content, not financial advice. Escrow refund amounts and timing vary by lender, servicer, and time of year. Licensed in California, Colorado, Oregon, and Texas. NMLS #1111861.
        </p>
      </div>
    </div>
  );
}
