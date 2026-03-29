import { neon } from '@neondatabase/serverless';
import HeroStrip from '@/components/RateWatch/HeroStrip';
import TickerBar from '@/components/RateWatch/TickerBar';
import RateChart from '@/components/RateWatch/RateChart';
import { TreasuryYields, EconomicCalendar } from '@/components/RateWatch/Sidebar';
import BelowFold from '@/components/RateWatch/BelowFold';
import { PredictionDataProvider, FedPanelSection, MarketPredictions } from '@/components/RateWatch/Predictions';
import RateGrid from '@/components/RateWatch/RateGrid';
import FedStatementDiff from '@/components/RateWatch/FedStatementDiff';
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

  // Build national average rates from MND API or fall back to FRED (Freddie Mac weekly survey)
  let natRates = nationalData?.rates || null;
  let natDate = nationalData?.date || null;
  if (!natRates && fredData.latest) {
    const fl = fredData.latest;
    natRates = {};
    if (fl.MORTGAGE30US) {
      natRates.conv30 = { rate: fl.MORTGAGE30US.value, change: fl.MORTGAGE30US.change || 0 };
    }
    if (fl.MORTGAGE15US) {
      natRates.conv15 = { rate: fl.MORTGAGE15US.value, change: fl.MORTGAGE15US.change || 0 };
    }
    natDate = fl.MORTGAGE30US?.date || null;
  }

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

      {/* Header row — title + ticker inline */}
      <div className="flex items-center gap-4 px-3 pt-3 pb-1">
        <h1 className="text-white text-xl font-extrabold tracking-tight whitespace-nowrap">
          Rate <span className="text-brand">Watch</span>
        </h1>
        <div className="flex-1 min-w-0">
          <TickerBar
            fredLatest={fredData.latest}
            todayRate={todayRate}
            rateHistory={rateHistory}
          />
        </div>
      </div>

      {/* === 3-column dashboard — pack everything in === */}
      <PredictionDataProvider>
        <div className="px-3 py-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 items-start">
          {/* Column 1: Commentary + Chart */}
          <div className="flex flex-col gap-2">
            <HeroStrip
              todayRate={todayRate}
              rateChange={rateChange}
            />
            <div className="bg-surface rounded-xl border border-white/10 p-3 overflow-hidden">
              <RateChart rateHistory={rateHistory} fredData={fredData.series} />
            </div>
          </div>

          {/* Column 2: Rate Grid + Treasury Yields + Market Predictions */}
          <div className="flex flex-col gap-2">
            <RateGrid
              netRates={liveRates}
              nationalRates={natRates}
              date={natDate}
            />
            <TreasuryYields fredLatest={fredData.latest} />
            <MarketPredictions />
          </div>

          {/* Column 3: Fed Panel + Statement Diff + Economic Calendar */}
          <div className="md:col-span-2 lg:col-span-1 flex flex-col gap-2">
            <FedPanelSection />
            <FedStatementDiff />
            <EconomicCalendar />
          </div>
        </div>
      </PredictionDataProvider>

      {/* Narrative + events + CTA */}
      <BelowFold />

      {/* Disclaimer */}
      <div className="px-3 py-2 border-t border-white/10 text-[10px] text-slate-500 leading-relaxed">
        Market commentary is for informational purposes only and does not constitute financial advice.
        Rates shown are wholesale par rates and are subject to change. NMLS #1111861. Equal Housing Lender.
      </div>
    </div>
  );
}
