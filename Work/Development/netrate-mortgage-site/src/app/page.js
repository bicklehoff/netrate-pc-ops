import Link from 'next/link';
import TrustBar from '@/components/TrustBar';

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            See your actual mortgage rate
            <br />
            <span className="text-brand">before you apply.</span>
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-2">
            Most lenders make you fill out an application before they show you numbers.
            We show you rates first — with the math behind them — so you can decide if it&apos;s worth your time.
          </p>
          <p className="text-sm text-gray-400 mb-8">No application. No credit pull. Just rates.</p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/rates"
              className="bg-brand text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-brand-dark transition-colors"
            >
              Check Today&apos;s Rates
            </Link>
            <Link
              href="/portal/apply"
              className="border border-brand text-brand px-8 py-3 rounded-lg text-lg font-medium hover:bg-brand hover:text-white transition-colors"
            >
              Apply Now
            </Link>
          </div>
        </div>
      </section>

      {/* Trust Checkmark Bar */}
      <TrustBar />

      {/* Rate Teaser */}
      <section className="bg-slate-50 border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-16 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Live Rates, Updated Daily</h2>
          <p className="text-gray-600 max-w-2xl mx-auto mb-8">
            Real wholesale rates from our lending partners — not teaser rates, not averages.
            Pick your loan amount, credit range, and property type and see what you actually qualify for.
          </p>
          <Link
            href="/rates"
            className="bg-brand text-white px-8 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors inline-block"
          >
            See Rate Options &rarr;
          </Link>
        </div>
      </section>

      {/* Why NetRate — 3 Cards */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <p className="text-sm text-gray-500 uppercase tracking-wider text-center mb-10">Why NetRate Mortgage</p>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Rates Before Applications</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Other lenders want your SSN before they show you a number. We built a rate tool that gives you
              real pricing upfront — down to the points, fees, and monthly payment — before you share anything personal.
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Wholesale Access, Broker Pricing</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              As mortgage brokers, we don&apos;t lend our own money. We shop across multiple wholesale lenders
              to find the best rate for your scenario. Same loan, often lower cost than going direct to a bank.
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">50 Loans Funded in 2025</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              We closed $26.6 million in mortgages last year across Colorado, Oregon, and Texas.
              Refinances, purchases, conventional, FHA, VA, and jumbo — from first-time buyers to $1.2M homes.
            </p>
          </div>
        </div>
      </section>

      {/* Google Reviews */}
      <section className="bg-slate-50 border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="text-center mb-10">
            {/* BBB Accredited Badge — Official Seal */}
            <a
              href="https://www.bbb.org/us/co/louisville/profile/mortgage-lenders/locus-mortgage-1296-90159653/#sealclick"
              target="_blank"
              rel="nofollow noopener noreferrer"
              className="inline-block mb-5 hover:opacity-80 transition-opacity"
              aria-label="BBB Accredited Business"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://seal-alaskaoregonwesternwashington.bbb.org/seals/blue-seal-200-42-bbb-90159653.png"
                alt="BBB Accredited Business"
                width={200}
                height={42}
                className="mx-auto"
              />
            </a>

            <div className="flex items-center justify-center gap-1 mb-2">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <p className="text-2xl font-bold text-gray-900">4.9 out of 5</p>
            <p className="text-sm text-gray-500 mt-1">Based on 35 Google Reviews</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Review 1 */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center gap-1 mb-2">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-sm text-gray-600 leading-relaxed mb-3">
                &ldquo;My family and I have worked with David a few times and he is absolutely incredible! He is very knowledgeable, extremely responsive, and truly a wonderful person who helps you through the entire loan process.&rdquo;
              </p>
              <p className="text-xs text-gray-500 font-medium">Sohayla R. &middot; 4 weeks ago</p>
            </div>

            {/* Review 2 */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center gap-1 mb-2">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-sm text-gray-600 leading-relaxed mb-3">
                &ldquo;I&apos;ve worked with Jamie on multiple transactions — two purchases and a refinance — and every single time he delivered exceptional service. His communication, professionalism, and attention to detail are second to none.&rdquo;
              </p>
              <p className="text-xs text-gray-500 font-medium">Alex Z. &middot; 12 weeks ago</p>
            </div>

            {/* Review 3 */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center gap-1 mb-2">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-sm text-gray-600 leading-relaxed mb-3">
                &ldquo;David was an excellent partner in helping me close on a refinance. He worked hard to get me the best rate and was delightfully communicative throughout the process.&rdquo;
              </p>
              <p className="text-xs text-gray-500 font-medium">Charlie B. &middot; Nov 2024</p>
            </div>

            {/* Review 4 */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center gap-1 mb-2">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-sm text-gray-600 leading-relaxed mb-3">
                &ldquo;Jamie brings a calm, friendly and knowledgeable approach to home lending. He consistently has the best rates. When our underwriting took longer than expected, his status with the lender allowed us to hold the rate without penalty.&rdquo;
              </p>
              <p className="text-xs text-gray-500 font-medium">Michael L. &middot; 21 weeks ago</p>
            </div>

            {/* Review 5 */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center gap-1 mb-2">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-sm text-gray-600 leading-relaxed mb-3">
                &ldquo;I recently refinanced and had the best mortgage experience ever. David was very professional and genuinely wanted to find the best deal to fit my needs. I ended up saving much more than I thought I could.&rdquo;
              </p>
              <p className="text-xs text-gray-500 font-medium">Jovita S. &middot; Aug 2021</p>
            </div>

            {/* Review 6 */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <div className="flex items-center gap-1 mb-2">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-sm text-gray-600 leading-relaxed mb-3">
                &ldquo;David is the type of person to listen to what you need and actually work for you. Whenever he quoted us he was correct and there were no surprises. If you want someone to do an honest and great job then use David.&rdquo;
              </p>
              <p className="text-xs text-gray-500 font-medium">Ben W. &middot; May 2019</p>
            </div>
          </div>

          <div className="text-center mt-8">
            <a
              href="https://www.google.com/maps/search/?api=1&query=Locus+Mortgage&query_place_id=ChIJa5-5jCXza4cRptwJxaP23eU"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-brand font-medium text-sm hover:text-brand-dark transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              Read All 35 Reviews on Google
            </a>
            <p className="text-xs text-gray-400 mt-1">Formerly Locus Mortgage</p>
          </div>
        </div>
      </section>

      {/* Services Overview — 3 Cards */}
      <section className="bg-white border-y border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-10">What We Do</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Refinance</h3>
              <p className="text-sm text-gray-600 mb-4">
                Lower your rate, shorten your term, or pull cash from your equity. Refinances are what we do
                most — 54% of our 2025 volume was refi. We&apos;ll show you the break-even math so you can see
                if it makes sense.
              </p>
              <Link href="/services#refinance" className="text-brand text-sm font-medium hover:text-brand-dark transition-colors">
                Learn More &rarr;
              </Link>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Purchase</h3>
              <p className="text-sm text-gray-600 mb-4">
                Buying a home and want to skip the sales pitch? We&apos;ll give you a rate, a payment, and a closing
                cost estimate. You decide if you want to move forward. No pressure, no follow-up calls you didn&apos;t ask for.
              </p>
              <Link href="/services#purchase" className="text-brand text-sm font-medium hover:text-brand-dark transition-colors">
                Learn More &rarr;
              </Link>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Rate Tool</h3>
              <p className="text-sm text-gray-600 mb-4">
                Our pricing engine pulls live wholesale rates and shows you exactly what each option costs —
                rate, points, lender credits, monthly payment. It&apos;s the same data we use to price loans internally.
              </p>
              <Link href="/rates" className="text-brand text-sm font-medium hover:text-brand-dark transition-colors">
                Try the Rate Tool &rarr;
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Credibility */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">Licensed. Independent. Direct.</h2>
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-gray-600">
          <span><strong className="text-gray-900">NMLS #641790 | #1111861</strong> — Federally registered mortgage broker</span>
          <span><strong className="text-gray-900">Licensed in CO, TX, and OR</strong> — CA coming soon</span>
          <span><strong className="text-gray-900">Founded 2013</strong> — Over a decade of mortgage origination</span>
          <span><strong className="text-gray-900">Direct-to-consumer</strong> — We work for you, not a bank and not a realtor</span>
          <span><strong className="text-gray-900">11 wholesale lending partners</strong> — We shop the market so you don&apos;t have to</span>
        </div>

        {/* Trust Badges */}
        <div className="flex items-center justify-center gap-6 mt-10">
          <a
            href="https://nmlsconsumeraccess.org/EntityDetails.aspx/COMPANY/1111861"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-gray-600 transition-colors text-xs font-medium"
            aria-label="NMLS Consumer Access"
          >
            NMLS Consumer Access
          </a>
          <span className="text-gray-300">|</span>
          <div className="text-gray-400 text-xs font-medium flex items-center gap-1.5" aria-label="Equal Housing Opportunity">
            <svg className="w-4 h-4" viewBox="0 0 32 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 2L2 14h4v14h20V14h4L16 2zm-6 24V13.3L16 8l6 5.3V26h-4v-6h-4v6h-4z"/>
            </svg>
            Equal Housing Opportunity
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="bg-brand">
        <div className="max-w-6xl mx-auto px-6 py-16 text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Not Sure Which Rate? Let Us Help.</h2>
          <p className="text-white/80 text-lg mb-8 max-w-2xl mx-auto">
            Tell us about your situation and we&apos;ll send you a personalized recommendation
            with full fee breakdown, cash to close, and savings analysis.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link
              href="/contact"
              className="bg-white text-brand px-8 py-3 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              Get a Free Quote
            </Link>
            <Link
              href="/portal/apply"
              className="border border-white/50 text-white px-8 py-3 rounded-lg text-lg font-medium hover:bg-white/10 transition-colors"
            >
              Apply Now
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
