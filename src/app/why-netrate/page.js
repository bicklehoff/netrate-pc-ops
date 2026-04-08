import Link from 'next/link';

export const metadata = {
  title: 'How NetRate Charges Less — The Direct Mortgage Model | NetRate Mortgage',
  description: 'No TV ads. No cold calls. No haggling. NetRate Mortgage keeps overhead low and passes the savings to you in the rate. See how the direct model works.',
  alternates: {
    canonical: 'https://netratemortgage.com/why-netrate',
  },
};

export default function WhyNetRate() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <nav className="text-sm text-gray-400 mb-8">
        <Link href="/" className="hover:text-brand">Home</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-600">Why NetRate</span>
      </nav>

      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
        How Can We Charge Less and Still Be Better?
      </h1>

      <div className="space-y-8 text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">The Honest Answer</h2>
          <p>
            Every mortgage broker has access to the same wholesale lenders. The rates we see from UWM, Pennymac, or Rocket Pro are the same rates any licensed broker can pull up.
          </p>
          <p className="mt-4">So how are our rates lower?</p>
          <p className="mt-4">
            It&apos;s not the rates we have access to. It&apos;s what we charge on top of them.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Where Most of Your Rate Goes</h2>
          <p className="mb-4">
            When you get a mortgage from a bank or a big online lender, your rate includes more than just the cost of the money. It includes:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Their TV commercials and Super Bowl ads</li>
            <li>Their branch offices and retail staff</li>
            <li>Their lead generation — buying your data from Zillow, LendingTree, and credit bureaus</li>
            <li>Their sales floor — loan officers calling you back five times, &ldquo;checking in,&rdquo; following up</li>
            <li>Their margin — the spread between what the loan actually costs and what they charge you</li>
          </ul>
          <p className="mt-4">
            All of that gets baked into your rate. You&apos;re not just paying for a mortgage — you&apos;re paying for the machine that sold it to you.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">The NetRate Model: Direct</h2>
          <p>We don&apos;t do any of that.</p>
          <p className="mt-4">
            No television ads. No billboards. No cold calls. No buying leads. No salespeople hounding you with follow-up calls you didn&apos;t ask for.
          </p>
          <p className="mt-4">
            We built a website that shows you the rates — live, updated daily, with the full math behind every option. Rate, APR, points, lender credits, monthly payment. All of it, upfront, before you fill out a single form.
          </p>
          <p className="mt-4">
            Our approach is simple: <strong>educate, show the numbers, and let you decide.</strong>
          </p>
          <p className="mt-4">
            We don&apos;t negotiate back and forth. We don&apos;t play the &ldquo;let me see what I can do&rdquo; game. The rates on the site are the rates. Take them or leave them.
          </p>
          <p className="mt-4">
            Because of this direct approach, our overhead is a fraction of what traditional lenders spend. And that difference doesn&apos;t go into our pocket — it goes into your rate.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Why We Show Our Rates Publicly</h2>
          <p>
            Most lenders won&apos;t show you a rate until you&apos;ve given them your name, phone number, and social security number. There&apos;s a reason for that — they don&apos;t want you to comparison shop.
          </p>
          <p className="mt-4">
            We publish ours because we&apos;re confident in where we stand.
          </p>
          <p className="mt-4">
            We know the market. We track it daily. And we know that when a borrower compares our numbers to what they&apos;ve been quoted elsewhere, the math speaks for itself.
          </p>
          <p className="mt-4">
            That&apos;s not a sales pitch. It&apos;s just what happens when you remove the markup.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">We Don&apos;t Lend Our Own Money (That&apos;s the Point)</h2>
          <p>
            A bank gives you their rate because it&apos;s the only rate they have. They are the lender. If their pricing isn&apos;t competitive that day, too bad.
          </p>
          <p className="mt-4">
            We work differently. As a mortgage broker, we connect you to wholesale lenders — and we work with more than one. That means we can shop your loan across multiple lenders and place it where the pricing is best for your situation.
          </p>
          <p className="mt-4">
            It also means we&apos;re watching the market for you. If rates improve while your loan is in process, we have options. A bank doesn&apos;t — they&apos;re locked into their own product. We&apos;re not locked into anyone.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Same Loan, Lower Cost</h2>
          <p>
            A mortgage through NetRate is not a different product. It&apos;s the same loan you&apos;d get at a bank — same underwriting, same closing process. Your loan gets sold to Fannie Mae, Freddie Mac, or Ginnie Mae like any other conforming loan.
          </p>
          <p className="mt-4">The only difference is what you paid to get it.</p>
          <p className="mt-4">
            If you want to understand the details — how rates are built, what points and credits mean, and how to tell if you&apos;re actually getting a good deal — we wrote a full breakdown:{' '}
            <Link href="/how-pricing-works" className="text-brand hover:text-brand-dark font-medium">How Mortgage Pricing Works &rarr;</Link>
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Don&apos;t Take Our Word for It</h2>
          <p>
            We&apos;re rated 4.9 out of 5 on Google — from real borrowers who closed real loans.
          </p>
          <p className="mt-4">
            Our wholesale lending partners include some of the largest lenders in the country. We&apos;ve been approved, vetted, and audited by each one of them. That doesn&apos;t happen without a track record.
          </p>
          <p className="mt-4">
            <strong><a href="#" className="text-brand hover:text-brand-dark font-medium">Read Our Reviews on Google &rarr;</a></strong>
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">How It Works</h2>
          <ol className="list-decimal pl-6 space-y-4">
            <li>
              <strong>See the rates</strong> — Check today&apos;s rates on our site. No application, no credit pull, no login required.
            </li>
            <li>
              <strong>Compare your options</strong> — Our rate tool shows every combination side by side. You choose what fits your situation.
            </li>
            <li>
              <strong>Apply when you&apos;re ready</strong> — We handle the process from application to closing. One credit pull, one point of contact.
            </li>
          </ol>
          <p className="mt-4">No pressure. No follow-up calls you didn&apos;t ask for.</p>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Who Is NetRate Mortgage?</h2>
          <p>
            David Burson — a licensed mortgage broker in California, Colorado, Oregon, and Texas. NMLS #641790. One person, not a call center. A broker who believes you should see the real numbers before you commit to anything.
          </p>
        </section>

        <div className="pt-4">
          <Link href="/rates" className="inline-block bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors">
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
