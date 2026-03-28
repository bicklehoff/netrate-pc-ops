import { neon } from '@neondatabase/serverless';
import HeroStrip from '@/components/RateWatch/HeroStrip';
import TickerBar from '@/components/RateWatch/TickerBar';
import RateChart from '@/components/RateWatch/RateChart';
import Sidebar from '@/components/RateWatch/Sidebar';
import BelowFold from '@/components/RateWatch/BelowFold';
import { PredictionDataProvider, FedPanelSection, MarketPredictions } from '@/components/RateWatch/Predictions';
import RateGrid from '@/components/RateWatch/RateGrid';
import { getHomepageRatesFromDB } from '@/lib/rates/homepage-db';

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

async function getNationalRates() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const res = await fetch(`${baseUrl}/api/market/national-rates`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
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
  const [rateHistory, fredData, nationalData] = await Promise.all([
    getRateHistory(), getFredData(), getNationalRates(),
  ]);

  let liveRates = null;
  let realRate = null;
  liveRates = await getHomepageRatesFromDB();
  realRate = liveRates?.conv30?.rate || null;

  const tier760 = rateHistory.filter((r) => r.credit_score_tier === '760+');
  const dbRate = tier760.length > 0 ? parseFloat(tier760[tier760.length - 1].rate) : null;
  const todayRate = realRate || dbRate;
  const prevDbRate = tier760.length > 1 ? parseFloat(tier760[tier760.length - 2].rate) : null;
  const rateChange = dbRate && prevDbRate ? Math.round((dbRate - prevDbRate) * 1000) / 1000 : 0;

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
      <div className="flex flex-col sm:flex-row items-baseline gap-4 px-5 pt-6 pb-2">
        <h1 className="text-white text-3xl font-extrabold tracking-tight">
          Rate <span className="text-brand">Watch</span>
        </h1>
        <span className="text-slate-400 text-sm">
          Live rates, updated daily
        </span>
      </div>

      {/* Ticker Bar */}
      <TickerBar
        fredLatest={fredData.latest}
        todayRate={todayRate}
        rateHistory={rateHistory}
      />

      {/* === ABOVE THE FOLD: 3-column dashboard === */}
      <PredictionDataProvider>
        <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Column 1: Commentary + Rate */}
          <HeroStrip
            todayRate={todayRate}
            rateChange={rateChange}
            fredLatest={fredData.latest}
          />

          {/* Column 2: Rate Comparison Grid */}
          <div className="md:col-span-1">
            <RateGrid
              netRates={liveRates}
              nationalRates={nationalData?.rates || null}
              date={nationalData?.date || null}
            />
          </div>

          {/* Column 3: Fed Panel + Treasury Yields + Calendar */}
          <div className="md:col-span-2 lg:col-span-1 flex flex-col gap-4">
            <FedPanelSection />
            <div className="bg-surface rounded-xl border border-white/10 overflow-hidden">
              <Sidebar
                fredLatest={fredData.latest}
                todayRate={todayRate}
                rateChange={rateChange}
              />
            </div>
          </div>
        </div>

        {/* === BELOW THE FOLD === */}

        {/* Rate Chart — compact */}
        <div className="px-5 py-4">
          <div className="bg-surface rounded-xl border border-white/10 p-5 overflow-hidden">
            <RateChart rateHistory={rateHistory} fredData={fredData.series} />
          </div>
        </div>

        {/* Market Predictions */}
        <MarketPredictions />
      </PredictionDataProvider>

      {/* Below the Fold — narrative + events + CTA */}
      <BelowFold />

      {/* Disclaimer strip */}
      <div className="px-5 py-3.5 border-t border-white/10 text-xs text-slate-400 leading-relaxed">
        Market commentary is for informational purposes only and does not constitute financial
        advice. Rates shown are wholesale par rates and are subject to change. Actual rates depend on
        individual borrower scenario. Data updated daily on business days. NMLS #1111861. Equal
        Housing Lender.
      </div>
    </div>
  );
}
