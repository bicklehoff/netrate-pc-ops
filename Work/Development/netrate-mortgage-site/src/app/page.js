import Link from 'next/link';
import TrustBar from '@/components/TrustBar';
import StickyRateBar from '@/components/StickyRateBar';
import { fetchGCSFile, isGCSConfigured } from '@/lib/gcs';
import staticSunwest from '@/data/rates/sunwest.json';
import { computeHomepageRates } from '@/lib/rates/homepage';

// Revalidate every 5 minutes (ISR) — matches /api/rates and /rates page
export const revalidate = 300;

const GCS_BUCKET = process.env.GCS_BUCKET_NAME || 'netrate-rates';

// Market data constants removed — fabricated data replaced with Rate Watch page

/**
 * Fetch rate data for homepage display.
 * Tries GCS live data first, falls back to static bundled data.
 */
async function getHomepageRateData() {
  if (isGCSConfigured()) {
    try {
      const manifest = await fetchGCSFile(GCS_BUCKET, 'live/manifest.json');
      const lenderData = await fetchGCSFile(GCS_BUCKET, `live/${manifest.lenders[0].file}`);
      return lenderData;
    } catch (err) {
      console.error('Homepage GCS fetch failed, using static fallback:', err.message);
    }
  }
  return staticSunwest;
}

// Market data fetch removed — replaced with Rate Watch page

export default async function HomePage() {
  // ─── Live Rate Data ─────────────────────────────────────────
  const lenderData = await getHomepageRateData();
  // market data removed — Rate Watch page handles market display
  let liveRates = null;
  try {
    liveRates = computeHomepageRates(lenderData);
  } catch (err) {
    console.error('Homepage rate computation failed:', err.message);
  }

  // ─── Display Values (live → fallback) ──────────────────────
  const d = liveRates;
  const conv30Rate = d ? `${d.conv30.rate.toFixed(3)}%` : '5.875%';
  const conv30Apr = d ? `${d.conv30.apr.toFixed(2)}%` : '5.94%';
  const conv30Payment = d ? `$${d.conv30.payment.toLocaleString()}` : '$2,366';
  const effectiveDateShort = d?.effectiveDateShort || 'Mar 13, 2026';
  const effectiveTime = d?.effectiveTime || '6:00 AM PST';

  // Market data removed — Rate Watch page handles all market display

  // Hero card products (30-yr from live data, rest are estimates)
  const heroProducts = [
    { product: '30-Yr Fixed', label: 'Conforming', rate: conv30Rate, apr: conv30Apr },
    { product: '15-Yr Fixed', label: 'Conforming', rate: '5.250%', apr: '5.38%' },
    { product: 'FHA 30-Yr', label: 'Government', rate: '5.500%', apr: '6.12%' },
    { product: 'VA 30-Yr', label: 'Military', rate: '5.375%', apr: '5.52%' },
  ];

  return (
    <div>
      <StickyRateBar rate={conv30Rate} apr={conv30Apr} />
      {/* ===== RATE TICKER (animated) — live rate data only ===== */}
      <div className="bg-gray-950 border-b border-gray-800 overflow-hidden">
        <div className="ticker-track text-[12px] py-2 whitespace-nowrap">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex items-center gap-8 px-8 shrink-0">
              <span className="text-gray-500 font-medium uppercase tracking-wider text-[10px]">Today&apos;s Rate</span>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400">NetRate 30-Yr Fixed</span>
                <span className="text-brand-light font-bold">{conv30Rate}</span>
                <span className="text-gray-400 text-[11px]">APR {conv30Apr}</span>
              </div>
              <div className="w-px h-3.5 bg-gray-800" />
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400">Monthly P&amp;I</span>
                <span className="text-white font-bold">{conv30Payment}</span>
                <span className="text-gray-500 text-[11px]">$400K loan</span>
              </div>
              <div className="w-px h-3.5 bg-gray-800" />
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400">Scenario</span>
                <span className="text-gray-300">760+ FICO &middot; 75% LTV &middot; Purchase</span>
              </div>
              <div className="w-px h-3.5 bg-gray-800" />
              <div className="flex items-center gap-1.5">
                <a href="/rate-watch" className="text-brand hover:text-brand-light transition-colors">
                  Rate Watch &rarr;
                </a>
              </div>
              <div className="w-px h-3.5 bg-gray-800" />
              <span className="text-gray-600 text-[11px]">{effectiveDateShort} &middot; {effectiveTime}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ===== HERO — 2-column, left text + right rate teaser ===== */}
      <section className="relative overflow-hidden bg-deep">
        {/* Decorative glow */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(8,145,178,0.15) 0%, transparent 60%)' }} />
        <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(8,145,178,0.08) 0%, transparent 60%)' }} />

        <div className="relative z-10 max-w-6xl mx-auto px-6 py-16 lg:py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left — Text */}
          <div>
            {/* Trust strip — above headline per Stitch analysis */}
            {/* TODO: Update Google Maps link after GBP name change from Locus → NetRate */}
            <div className="flex items-center gap-2.5 mb-5 opacity-60 hover:opacity-100 transition-opacity">
              <a
                href="https://www.google.com/maps/search/?api=1&query=Locus+Mortgage&query_place_id=ChIJa5-5jCXza4cRptwJxaP23eU"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-white/[0.05] rounded-full pl-1.5 pr-3 py-1 hover:bg-white/[0.10] transition-colors"
              >
                <span className="w-5 h-5 rounded-full bg-white/20 text-white flex items-center justify-center text-[10px] font-extrabold flex-shrink-0">G</span>
                <span className="text-white/60 text-xs tracking-wide">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
                <span className="text-white/80 font-bold text-xs">4.9</span>
              </a>
              <a
                href="https://www.bbb.org/us/co/louisville/profile/mortgage-lenders/locus-mortgage-1296-90159653#sealclick"
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-white/[0.05] rounded-full px-3 py-1 hover:bg-white/[0.10] transition-colors"
              >
                <span className="text-xs font-semibold text-white/50">BBB A+</span>
              </a>
              <a
                href="https://nmlsconsumeraccess.org/EntityDetails.aspx/COMPANY/1111861"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-white/[0.05] rounded-full px-3 py-1 hover:bg-white/[0.10] transition-colors"
              >
                <span className="text-xs font-semibold text-white/50">NMLS #1111861</span>
              </a>
              <div className="inline-flex items-center gap-2 bg-brand/20 border border-brand/30 rounded-full px-3 py-1 text-[11px] font-semibold text-brand-light">
                <span className="w-1.5 h-1.5 bg-brand-light rounded-full animate-pulse" />
                Rates updated today
              </div>
            </div>

            <h1 className="text-4xl lg:text-[44px] font-extrabold leading-[1.15] text-white">
              See your actual mortgage rate{' '}
              <span className="text-brand-light">before you apply.</span>
            </h1>
            <p className="text-lg text-gray-400 mt-4 max-w-lg">
              Most lenders make you fill out an application before they show you numbers. We show you rates first — with the math behind them.
            </p>
            <div className="flex items-center gap-3 mt-4 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                No application
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                No credit pull
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                Just rates
              </span>
            </div>
            <div className="flex gap-3 mt-7 flex-wrap">
              <Link
                href="/rates"
                className="bg-brand text-white px-8 py-3.5 rounded-xl text-base font-bold hover:bg-brand-dark hover:shadow-[0_0_20px_rgba(34,211,238,0.2)] transition-all"
              >
                Check Today&apos;s Rates
              </Link>
              <Link
                href="/portal/apply"
                className="bg-white/10 text-white px-8 py-3.5 rounded-xl text-base font-medium border border-white/20 hover:bg-white/20 transition-colors"
              >
                Apply Now
              </Link>
            </div>
          </div>

          {/* Right — Rate snapshot table (Glassmorphism) */}
          <div className="bg-surface/70 backdrop-blur-xl border border-white/10 rounded-2xl shadow-lg shadow-brand/[0.05] overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-white uppercase tracking-wide">Today&apos;s Rates</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-light bg-brand/10 border border-brand/20 rounded-full px-2 py-0.5">
                  Market: Stable
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-light bg-brand/15 border border-brand/30 rounded-full px-2.5 py-0.5">
                <span className="w-1.5 h-1.5 bg-brand-light rounded-full animate-pulse" />
                LIVE
              </span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-y border-white/10 bg-white/[0.03]">
                  <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider py-2 px-6">Product</th>
                  <th className="text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider py-2 px-3">Rate</th>
                  <th className="text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider py-2 px-6">APR</th>
                </tr>
              </thead>
              <tbody>
                {heroProducts.map((row, i) => (
                  <tr key={row.product} className={i < 3 ? 'border-b border-white/[0.06]' : ''}>
                    <td className="py-2.5 px-6">
                      <div className="text-sm font-semibold text-gray-300">{row.product}</div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wider">{row.label}</div>
                    </td>
                    <td className="py-2.5 px-3 text-right text-[17px] font-extrabold text-white tabular-nums">{row.rate}</td>
                    <td className="py-2.5 px-6 text-right text-sm text-gray-400 tabular-nums">{row.apr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-6 pt-4 pb-2 border-t border-white/10">
              <p className="text-xs text-gray-500 text-center">
                + points, lender credits, and monthly payment for each
              </p>
            </div>
            <div className="px-6 pb-5 pt-1">
              <Link
                href="/rates"
                className="block text-center py-3 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark hover:shadow-[0_0_20px_rgba(34,211,238,0.2)] transition-all"
              >
                Compare Your Options &rarr;
              </Link>
            </div>
            <div className="px-6 pb-4">
              <p className="text-[11px] text-gray-500 text-center">760+ FICO &middot; $400K &middot; Rate/Term Refi &middot; 0 pts &middot; {effectiveDateShort}</p>
            </div>
          </div>
        </div>

        {/* ===== RATE HIGHLIGHT (inside hero) ===== */}
        <div className="relative z-10 max-w-6xl mx-auto px-6 pb-14">
          <div className="bg-white/[0.06] backdrop-blur-sm border border-white/10 rounded-2xl p-6 lg:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white">Rates &amp; Market Data — Updated Daily</h3>
                <p className="text-[13px] text-gray-400 mt-1">
                  Track mortgage rates, Treasury yields, and economic events that move the market. Real data from Freddie Mac and the Fed — not estimates.
                </p>
              </div>
              <a
                href="/rate-watch"
                className="bg-brand text-white px-6 py-3 rounded-lg font-semibold text-sm hover:bg-brand-dark transition-colors whitespace-nowrap"
              >
                View Rate Watch &rarr;
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TRUST BAR ===== */}
      <TrustBar />

      {/* ===== MARKET — CTA to Rate Watch ===== */}
      <section className="bg-gray-50 border-y border-gray-100 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-8 flex flex-col md:flex-row items-center gap-8">
            <div className="flex-1">
              <h3 className="text-xl font-extrabold text-gray-900 mb-2">Rate Watch</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                See where mortgage rates are today, how they compare to the national average, and what economic events could move them next. Updated every business day.
              </p>
            </div>
            <a
              href="/rate-watch"
              className="bg-brand text-white px-8 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors whitespace-nowrap"
            >
              View Rate Watch &rarr;
            </a>
          </div>
        </div>
      </section>

      {/* ===== TOOLS & CALCULATORS ===== */}
      <section id="tools" className="max-w-6xl mx-auto px-6 py-14">
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 mb-7">
          <h2 className="text-2xl font-extrabold text-gray-900">Tools &amp; Calculators</h2>
          <span className="text-sm text-gray-400">Real math, no guesswork.</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            {
              icon: '☰', iconClass: 'bg-gradient-to-br from-cyan-50 to-cyan-100 text-brand',
              title: 'Rate Tool', desc: 'Live wholesale rates across 11 lenders. See rate, points, payment, and lender credits side by side.',
              href: '/rates', cta: 'Try it',
            },
            {
              icon: 'Ψ', iconClass: 'bg-gradient-to-br from-emerald-50 to-emerald-100 text-green-600',
              title: 'DSCR Calculator', desc: 'Investment property? Enter rental income and expenses to see if your deal qualifies for a DSCR loan.',
              href: null, cta: 'Coming soon',
            },
            {
              icon: '↩', iconClass: 'bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600',
              title: 'Reverse Mortgage', desc: 'See how much equity you could access with a reverse mortgage. Age, home value, and rate — that\'s all we need.',
              href: '/tools/hecm-optimizer', cta: 'Estimate',
            },
            {
              icon: '↻', iconClass: 'bg-gradient-to-br from-violet-50 to-violet-100 text-violet-600',
              title: 'Refi Analyzer', desc: 'Is refinancing worth it? Enter your current loan and we\'ll show the break-even timeline and total savings.',
              href: null, cta: 'Coming soon',
            },
            {
              icon: '⌂', iconClass: 'bg-gradient-to-br from-pink-50 to-pink-100 text-pink-600',
              title: 'Purchase Calculator', desc: 'Estimate your monthly payment, cash to close, and how much home you can afford.',
              href: null, cta: 'Coming soon',
            },
            {
              icon: '✔', iconClass: 'bg-gradient-to-br from-sky-50 to-sky-100 text-sky-600',
              title: 'Start Secure Application', desc: 'Ready to go? AES-256 encrypted. Takes about 15 minutes.',
              href: '/portal/apply', cta: 'Start',
            },
          ].map((tool) => {
            const isComingSoon = !tool.href;
            const CardTag = isComingSoon ? 'div' : Link;
            const cardProps = isComingSoon ? {} : { href: tool.href };
            return (
              <CardTag
                key={tool.title}
                {...cardProps}
                className={`bg-white border border-gray-200 rounded-2xl p-6 flex flex-col transition-all ${
                  isComingSoon ? 'opacity-70' : 'hover:border-brand hover:shadow-md hover:shadow-brand/10 hover:-translate-y-0.5 cursor-pointer'
                }`}
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-3.5 ${tool.iconClass}`}>
                  {tool.icon}
                </div>
                <h3 className="text-[15px] font-bold text-gray-900 mb-1.5">{tool.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed flex-1">{tool.desc}</p>
                <span className={`text-sm font-semibold mt-3 ${isComingSoon ? 'text-gray-400' : 'text-brand'}`}>
                  {tool.cta} {!isComingSoon && '→'}
                </span>
              </CardTag>
            );
          })}
        </div>
      </section>

      {/* ===== REVIEWS — Featured + supporting ===== */}
      <section className="bg-gray-50 py-16 lg:py-20">
        <div className="max-w-6xl mx-auto px-6">
          {/* Header */}
          <div className="flex items-center gap-4 mb-10">
            <div className="w-8 h-8 bg-[#4285f4] rounded-full flex items-center justify-center text-white font-extrabold text-lg flex-shrink-0">G</div>
            <div>
              <div className="flex items-center gap-3">
                <span className="text-3xl font-extrabold text-gray-900">4.9</span>
                <span className="text-yellow-400 text-[22px] tracking-wider">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
              </div>
              <div className="text-sm text-gray-500">
                35 Google Reviews &middot;{' '}
                <a
                  href="https://www.google.com/maps/search/?api=1&query=Locus+Mortgage&query_place_id=ChIJa5-5jCXza4cRptwJxaP23eU"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand font-semibold hover:text-brand-dark transition-colors"
                >
                  Read all &rarr;
                </a>{' '}
                <span className="text-[11px] text-gray-400">(Formerly Locus Mortgage)</span>
              </div>
            </div>
          </div>

          {/* Reviews grid — featured left, 4 supporting right */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr_1fr] gap-5">
            {/* Featured review */}
            <div className="bg-white rounded-xl p-7 border-2 border-brand relative lg:row-span-2">
              <span className="absolute top-4 right-4 bg-brand text-white text-[10px] font-bold px-2.5 py-1 rounded tracking-wide">FEATURED</span>
              <div className="text-yellow-400 text-sm mb-3">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
              <p className="text-[17px] text-gray-700 leading-relaxed">
                &ldquo;My family and I have worked with David a few times and he is absolutely incredible! He is very knowledgeable, extremely responsive, and truly a wonderful person who helps you through the entire loan process.&rdquo;
              </p>
              <p className="text-sm text-gray-400 mt-4">Sohayla R. &middot; 4 weeks ago</p>
            </div>

            {/* Supporting reviews */}
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="text-yellow-400 text-sm mb-3">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
              <p className="text-[15px] text-gray-700 leading-relaxed">
                &ldquo;I&apos;ve worked with Jamie on multiple transactions — two purchases and a refinance — and every single time he delivered exceptional service.&rdquo;
              </p>
              <p className="text-sm text-gray-400 mt-4">Alex Z. &middot; 12 weeks ago</p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="text-yellow-400 text-sm mb-3">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
              <p className="text-[15px] text-gray-700 leading-relaxed">
                &ldquo;David was an excellent partner in helping me close on a refinance. He worked hard to get me the best rate and was communicative throughout.&rdquo;
              </p>
              <p className="text-sm text-gray-400 mt-4">Charlie B. &middot; Nov 2024</p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="text-yellow-400 text-sm mb-3">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
              <p className="text-[15px] text-gray-700 leading-relaxed">
                &ldquo;Whenever he quoted us he was correct and there were no surprises. If you want someone honest, use David.&rdquo;
              </p>
              <p className="text-sm text-gray-400 mt-4">Ben W. &middot; May 2019</p>
            </div>

            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <div className="text-yellow-400 text-sm mb-3">&#9733;&#9733;&#9733;&#9733;&#9733;</div>
              <p className="text-[15px] text-gray-700 leading-relaxed">
                &ldquo;Some of the best mortgage rates around. Very knowledgeable, totally straight forward, friendly, available off hours and weekends.&rdquo;
              </p>
              <p className="text-sm text-gray-400 mt-4">Steven P. &middot; 2023</p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CREDENTIALS — Dark band ===== */}
      <section className="bg-deep py-14">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-extrabold text-white text-center mb-9">Licensed. Independent. Direct.</h2>
          <div className="flex flex-wrap justify-center gap-10 lg:gap-12">
            <div className="text-center">
              <div className="text-xl font-bold text-brand">NMLS #641790</div>
              <div className="text-sm text-gray-400 mt-1">State-Licensed Mortgage Broker</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-brand">CA, CO, TX, OR</div>
              <div className="text-sm text-gray-400 mt-1">Licensed States</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-brand">Founded 2013</div>
              <div className="text-sm text-gray-400 mt-1">Over a Decade of Origination</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-brand">Direct-to-Consumer</div>
              <div className="text-sm text-gray-400 mt-1">Not a Bank. Not a Realtor.</div>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-8 mt-8 items-center">
            <a
              href="https://www.bbb.org/us/co/louisville/profile/mortgage-lenders/locus-mortgage-1296-90159653#sealclick"
              target="_blank"
              rel="nofollow noopener noreferrer"
              className="flex items-center gap-3 text-sm text-gray-400 hover:text-gray-300 transition-colors"
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
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
            >
              <span className="w-7 h-7 bg-gray-800 rounded-md flex items-center justify-center text-sm text-gray-500">&#9872;</span>
              NMLS Consumer Access
            </a>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span className="w-7 h-7 bg-gray-800 rounded-md flex items-center justify-center text-sm text-gray-500">&#8962;</span>
              Equal Housing Opportunity
            </div>
          </div>
        </div>
      </section>

      {/* ===== BOTTOM CTA ===== */}
      <section className="bg-brand py-16 text-center">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-extrabold text-white">Not Sure Which Rate? Let Us Help.</h2>
          <p className="text-base text-cyan-100 mt-3 max-w-xl mx-auto">
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
              className="border-2 border-white/40 text-white px-8 py-3.5 rounded-xl text-base font-medium hover:bg-white/10 transition-colors"
            >
              Apply Now
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
