import { neon } from '@neondatabase/serverless';
import HeroStrip from '@/components/RateWatch/HeroStrip';
import TickerBar from '@/components/RateWatch/TickerBar';
import RateChart from '@/components/RateWatch/RateChart';
import Sidebar from '@/components/RateWatch/Sidebar';
import Commentary from '@/components/RateWatch/Commentary';
import BelowFold from '@/components/RateWatch/BelowFold';
import Predictions from '@/components/RateWatch/Predictions';

export const revalidate = 300; // ISR: 5 minutes

async function getRateHistory() {
  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`
      SELECT date, rate, apr, credit_score_tier, loan_type
      FROM rate_history
      WHERE loan_type = '30yr_fixed'
      ORDER BY date ASC
    `;
    return rows.map((r) => ({
      date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date).split('T')[0],
      rate: r.rate,
      apr: r.apr,
      credit_score_tier: r.credit_score_tier,
    }));
  } catch (error) {
    console.error('Failed to fetch rate history:', error);
    return [];
  }
}

async function getFredData() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const res = await fetch(`${baseUrl}/api/rates/fred?series=all&days=365`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error('FRED API error');
    return res.json();
  } catch (error) {
    console.error('Failed to fetch FRED data:', error);
    return { series: {}, latest: {}, source: 'error' };
  }
}

export async function generateMetadata() {
  let rateStr = '';
  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`
      SELECT rate FROM rate_history
      WHERE loan_type = '30yr_fixed' AND credit_score_tier = '760+'
      ORDER BY date DESC LIMIT 1
    `;
    if (rows.length > 0) rateStr = parseFloat(rows[0].rate).toFixed(2) + '%';
  } catch {
    // fallback
  }

  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const title = rateStr
    ? `Rate Watch — 30yr Fixed at ${rateStr} Today | NetRate Mortgage`
    : 'Rate Watch — Today\'s Mortgage Rates | NetRate Mortgage';
  const description = rateStr
    ? `30yr fixed at ${rateStr} today (${today}). See rate history, market commentary, and upcoming events that could move mortgage rates.`
    : 'Daily wholesale mortgage rates compared to the national average. Rate history, market commentary, and upcoming economic events.';

  return {
    title,
    description,
    openGraph: { title, description },
  };
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  name: 'NetRate 30-Year Fixed Mortgage Rate History',
  description:
    'Daily wholesale mortgage rates by credit score tier compared to Freddie Mac national average',
  temporalCoverage: '2025-12/..',
  variableMeasured: 'Mortgage Interest Rate',
  measurementTechnique: 'Daily wholesale lender pricing',
  isAccessibleForFree: true,
  dateModified: new Date().toISOString().split('T')[0],
  creator: {
    '@type': 'Organization',
    name: 'NetRate Mortgage',
    url: 'https://netratemortgage.com',
  },
};

export default async function RateWatchPage() {
  const [rateHistory, fredData] = await Promise.all([getRateHistory(), getFredData()]);

  // Compute today's rate and change for 760+ tier
  const tier760 = rateHistory.filter((r) => r.credit_score_tier === '760+');
  const todayRate = tier760.length > 0 ? parseFloat(tier760[tier760.length - 1].rate) : null;
  const prevRate = tier760.length > 1 ? parseFloat(tier760[tier760.length - 2].rate) : null;
  const rateChange = todayRate && prevRate ? Math.round((todayRate - prevRate) * 1000) / 1000 : 0;

  return (
    <div className="bg-deep text-slate-200 min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Stale data warning */}
      {fredData.stale && (
        <div className="mx-5 mt-4 px-4 py-2.5 bg-amber-900/30 border border-amber-700/40 rounded-lg text-amber-300 text-xs">
          Market data may be delayed — live feed temporarily unavailable. Showing data from {fredData.fallbackDate || 'cache'}.
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-baseline gap-4 px-7 pt-8">
        <h1 className="text-white text-[42px] font-extrabold tracking-tight">
          Rate <span className="text-brand">Watch</span>
        </h1>
        <span className="text-slate-400 text-base">
          Wholesale mortgage rates, updated daily
        </span>
      </div>

      {/* Hero Strip */}
      <HeroStrip
        todayRate={todayRate}
        rateChange={rateChange}
        fredLatest={fredData.latest}
      />

      {/* Ticker Bar */}
      <TickerBar
        fredLatest={fredData.latest}
        todayRate={todayRate}
        rateHistory={rateHistory}
      />

      {/* Bento Dashboard */}
      <div className="px-5 py-6 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        {/* Commentary Card — TOP, spans full width */}
        <div className="lg:col-span-2 bg-surface rounded-xl border border-white/10 overflow-hidden">
          <div className="px-6 py-5">
            <Commentary />
          </div>
        </div>

        {/* Chart Card */}
        <div className="bg-surface rounded-xl border border-white/10 p-5 overflow-hidden">
          <RateChart rateHistory={rateHistory} fredData={fredData.series} />
        </div>

        {/* Sidebar Card */}
        <div className="bg-surface rounded-xl border border-white/10 overflow-hidden">
          <Sidebar
            fredLatest={fredData.latest}
            todayRate={todayRate}
            rateChange={rateChange}
          />
        </div>
      </div>

      {/* Prediction Markets */}
      <Predictions />

      {/* Below the Fold — bento cards */}
      <BelowFold />

      {/* Disclaimer strip */}
      <div className="px-7 py-3.5 border-t border-white/10 text-xs text-slate-400 leading-relaxed">
        Market commentary is for informational purposes only and does not constitute financial
        advice. Rates shown are wholesale par rates and are subject to change. Actual rates depend on
        individual borrower scenario. Data updated daily on business days. NMLS #1111861. Equal
        Housing Lender.
      </div>
    </div>
  );
}
