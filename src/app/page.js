import Link from 'next/link';
import TrustBar from '@/components/TrustBar';
import StickyRateBar from '@/components/StickyRateBar';
import { getHomepageLiveRates } from '@/lib/rates/homepage';
import { GBP_REVIEW_URL } from '@/lib/constants/company';

export const metadata = {
  alternates: {
    canonical: 'https://www.netratemortgage.com',
  },
};

// Revalidate every 30 min — rates change once/day when new sheet is parsed
export const revalidate = 1800;

// Sentiment → consumer-friendly label + color (light theme)
const SENTIMENT_MAP = {
  bearish: { label: 'Trending Higher', textClass: 'text-red-600', bgClass: 'bg-red-50 border-red-200' },
  bullish: { label: 'Trending Lower', textClass: 'text-emerald-700', bgClass: 'bg-emerald-50 border-emerald-200' },
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
  const liveRates = await getHomepageLiveRates();

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
    { product: 'FHA 30-Yr',   label: 'Government', rate: fmtRate(d?.fha30)  || '5.500%', apr: fmtApr(d?.fha30)  || '6.12%' },
    { product: 'VA 30-Yr',    label: 'Military',   rate: fmtRate(d?.va30)   || '5.375%', apr: fmtApr(d?.va30)   || '5.52%' },
  ];

  return (
    <div className="bg-white">
      <StickyRateBar rate={conv30Rate} apr={conv30Apr} />

      {/* ===== RATE TICKER ===== */}
      <div className="bg-brand border-b border-white/10 overflow-hidden">
        <div className="flex">
          {/* Fixed label */}
          <div className="flex-shrink-0 flex items-center px-4 border-r border-white/10 bg-brand-dark">
            <span className="text-accent text-[10px] font-bold uppercase tracking-widest">Live Rates</span>
          </div>
          {/* Scrolling track */}
          <div className="overflow-hidden flex-1">
            <div className="ticker-track text-[12px] py-2 whitespace-nowrap">
              {[0, 1].map((dup) => (
                <div key={dup} className="flex items-center gap-8 px-8 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-white/70">30-Yr Fixed</span>
                    <span className="text-white font-bold">{conv30Rate}</span>
                    <span className="text-white/50 text-[11px]">APR {conv30Apr}</span>
                  </div>
                  <div className="w-px h-3.5 bg-white/20" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-white/70">P&amp;I</span>
                    <span className="text-white font-bold">{conv30Payment}</span>
                    <span className="text-white/50 text-[11px]">/$400K</span>
                  </div>
                  <div className="w-px h-3.5 bg-white/20" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-white/50">780+ FICO &middot; 75% LTV &middot; Purchase</span>
                  </div>
                  <div className="w-px h-3.5 bg-white/20" />
                  <a href="/rate-watch" className="text-accent hover:text-accent/80 transition-colors">
                    Rate Watch &rarr;
                  </a>
                  <div className="w-px h-3.5 bg-white/20" />
                  <span className="text-white/50 text-[11px]">{effectiveDateShort}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ===== HERO — light theme ===== */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 py-16 lg:py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

          {/* Left — Text */}
          <div>
            {/* Trust strip — above headline */}
            <div className="flex items-center gap-2 mb-5 flex-wrap">
              <a
                href={GBP_REVIEW_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-gray-100 border border-gray-200 rounded-full pl-1.5 pr-3 py-1 hover:bg-gray-200 transition-colors"
              >
                <span className="w-5 h-5 rounded-full bg-[#4285f4] text-white flex items-center justify-center text-[10px] font-extrabold flex-shrink-0">G</span>
                <span className="text-yellow-500 text-xs">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
                <span className="text-gray-700 font-bold text-xs">4.9</span>
              </a>
              <a
                href="https://www.bbb.org/us/co/louisville/profile/mortgage-lenders/locus-mortgage-1296-90159653#sealclick"
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-gray-100 border border-gray-200 rounded-full px-3 py-1 hover:bg-gray-200 transition-colors"
              >
                <span className="text-xs font-semibold text-gray-600">BBB A+</span>
              </a>
              <a
                href="https://nmlsconsumeraccess.org/EntityDetails.aspx/COMPANY/1111861"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-gray-100 border border-gray-200 rounded-full px-3 py-1 hover:bg-gray-200 transition-colors"
              >
                <span className="text-xs font-semibold text-gray-600">NMLS #1111861</span>
              </a>
              <div className="inline-flex items-center gap-2 bg-brand/10 border border-brand/20 rounded-full px-3 py-1 text-[11px] font-semibold text-brand">
                <span className="w-1.5 h-1.5 bg-brand rounded-full animate-pulse" />
                Rates updated today
              </div>
            </div>

            <h1 className="text-4xl lg:text-[44px] font-extrabold leading-[1.15] text-gray-900">
              See real mortgage rates{' '}
              <span className="text-brand">before you apply.</span>
            </h1>
            <p className="text-lg text-gray-500 mt-4 max-w-lg">
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
            <div className="mt-7">
              <Link
                href="/rates"
                className="text-brand font-semibold hover:text-brand-dark transition-colors"
              >
                Check today&apos;s rates &rarr;
              </Link>
            </div>
          </div>

          {/* Right — Rate card (light) */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-lg shadow-brand/10 overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-900 uppercase tracking-wide">Today&apos;s Rates</span>
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
                <tr className="border-y border-gray-100 bg-gray-50">
                  <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider py-2 px-6">Product</th>
                  <th className="text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider py-2 px-3">Rate</th>
                  <th className="text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider py-2 px-6">APR</th>
                </tr>
              </thead>
              <tbody>
                {heroProducts.map((row, i) => (
                  <tr key={row.product} className={i < 3 ? 'border-b border-gray-100' : ''}>
                    <td className="py-2.5 px-6">
                      <div className="text-sm font-semibold text-gray-800">{row.product}</div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wider">{row.label}</div>
                    </td>
                    <td className="py-2.5 px-3 text-right text-[17px] font-extrabold text-gray-900 tabular-nums">{row.rate}</td>
                    <td className="py-2.5 px-6 text-right text-sm text-gray-400 tabular-nums">{row.apr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-6 pt-4 pb-2 border-t border-gray-100">
              <p className="text-xs text-gray-400 text-center">
                + points, lender credits, and monthly payment for each
              </p>
            </div>
            <div className="px-6 pb-5 pt-1">
              <Link
                href="/rates"
                className="block text-center py-3 bg-go text-white rounded-nr-md text-sm font-bold hover:bg-go-dark transition-colors"
              >
                Compare Your Options &rarr;
              </Link>
            </div>
            <div className="px-6 pb-4">
              <p className="text-[11px] text-gray-400 text-center">780+ FICO &middot; $400K &middot; Purchase &middot; {effectiveDateShort}</p>
            </div>
          </div>
        </div>

        {/* Rate Watch promo strip */}
        <div className="max-w-6xl mx-auto px-6 pb-14">
          <div className="bg-surface border border-gray-200 rounded-2xl p-6 lg:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Rates &amp; Market Data — Updated Daily</h3>
                <p className="text-[13px] text-gray-500 mt-1">
                  Track mortgage rates, Treasury yields, and economic events that move the market. Real data from Freddie Mac and the Fed — not estimates.
                </p>
              </div>
              <a
                href="/rate-watch"
                className="text-brand font-semibold text-sm hover:text-brand-dark transition-colors whitespace-nowrap"
              >
                View Rate Watch &rarr;
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TRUST BAR ===== */}
      <TrustBar />

      {/* ===== TOOLS & CALCULATORS ===== */}
      <section id="tools" className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-14">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 mb-7">
            <h2 className="text-2xl font-extrabold text-gray-900">Tools &amp; Calculators</h2>
            <span className="text-sm text-gray-400">Real math, no guesswork.</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                title: 'Rate Tool',
                desc: 'Live mortgage rates across 11 lenders. See rate, points, payment, and lender credits side by side.',
                href: '/rates',
                cta: 'Search Rates',
              },
              {
                title: 'Refinance Calculator',
                desc: "Four ways to structure a refinance — powered by today's wholesale rates. See real cash flow, not just monthly savings.",
                href: '/refinance-calculator',
                cta: 'Calculate',
              },
              {
                title: 'Purchase Calculator',
                desc: 'Estimate your monthly payment, cash to close, and how much home you can afford.',
                href: '/tools/purchase-calculator',
                cta: 'Calculate',
              },
              {
                title: 'Refi Recoup Analyzer',
                desc: "Is refinancing worth it? Enter your current loan and we'll show the break-even timeline and total savings.",
                href: '/tools/refi-analyzer',
                cta: 'Analyze',
              },
              {
                title: 'Cost of Waiting',
                desc: "What does it cost you every month you don't refinance? See the real number with your loan details.",
                href: '/tools/cost-of-waiting',
                cta: 'See the Cost',
              },
              {
                title: 'DSCR Calculator',
                desc: 'Investment property? Enter rental income and expenses to see if your deal qualifies for a DSCR loan.',
                href: '/tools/dscr-calculator',
                cta: 'Calculate',
              },
              {
                title: 'Reverse Mortgage Calculator',
                desc: "See how much equity you could access with a reverse mortgage. Age, home value, and rate — that's all we need.",
                href: '/tools/reverse-mortgage-calculator',
                cta: 'Estimate',
              },
              {
                title: 'Second Lien Comparison',
                desc: 'Compare HELOC vs. home equity loan side by side to find the best option for your situation.',
                href: '/tools/second-lien-comparison',
                cta: 'Compare',
              },
              {
                title: 'Rate Alerts',
                desc: "Save a rate scenario and get periodic updates when rates change — reviewed by your loan officer before every email.",
                href: '/rates',
                cta: 'Set Up Alerts',
              },
            ].map((tool) => (
              <Link
                key={tool.title}
                href={tool.href}
                className="relative rounded-2xl p-6 flex flex-col transition-all hover:shadow-md hover:-translate-y-0.5 overflow-hidden bg-white border border-gray-200 hover:border-brand/30"
              >
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-brand" />
                <h3 className="text-[15px] font-bold mb-1.5 text-gray-900">
                  {tool.title}
                </h3>
                <p className="text-sm leading-relaxed flex-1 text-gray-500">
                  {tool.desc}
                </p>
                <span className="text-sm font-semibold mt-3 text-brand">
                  {tool.cta} &rarr;
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CREDENTIALS — light band ===== */}
      <section className="bg-surface py-14">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-extrabold text-gray-900 text-center mb-9">Licensed. Independent. Direct.</h2>
          <div className="flex flex-wrap justify-center gap-10 lg:gap-12">
            <div className="text-center">
              <div className="text-xl font-bold text-brand">NMLS #1111861</div>
              <div className="text-sm text-gray-500 mt-1">State-Licensed Mortgage Broker</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-brand">CA, CO, TX, OR</div>
              <div className="text-sm text-gray-500 mt-1">Licensed States</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-brand">Founded 2013</div>
              <div className="text-sm text-gray-500 mt-1">Over a Decade of Origination</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-brand">Direct-to-Consumer</div>
              <div className="text-sm text-gray-500 mt-1">Not a Bank.</div>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-8 mt-8 items-center">
            <a
              href="https://www.bbb.org/us/co/louisville/profile/mortgage-lenders/locus-mortgage-1296-90159653#sealclick"
              target="_blank"
              rel="nofollow noopener noreferrer"
              className="flex items-center gap-3 text-sm text-gray-500 hover:text-gray-700 transition-colors"
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
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              <span className="w-7 h-7 bg-gray-200 rounded-md flex items-center justify-center text-sm text-gray-500">&#9872;</span>
              NMLS Consumer Access
            </a>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="w-7 h-7 bg-gray-200 rounded-md flex items-center justify-center text-sm text-gray-500">&#8962;</span>
              Equal Housing Opportunity
            </div>
          </div>
        </div>
      </section>

      {/* ===== BOTTOM CTA — dark teal band ===== */}
      <section className="bg-deep pt-12 pb-16 text-center border-t-2 border-accent/80">
        <div className="max-w-6xl mx-auto px-6 pt-6">
          <h2 className="text-3xl font-extrabold text-white">Not Sure Which Rate? Let Us Help.</h2>
          <p className="text-base text-white/70 mt-3 max-w-xl mx-auto">
            Tell us about your situation and we&apos;ll send you a personalized recommendation with full fee breakdown, cash to close, and savings analysis.
          </p>
          <div className="mt-7">
            <Link
              href="/contact"
              className="text-accent font-semibold hover:text-white transition-colors"
            >
              Get a free quote &rarr;
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
