import Link from 'next/link';
import TrustBar from '@/components/TrustBar';
import StickyRateBar from '@/components/StickyRateBar';
import { getHomepageRatesFromDB } from '@/lib/rates/homepage-db';

// Revalidate every 30 min — rates change once/day when new sheet is parsed
export const revalidate = 1800;

// Sentiment → consumer-friendly label + color
const SENTIMENT_MAP = {
  bearish: { label: 'Trending Higher', textClass: 'text-red-600', bgClass: 'bg-red-50 border-red-200' },
  bullish: { label: 'Trending Lower', textClass: 'text-green-700', bgClass: 'bg-green-50 border-green-200' },
  neutral: { label: 'Stable', textClass: 'text-brand', bgClass: 'bg-brand/10 border-brand/20' },
};

async function getMarketSentiment() {
  try {
    const base = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
    const res = await fetch(`${base}/api/market/summary`, { next: { revalidate: 1800 } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.summary?.sentiment || null;
  } catch {
    return null;
  }
}

export default async function HomePage() {
  // ─── Live Rate Data (from DB via pricing-v2 engine) ───
  const liveRates = await getHomepageRatesFromDB();

  // ─── Market Sentiment (from Rate Watch commentary) ───
  const sentiment = await getMarketSentiment();
  const market = SENTIMENT_MAP[sentiment] || SENTIMENT_MAP.neutral;

  // ─── Display Values (live → fallback) ──────────────────────
  const d = liveRates;

  function fmtRate(product) {
    return product ? `${product.rate.toFixed(3)}%` : null;
  }
  function fmtApr(product) {
    return product ? `${product.apr.toFixed(2)}%` : null;
  }
  function fmtPayment(product) {
    return product ? `$${product.payment.toLocaleString()}` : null;
  }

  const conv30Rate = fmtRate(d?.conv30) || '5.875%';
  const conv30Apr = fmtApr(d?.conv30) || '5.94%';
  const conv30Payment = fmtPayment(d?.conv30) || '$2,366';
  const effectiveDateShort = d?.dateShort || 'Mar 24, 2026';

  const heroProducts = [
    { product: '30-Yr Fixed', label: 'Conforming', rate: conv30Rate, apr: conv30Apr },
    { product: '15-Yr Fixed', label: 'Conforming', rate: fmtRate(d?.conv15) || '5.250%', apr: fmtApr(d?.conv15) || '5.38%' },
    { product: 'FHA 30-Yr', label: 'Government', rate: fmtRate(d?.fha30) || '5.500%', apr: fmtApr(d?.fha30) || '6.12%' },
    { product: 'VA 30-Yr', label: 'Military', rate: fmtRate(d?.va30) || '5.375%', apr: fmtApr(d?.va30) || '5.52%' },
  ];

  return (
    <div>
      <StickyRateBar rate={conv30Rate} apr={conv30Apr} />

      {/* ===== RATE TICKER (animated) ===== */}
      <div className="bg-[#F5F7FA] border-b border-gray-200 overflow-hidden">
        <div className="ticker-track text-[12px] py-2 whitespace-nowrap">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex items-center gap-8 px-8 shrink-0">
              <span className="text-[#a0a0a0] font-medium uppercase tracking-wider text-[10px]">Today&apos;s Rate</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[#111827]">NetRate Mortgage 30-Yr Fixed</span>
                <span className="text-brand font-bold">{conv30Rate}</span>
                <span className="text-[#6B7280] text-[11px]">APR {conv30Apr}</span>
              </div>
              <div className="w-px h-3.5 bg-gray-300" />
              <div className="flex items-center gap-1.5">
                <span className="text-[#6B7280]">Monthly P&amp;I</span>
                <span className="text-[#111827] font-bold">{conv30Payment}</span>
                <span className="text-[#a0a0a0] text-[11px]">$400K loan</span>
              </div>
              <div className="w-px h-3.5 bg-gray-300" />
              <div className="flex items-center gap-1.5">
                <span className="text-[#6B7280]">Scenario</span>
                <span className="text-[#111827]">780+ FICO &middot; 75% LTV &middot; Purchase</span>
              </div>
              <div className="w-px h-3.5 bg-gray-300" />
              <div className="flex items-center gap-1.5">
                <a href="/rate-watch" className="text-brand hover:text-brand-dark transition-colors">
                  Rate Watch &rarr;
                </a>
              </div>
              <div className="w-px h-3.5 bg-gray-300" />
              <span className="text-[#a0a0a0] text-[11px]">{effectiveDateShort}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ===== HERO — white background ===== */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-16 lg:py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left — Text */}
          <div>
            {/* Trust strip */}
            <div className="flex items-center gap-2.5 mb-5 flex-wrap">
              <a
                href="https://www.google.com/maps/search/?api=1&query=Locus+Mortgage&query_place_id=ChIJa5-5jCXza4cRptwJxaP23eU"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-gray-100 rounded-full pl-1.5 pr-3 py-1 hover:bg-gray-200 transition-colors"
              >
                <span className="w-5 h-5 rounded-full bg-[#4285f4] text-white flex items-center justify-center text-[10px] font-extrabold flex-shrink-0">G</span>
                <span className="text-[#111827] text-xs tracking-wide">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
                <span className="text-[#111827] font-bold text-xs">4.9</span>
              </a>
              <a
                href="https://www.bbb.org/us/co/louisville/profile/mortgage-lenders/locus-mortgage-1296-90159653#sealclick"
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1 hover:bg-gray-200 transition-colors"
              >
                <span className="text-xs font-semibold text-[#111827]">BBB A+</span>
              </a>
              <a
                href="https://nmlsconsumeraccess.org/EntityDetails.aspx/COMPANY/1111861"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1 hover:bg-gray-200 transition-colors"
              >
                <span className="text-xs font-semibold text-[#6B7280]">NMLS #1111861</span>
              </a>
              <div className="inline-flex items-center gap-2 bg-brand/10 border border-brand/20 rounded-full px-3 py-1 text-[11px] font-semibold text-brand">
                <span className="w-1.5 h-1.5 bg-brand rounded-full animate-pulse" />
                Rates updated today
              </div>
            </div>

            <h1 className="text-4xl lg:text-[44px] font-extrabold leading-[1.15] text-[#111827]">
              See real mortgage rates{' '}
              <span className="text-brand">before you apply.</span>
            </h1>
            <p className="text-lg text-[#6B7280] mt-4 max-w-lg">
              Most lenders make you fill out an application before they show you numbers. We show you rates first — with the math behind them.
            </p>
            <div className="flex items-center gap-3 mt-4 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                No application
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                No credit pull
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Just rates
              </span>
            </div>
            <div className="flex gap-3 mt-7 flex-wrap">
              <Link
                href="/rates"
                className="bg-brand text-white px-8 py-3.5 rounded-xl text-base font-bold hover:bg-brand-dark transition-all flex items-center gap-2"
              >
                Check Today&apos;s Rates <span className="text-[#fff000] font-bold">&rarr;</span>
              </Link>
              <Link
                href="/portal/apply"
                className="border-2 border-brand text-brand px-8 py-3.5 rounded-xl text-base font-medium hover:bg-brand/5 transition-colors"
              >
                Apply Now
              </Link>
            </div>
          </div>

          {/* Right — Rate snapshot card */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden" style={{ boxShadow: '0 4px 24px rgba(2, 76, 79, 0.08)' }}>
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-[#111827] uppercase tracking-wide">Today&apos;s Rates</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${market.textClass} ${market.bgClass} border rounded-full px-2 py-0.5`}>
                  {market.label}
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand bg-brand/10 border border-brand/20 rounded-full px-2.5 py-0.5">
                <span className="w-1.5 h-1.5 bg-brand rounded-full animate-pulse" />
                LIVE
              </span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-y border-gray-100 bg-[#F5F7FA]">
                  <th className="text-left text-[10px] font-bold text-[#6B7280] uppercase tracking-wider py-2 px-6">Product</th>
                  <th className="text-right text-[10px] font-bold text-[#6B7280] uppercase tracking-wider py-2 px-3">Rate</th>
                  <th className="text-right text-[10px] font-bold text-[#6B7280] uppercase tracking-wider py-2 px-6">APR</th>
                </tr>
              </thead>
              <tbody>
                {heroProducts.map((row, i) => (
                  <tr key={row.product} className={i < 3 ? 'border-b border-gray-100' : ''}>
                    <td className="py-2.5 px-6">
                      <div className="text-sm font-semibold text-[#111827]">{row.product}</div>
                      <div className="text-[10px] text-[#6B7280] uppercase tracking-wider">{row.label}</div>
                    </td>
                    <td className="py-2.5 px-3 text-right text-[17px] font-extrabold text-brand tabular-nums">{row.rate}</td>
                    <td className="py-2.5 px-6 text-right text-sm text-[#a0a0a0] tabular-nums">{row.apr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-6 pt-4 pb-2 border-t border-gray-100">
              <p className="text-xs text-[#6B7280] text-center">
                + points, lender credits, and monthly payment for each
              </p>
            </div>
            <div className="px-6 pb-5 pt-1">
              <Link
                href="/rates"
                className="flex items-center justify-center gap-2 py-3 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark transition-all"
              >
                Compare Your Options <span className="text-[#fff000] font-bold">&rarr;</span>
              </Link>
            </div>
            <div className="px-6 pb-4">
              <p className="text-[11px] text-[#6B7280] text-center">780+ FICO &middot; $400K &middot; Purchase &middot; {effectiveDateShort}</p>
            </div>
          </div>
        </div>

        {/* ===== RATE WATCH HIGHLIGHT (inside hero section) ===== */}
        <div className="max-w-6xl mx-auto px-6 pb-14">
          <div className="bg-[#F5F7FA] border border-gray-200 rounded-2xl p-6 lg:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-[#111827]">Rates &amp; Market Data — Updated Daily</h3>
                <p className="text-[13px] text-[#6B7280] mt-1">
                  Track mortgage rates, Treasury yields, and economic events that move the market. Real data from Freddie Mac and the Fed — not estimates.
                </p>
              </div>
              <a
                href="/rate-watch"
                className="bg-brand text-white px-6 py-3 rounded-lg font-semibold text-sm hover:bg-brand-dark transition-colors whitespace-nowrap flex items-center gap-2"
              >
                View Rate Watch <span className="text-[#fff000] font-bold">&rarr;</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TRUST BAR (stats) ===== */}
      <TrustBar />

      {/* ===== SOCIAL PROOF STRIP ===== */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-center gap-3 flex-wrap text-sm">
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 bg-[#4285f4] rounded-full flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0">G</span>
            <span className="font-bold text-[#111827]">4.9</span>
            <span className="text-[#fff000] text-xs" style={{ textShadow: '0 0 1px #ccc' }}>&#9733;&#9733;&#9733;&#9733;&#9733;</span>
          </div>
          <span className="text-gray-300">|</span>
          <span className="text-[#6B7280] italic">&ldquo;He worked hard to get me the best rate and was communicative throughout.&rdquo;</span>
          <span className="text-gray-300">|</span>
          <a
            href="https://www.google.com/maps/search/?api=1&query=Locus+Mortgage&query_place_id=ChIJa5-5jCXza4cRptwJxaP23eU"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand font-semibold hover:text-brand-dark transition-colors whitespace-nowrap"
          >
            35 reviews &rarr;
          </a>
        </div>
      </div>

      {/* ===== TOOLS & CALCULATORS ===== */}
      <section id="tools" className="bg-[#F5F7FA] px-6 py-14">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 mb-7">
            <h2 className="text-2xl font-extrabold text-[#111827]">Tools &amp; Calculators</h2>
            <span className="text-sm text-[#a0a0a0]">Real math, no guesswork.</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                title: 'Rate Tool', desc: 'Live mortgage rates across 11 lenders. See rate, points, payment, and lender credits side by side.',
                href: '/rates', cta: 'Try it',
              },
              {
                title: 'DSCR Calculator', desc: 'Investment property? Enter rental income and expenses to see if your deal qualifies for a DSCR loan.',
                href: '/tools/dscr-calculator', cta: 'Calculate',
              },
              {
                title: 'Reverse Mortgage', desc: 'See how much equity you could access with a reverse mortgage. Age, home value, and rate — that\'s all we need.',
                href: '/tools/reverse-mortgage-calculator', cta: 'Estimate',
              },
              {
                title: 'Refi Analyzer', desc: 'Is refinancing worth it? Enter your current loan and we\'ll show the break-even timeline and total savings.',
                href: '/tools/refi-analyzer', cta: 'Analyze',
              },
              {
                title: 'Purchase Calculator', desc: 'Estimate your monthly payment, cash to close, and how much home you can afford.',
                href: '/tools/purchase-calculator', cta: 'Calculate',
              },
              {
                title: 'Cost of Waiting', desc: 'What does it cost you every month you don\'t refinance? See the real number with your loan details.',
                href: '/tools/cost-of-waiting', cta: 'See the cost',
              },
              {
                title: 'Start Secure Application', desc: 'Ready to go? AES-256 encrypted. Takes about 15 minutes.',
                href: '/portal/apply', cta: 'Start',
              },
            ].map((tool) => {
              const isComingSoon = !tool.href;
              const isSecureApp = tool.title === 'Start Secure Application';
              const CardTag = isComingSoon ? 'div' : Link;
              const cardProps = isComingSoon ? {} : { href: tool.href };
              return (
                <CardTag
                  key={tool.title}
                  {...cardProps}
                  className={`bg-white rounded-lg p-8 flex flex-col border-l-4 transition-all duration-300 ${
                    isSecureApp
                      ? 'border-l-[#fff000] bg-[#f0f8f8]'
                      : 'border-l-brand'
                  } ${
                    isComingSoon
                      ? 'opacity-70'
                      : 'hover:shadow-md hover:border-l-[6px] cursor-pointer'
                  }`}
                >
                  <h3 className="text-[15px] font-semibold text-[#111827] mb-1.5">{tool.title}</h3>
                  <p className="text-sm text-[#6B7280] leading-relaxed flex-1">{tool.desc}</p>
                  <span className={`text-sm font-semibold mt-3 ${isComingSoon ? 'text-[#a0a0a0]' : 'text-brand'}`}>
                    {tool.cta} {!isComingSoon && '→'}
                  </span>
                </CardTag>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== CREDENTIALS ===== */}
      <section className="bg-[#F5F7FA] border-t border-gray-200 py-14">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-extrabold text-[#111827] text-center mb-9">Licensed. Independent. Direct.</h2>
          <div className="flex flex-wrap justify-center gap-10 lg:gap-12">
            <div className="text-center">
              <div className="text-xl font-bold text-brand">NMLS #1111861</div>
              <div className="text-sm text-[#6B7280] mt-1">State-Licensed Mortgage Broker</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-brand">CA, CO, TX, OR</div>
              <div className="text-sm text-[#6B7280] mt-1">Licensed States</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-brand">Founded 2013</div>
              <div className="text-sm text-[#6B7280] mt-1">Over a Decade of Origination</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-brand">Direct-to-Consumer</div>
              <div className="text-sm text-[#6B7280] mt-1">Not a Bank.</div>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-8 mt-8 items-center">
            <a
              href="https://www.bbb.org/us/co/louisville/profile/mortgage-lenders/locus-mortgage-1296-90159653#sealclick"
              target="_blank"
              rel="nofollow noopener noreferrer"
              className="flex items-center gap-3 text-sm text-[#6B7280] hover:text-[#111827] transition-colors"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://seal-denver.bbb.org/seals/blue-seal-120-61-bbb-90159653.png"
                alt="BBB Accredited Business — A+ Rating"
                className="h-8 w-auto"
                loading="lazy"
              />
              A+ Rated &middot; Accredited Since 2013
            </a>
            <a
              href="https://nmlsconsumeraccess.org/EntityDetails.aspx/COMPANY/1111861"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#111827] transition-colors"
            >
              <span className="w-7 h-7 bg-gray-200 rounded-md flex items-center justify-center text-sm text-[#6B7280]">&#9872;</span>
              NMLS Consumer Access
            </a>
            <div className="flex items-center gap-2 text-sm text-[#6B7280]">
              <span className="w-7 h-7 bg-gray-200 rounded-md flex items-center justify-center text-sm text-[#6B7280]">&#8962;</span>
              Equal Housing Opportunity
            </div>
          </div>
        </div>
      </section>

      {/* ===== BOTTOM CTA BAND ===== */}
      <section className="bg-brand py-16 text-center">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-extrabold text-white">Not Sure Which Rate? Let Us Help.</h2>
          <p className="text-base text-white/80 mt-3 max-w-xl mx-auto">
            Tell us about your situation and we&apos;ll send you a personalized recommendation with full fee breakdown, cash to close, and savings analysis.
          </p>
          <div className="flex justify-center gap-3 mt-7 flex-wrap">
            <Link
              href="/contact"
              className="bg-white text-brand px-8 py-3.5 rounded-xl text-base font-bold hover:bg-gray-100 transition-colors"
            >
              Get a Free Quote
            </Link>
            <Link
              href="/portal/apply"
              className="border-2 border-white/50 text-white px-8 py-3.5 rounded-xl text-base font-medium hover:bg-white/10 transition-colors"
            >
              Apply Now
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
