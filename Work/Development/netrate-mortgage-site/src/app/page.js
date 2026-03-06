import Link from 'next/link';
import TrustBar from '@/components/TrustBar';
import { fetchGCSFile, isGCSConfigured } from '@/lib/gcs';
import staticAmwest from '@/data/rates/amwest.json';
import { computeHomepageRates } from '@/lib/rates/homepage';

// Revalidate every 5 minutes (ISR) — matches /api/rates and /rates page
export const revalidate = 300;

const GCS_BUCKET = process.env.GCS_BUCKET_NAME || 'netrate-rates';

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
  return staticAmwest;
}

export default async function HomePage() {
  // ─── Live Rate Data ─────────────────────────────────────────
  const lenderData = await getHomepageRateData();
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
  const conv30RateNum = d ? d.conv30.rate : 5.875;
  const effectiveDateFull = d?.effectiveDateFormatted || 'March 5, 2026';
  const effectiveDateShort = d?.effectiveDateShort || 'Mar 5, 2026';
  const effectiveTime = d?.effectiveTime || '3:30 PM ET';
  const nationalAvg30 = 6.37; // Hardcoded until market.json pipeline
  const savingsGap = (nationalAvg30 - conv30RateNum).toFixed(2);

  // Hero card products (30-yr from live data, rest placeholder)
  const heroProducts = [
    { product: '30-Yr Fixed', rate: conv30Rate, apr: conv30Apr },
    { product: '15-Yr Fixed', rate: '5.250%', apr: '5.38%' },
    { product: 'FHA 30-Yr', rate: '5.500%', apr: '6.12%' },
    { product: 'VA 30-Yr', rate: '5.375%', apr: '5.52%' },
  ];

  // Full rates table (30-yr from live data, rest placeholder)
  const tableProducts = [
    { product: '30-Year Fixed', rate: conv30Rate, apr: conv30Apr, change: null, payment: conv30Payment, note: null },
    { product: '15-Year Fixed', rate: '5.250%', apr: '5.38%', change: null, payment: '$3,213', note: null },
    { product: 'FHA 30-Year', rate: '5.500%', apr: '6.12%', change: null, payment: '$2,271', note: null },
    { product: 'VA 30-Year', rate: '5.375%', apr: '5.52%', change: null, payment: '$2,240', note: null },
    { product: 'Jumbo 30-Year', rate: '6.250%', apr: '6.31%', change: null, payment: '$4,928', note: '($800K)' },
    { product: 'DSCR (Investor)', rate: '7.125%', apr: '7.28%', change: null, payment: '$2,694', note: null },
  ];
  return (
    <div>
      {/* ===== MARKET TICKER (animated) ===== */}
      <div className="bg-gray-950 border-b border-gray-800 overflow-hidden">
        <div className="ticker-track text-[12px] py-2 whitespace-nowrap">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex items-center gap-8 px-8 shrink-0">
              <span className="text-gray-500 font-medium uppercase tracking-wider text-[10px]">Market</span>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400">10-Yr Treasury</span>
                <span className="text-white font-bold">4.136%</span>
                <span className="text-red-400 font-semibold">&#9650; 0.04</span>
              </div>
              <div className="w-px h-3.5 bg-gray-800" />
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400">UMBS 5.0</span>
                <span className="text-white font-bold">99.81</span>
                <span className="text-red-400 font-semibold">&#9660; 0.16</span>
              </div>
              <div className="w-px h-3.5 bg-gray-800" />
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400">Nat&apos;l Avg 30-Yr</span>
                <span className="text-white font-bold">6.37%</span>
                <span className="text-gray-500 text-[11px]">Freddie Mac</span>
              </div>
              <div className="w-px h-3.5 bg-gray-800" />
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400">NetRate Mortgage 30-Yr</span>
                <span className="text-brand-light font-bold">{conv30Rate}</span>
                <span className="text-gray-400 text-[11px]">APR {conv30Apr}</span>
              </div>
              <div className="w-px h-3.5 bg-gray-800" />
              <div className="flex items-center gap-1.5">
                <span className="text-gray-400">S&amp;P 500</span>
                <span className="text-white font-bold">5,842</span>
                <span className="text-green-400 font-semibold">&#9650; 0.3%</span>
              </div>
              <div className="w-px h-3.5 bg-gray-800" />
              <span className="text-gray-600 text-[11px]">{effectiveDateShort} &middot; {effectiveTime}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ===== HERO — 2-column, left text + right rate teaser ===== */}
      <section className="relative overflow-hidden bg-gray-900">
        {/* Decorative glow */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(8,145,178,0.15) 0%, transparent 60%)' }} />
        <div className="absolute -bottom-20 -left-20 w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(8,145,178,0.08) 0%, transparent 60%)' }} />

        <div className="relative z-10 max-w-6xl mx-auto px-6 py-16 lg:py-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left — Text */}
          <div>
            <div className="inline-flex items-center gap-2 bg-brand/20 border border-brand/30 rounded-full px-3.5 py-1.5 text-xs font-semibold text-brand-light mb-5">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              Rates updated today
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
                className="bg-brand text-white px-8 py-3.5 rounded-xl text-base font-bold hover:bg-brand-dark transition-colors"
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

            {/* Trust strip */}
            <div className="flex items-center gap-3 mt-7 pt-6 border-t border-white/10">
              <a
                href="https://www.google.com/maps/search/?api=1&query=Locus+Mortgage&query_place_id=ChIJa5-5jCXza4cRptwJxaP23eU"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-white/[0.07] rounded-full pl-2 pr-3.5 py-1.5 hover:bg-white/[0.12] transition-colors"
              >
                <span className="w-6 h-6 rounded-full bg-[#4285f4] text-white flex items-center justify-center text-xs font-extrabold flex-shrink-0">G</span>
                <span className="text-yellow-400 text-sm tracking-wide">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
                <span className="text-white font-bold text-sm">4.9</span>
              </a>
              <a
                href="https://www.bbb.org/us/co/louisville/profile/mortgage-lenders/locus-mortgage-1296-90159653"
                target="_blank"
                rel="nofollow noopener noreferrer"
                className="inline-flex items-center gap-2 bg-white/[0.07] rounded-full pl-2 pr-3.5 py-1.5 hover:bg-white/[0.12] transition-colors"
              >
                <span className="w-6 h-6 rounded-md bg-[#006eb7] text-white flex items-center justify-center text-[9px] font-extrabold flex-shrink-0">BBB</span>
                <span className="text-sm font-semibold text-gray-300">A+</span>
              </a>
              <a
                href="https://nmlsconsumeraccess.org/EntityDetails.aspx/COMPANY/1111861"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-white/[0.07] rounded-full pl-2 pr-3.5 py-1.5 hover:bg-white/[0.12] transition-colors"
              >
                <span className="w-6 h-6 rounded-md bg-white/10 text-white flex items-center justify-center text-[9px] font-bold flex-shrink-0">N</span>
                <span className="text-sm font-semibold text-gray-300">NMLS</span>
              </a>
            </div>
          </div>

          {/* Right — Rate snapshot table */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-lg shadow-black/[0.08] overflow-hidden">
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <span className="text-xs font-bold text-gray-900 uppercase tracking-wide">Today&apos;s Rates</span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-500 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                LIVE
              </span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-y border-gray-100 bg-gray-50/60">
                  <th className="text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider py-2 px-6">Product</th>
                  <th className="text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider py-2 px-3">Rate</th>
                  <th className="text-right text-[10px] font-bold text-gray-400 uppercase tracking-wider py-2 px-6">APR</th>
                </tr>
              </thead>
              <tbody>
                {heroProducts.map((row, i) => (
                  <tr key={row.product} className={i < 3 ? 'border-b border-gray-100' : ''}>
                    <td className="py-2.5 px-6 text-sm font-semibold text-gray-700">{row.product}</td>
                    <td className="py-2.5 px-3 text-right text-[17px] font-extrabold text-gray-900">{row.rate}</td>
                    <td className="py-2.5 px-6 text-right text-sm text-gray-500">{row.apr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-6 pt-4 pb-2 border-t border-gray-100">
              <p className="text-xs text-gray-500 text-center">
                + points, lender credits, and monthly payment for each
              </p>
            </div>
            <div className="px-6 pb-5 pt-1">
              <Link
                href="/rates"
                className="block text-center py-3 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand-dark transition-colors"
              >
                Compare Your Options &rarr;
              </Link>
            </div>
            <div className="px-6 pb-4">
              <p className="text-[11px] text-gray-400 text-center">760+ FICO &middot; $400K &middot; Rate/Term Refi &middot; 0 pts &middot; {effectiveDateShort}</p>
            </div>
          </div>
        </div>

        {/* ===== RATE COMPARISON CHART (inside hero, above the fold) ===== */}
        <div className="relative z-10 max-w-6xl mx-auto px-6 pb-14">
          <div className="bg-white/[0.06] backdrop-blur-sm border border-white/10 rounded-2xl p-6 lg:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5">
              <div>
                <h3 className="text-base font-bold text-white">National Average vs. NetRate Mortgage</h3>
                <p className="text-[13px] text-gray-400 mt-0.5">30-Year Fixed &middot; 6-month trend</p>
              </div>
              <div className="flex items-center gap-5 text-[12px]">
                <span className="flex items-center gap-1.5">
                  <span className="w-5 h-[2px] bg-gray-400 inline-block" style={{ borderTop: '2px dashed #9ca3af' }} />
                  <span className="text-gray-400">National Avg</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-5 h-[2px] bg-brand-light inline-block rounded" />
                  <span className="text-brand-light">NetRate Mortgage</span>
                </span>
              </div>
            </div>
            <svg viewBox="0 0 700 180" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
              <defs>
                <linearGradient id="gapFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0891b2" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#0891b2" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {/* Grid lines */}
              {[40, 70, 100, 130].map((y) => (
                <line key={y} x1="50" y1={y} x2="670" y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
              ))}
              {/* Y-axis labels */}
              <text x="42" y="44" textAnchor="end" className="text-[11px]" fill="#6b7280">7.0%</text>
              <text x="42" y="74" textAnchor="end" className="text-[11px]" fill="#6b7280">6.5%</text>
              <text x="42" y="104" textAnchor="end" className="text-[11px]" fill="#6b7280">6.0%</text>
              <text x="42" y="134" textAnchor="end" className="text-[11px]" fill="#6b7280">5.5%</text>
              {/* X-axis labels */}
              <text x="80" y="168" textAnchor="middle" className="text-[11px]" fill="#6b7280">Oct</text>
              <text x="200" y="168" textAnchor="middle" className="text-[11px]" fill="#6b7280">Nov</text>
              <text x="320" y="168" textAnchor="middle" className="text-[11px]" fill="#6b7280">Dec</text>
              <text x="440" y="168" textAnchor="middle" className="text-[11px]" fill="#6b7280">Jan</text>
              <text x="560" y="168" textAnchor="middle" className="text-[11px]" fill="#6b7280">Feb</text>
              <text x="650" y="168" textAnchor="middle" className="text-[11px]" fill="#6b7280">Now</text>
              {/* Savings gap fill between the two lines */}
              <path
                d="M80,52 L200,46 L320,58 L440,64 L560,68 L650,72 L650,110 L560,106 L440,100 L320,88 L200,72 L80,80 Z"
                fill="url(#gapFill)"
              />
              {/* National avg line (dashed, gray) */}
              <path
                d="M80,52 L200,46 L320,58 L440,64 L560,68 L650,72"
                fill="none"
                stroke="#9ca3af"
                strokeWidth="2"
                strokeDasharray="6,5"
              />
              {/* NetRate line (solid, teal) */}
              <path
                d="M80,80 L200,72 L320,88 L440,100 L560,106 L650,110"
                fill="none"
                stroke="#22d3ee"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* End dots */}
              <circle cx="650" cy="72" r="4" fill="#1f2937" stroke="#9ca3af" strokeWidth="2" />
              <circle cx="650" cy="110" r="5" fill="#0891b2" stroke="#22d3ee" strokeWidth="2" />
              {/* End labels */}
              <text x="662" y="68" className="text-[12px] font-bold" fill="#9ca3af">6.37%</text>
              <text x="662" y="115" className="text-[12px] font-bold" fill="#22d3ee">{conv30Rate}</text>
            </svg>
            {/* Savings callout */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                {savingsGap}% below the national average
              </span>
              <span className="text-[12px] text-gray-500">Source: Freddie Mac PMMS &middot; NetRate Mortgage wholesale pricing</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===== TRUST BAR ===== */}
      <TrustBar />

      {/* ===== TODAY'S RATES TABLE ===== */}
      <section id="rates" className="max-w-6xl mx-auto px-6 py-14">
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 mb-6">
          <h2 className="text-2xl font-extrabold text-gray-900">Today&apos;s Mortgage Rates</h2>
          <span className="text-sm text-gray-400">{effectiveDateFull} &middot; 760+ FICO &middot; $400K loan</span>
        </div>
        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider py-2.5 px-4">Product</th>
                <th className="text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider py-2.5 px-4">Rate</th>
                <th className="text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider py-2.5 px-4">APR</th>
                <th className="text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider py-2.5 px-4">Change</th>
                <th className="text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider py-2.5 px-4">Mo. Payment</th>
                <th className="py-2.5 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {tableProducts.map((row) => (
                <tr key={row.product} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="py-3.5 px-4 font-semibold text-gray-900">{row.product}</td>
                  <td className="py-3.5 px-4 text-xl font-extrabold text-gray-900">{row.rate}</td>
                  <td className="py-3.5 px-4 text-sm text-gray-600">{row.apr}</td>
                  <td className="py-3.5 px-4">
                    {row.change != null ? (
                      <span className={`text-sm font-semibold ${row.change < 0 ? 'text-green-600' : row.change > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {row.change < 0 ? '▼' : row.change > 0 ? '▲' : '—'}{' '}
                        {Math.abs(row.change).toFixed(3)}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-300">—</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-sm text-gray-500">
                    {row.payment}
                    {row.note && <span className="text-[11px] text-gray-400 ml-1">{row.note}</span>}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <Link href="/rates" className="text-brand font-semibold text-sm hover:text-brand-dark transition-colors">
                      See options &rarr;
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
          Rates assume 760+ FICO, rate/term refinance, $400K loan, 75% LTV. Jumbo based on $800K. DSCR based on investment property, 1.25x coverage. Actual rates depend on your specific scenario. Updated daily from wholesale pricing.
        </p>
      </section>

      {/* ===== RATE TRENDS + MARKET UPDATES ===== */}
      <section id="market" className="bg-gray-50 border-y border-gray-100 py-12">
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left — Rate trend */}
          <div className="bg-white rounded-2xl border border-gray-200 p-7">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-4">
              <span className="w-7 h-7 rounded-md bg-cyan-50 text-brand flex items-center justify-center text-sm">&#9650;</span>
              30-Year Rate Trend
            </h3>
            {/* Sparkline bars */}
            <div className="relative h-28 bg-gradient-to-b from-cyan-50 to-white rounded-lg border border-gray-100 flex items-end px-3 mb-4 overflow-hidden">
              <span className="absolute top-2.5 left-3.5 text-[11px] text-gray-400">8 weeks</span>
              <span className="absolute top-2.5 right-3.5 text-base font-extrabold text-brand">{conv30Rate}</span>
              {[70, 75, 72, 68, 65, 60, 55, 50].map((h, i) => (
                <div
                  key={i}
                  className={`flex-1 mx-0.5 rounded-t bg-brand min-h-[8px] ${i === 7 ? 'opacity-100' : 'opacity-60'}`}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              <strong className="text-gray-900">Trending down.</strong> The 30-year fixed has dropped 0.375% over the last 8 weeks. If the Fed holds in March, wholesale pricing should stay favorable through Q2.
            </p>
          </div>

          {/* Right — Market updates */}
          <div className="bg-white rounded-2xl border border-gray-200 p-7">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-4">
              <span className="w-7 h-7 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center text-sm">&#9733;</span>
              Market Updates
            </h3>
            <ul className="divide-y divide-gray-100">
              {[
                { color: 'bg-green-600', text: 'Fed holds rates steady — mortgage rates ease', date: 'Mar 1' },
                { color: 'bg-amber-500', text: 'Jobs report stronger than expected — watch for bond sell-off', date: 'Feb 28' },
                { color: 'bg-brand', text: 'Wholesale lenders reprice lower after 10-year drops to 4.15%', date: 'Feb 26' },
                { color: 'bg-green-600', text: 'Refi applications up 12% week-over-week (MBA data)', date: 'Feb 24' },
                { color: 'bg-amber-500', text: 'CPI comes in at 2.8% — slightly above expectations', date: 'Feb 20' },
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 py-2.5">
                  <span className={`w-2 h-2 rounded-full ${item.color} flex-shrink-0`} />
                  <span className="text-sm text-gray-700 flex-1">{item.text}</span>
                  <span className="text-xs text-gray-400 whitespace-nowrap ml-2">{item.date}</span>
                </li>
              ))}
            </ul>
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
              title: 'Apply Online', desc: 'Ready to go? Start your secure application. Takes about 15 minutes.',
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
      <section className="bg-gray-900 py-14">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-extrabold text-white text-center mb-9">Licensed. Independent. Direct.</h2>
          <div className="flex flex-wrap justify-center gap-10 lg:gap-12">
            <div className="text-center">
              <div className="text-xl font-bold text-brand">NMLS #641790</div>
              <div className="text-sm text-gray-400 mt-1">Federally Registered Broker</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-brand">CO, TX, OR</div>
              <div className="text-sm text-gray-400 mt-1">Licensed States (CA coming soon)</div>
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
              href="https://www.bbb.org/us/co/louisville/profile/mortgage-lenders/locus-mortgage-1296-90159653"
              target="_blank"
              rel="nofollow noopener noreferrer"
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
            >
              <span className="w-7 h-7 bg-gray-800 rounded-md flex items-center justify-center text-[11px] text-gray-500 font-bold">BBB</span>
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
          <h2 className="text-3xl font-extrabold text-white">See rates for your scenario in 30 seconds.</h2>
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
