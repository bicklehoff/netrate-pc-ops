import { neon } from '@neondatabase/serverless';
import HeroStrip from '@/components/RateWatch/HeroStrip';
import TickerBar from '@/components/RateWatch/TickerBar';
import RateChart from '@/components/RateWatch/RateChart';
import { TreasuryYields, EconomicCalendar } from '@/components/RateWatch/Sidebar';
import BelowFold from '@/components/RateWatch/BelowFold';
import { PredictionDataProvider, FedPanelSection } from '@/components/RateWatch/Predictions';
import RateGrid from '@/components/RateWatch/RateGrid';
import FedStatementDiff from '@/components/RateWatch/FedStatementDiff';
import Commentary from '@/components/RateWatch/Commentary';
import WhatHappenedToday from '@/components/RateWatch/WhatHappenedToday';
import BenchmarkIndexes from '@/components/RateWatch/BenchmarkIndexes';
import MarketNews from '@/components/RateWatch/MarketNews';
import { getHomepageRatesFromDB } from '@/lib/rates/homepage-db';

export const revalidate = 300; // ISR: 5 minutes

async function getRateHistory() {
  try {
    const sql = neon(process.env.PC_DATABASE_URL || process.env.DATABASE_URL);
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
    const sql = neon(process.env.PC_DATABASE_URL || process.env.DATABASE_URL);
    const rows = await sql`
      SELECT date, loan_type, rate, lender AS change_str
      FROM rate_history
      WHERE source = 'mnd' AND credit_score_tier = 'national'
      ORDER BY date DESC, id DESC
      LIMIT 10
    `;
    if (!rows.length) return null;

    const latestDate = String(rows[0].date).split('T')[0];
    const latest = rows.filter(r => String(r.date).split('T')[0] === latestDate);

    const PRODUCT_MAP = {
      '30yr_fixed': 'conv30', '15yr_fixed': 'conv15',
      'fha_30yr': 'fha30', 'va_30yr': 'va30',
    };

    const rates = {};
    for (const row of latest) {
      const key = PRODUCT_MAP[row.loan_type];
      if (key) {
        rates[key] = { rate: parseFloat(row.rate), change: row.change_str ? parseFloat(row.change_str) : 0 };
      }
    }
    return { rates, date: latestDate, source: 'mnd' };
  } catch (error) {
    console.error('Failed to fetch national rates:', error);
    return null;
  }
}

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';
const FRED_SERIES = {
  MORTGAGE30US: '30yr Fixed (Freddie Mac)',
  MORTGAGE15US: '15yr Fixed (Freddie Mac)',
  DGS2: '2yr Treasury', DGS5: '5yr Treasury',
  DGS10: '10yr Treasury', DGS30: '30yr Treasury',
  SOFR30DAYAVG: '30-Day Avg SOFR', SOFR: 'SOFR (Overnight)',
  DPRIME: 'Prime Rate', FEDFUNDS: 'Fed Funds Rate',
};
const FRED_FALLBACK = {
  MORTGAGE30US: [{ date: '2026-03-26', value: 6.38 }, { date: '2026-03-20', value: 6.22 }],
  MORTGAGE15US: [{ date: '2026-03-26', value: 5.75 }, { date: '2026-03-20', value: 5.59 }],
  DGS2: [{ date: '2026-03-27', value: 3.919 }, { date: '2026-03-26', value: 3.978 }],
  DGS5: [{ date: '2026-03-27', value: 4.076 }, { date: '2026-03-26', value: 4.099 }],
  DGS10: [{ date: '2026-03-27', value: 4.434 }, { date: '2026-03-26', value: 4.42 }],
  DGS30: [{ date: '2026-03-27', value: 4.97 }, { date: '2026-03-26', value: 4.936 }],
  SOFR30DAYAVG: [{ date: '2026-03-28', value: 4.31 }, { date: '2026-03-27', value: 4.31 }],
  SOFR: [{ date: '2026-03-28', value: 4.30 }, { date: '2026-03-27', value: 4.31 }],
  DPRIME: [{ date: '2026-03-28', value: 7.50 }, { date: '2026-01-30', value: 7.50 }],
  FEDFUNDS: [{ date: '2026-03-01', value: 4.33 }, { date: '2026-02-01', value: 4.33 }],
};

async function getFredData() {
  try {
    const apiKey = process.env.FRED_API_KEY;
    const start = new Date();
    start.setDate(start.getDate() - 365);
    const startStr = start.toISOString().split('T')[0];

    const seriesIds = Object.keys(FRED_SERIES);
    let usedFallback = false;

    const fetchResults = await Promise.all(
      seriesIds.map(async (id) => {
        if (!apiKey) return [id, null];
        try {
          const url = `${FRED_BASE}?series_id=${id}&api_key=${apiKey}&file_type=json&observation_start=${startStr}&sort_order=desc`;
          const res = await fetch(url, { next: { revalidate: 3600 } });
          if (!res.ok) return [id, null];
          const data = await res.json();
          const obs = (data.observations || [])
            .filter(o => o.value !== '.')
            .map(o => ({ date: o.date, value: parseFloat(o.value) }));
          return [id, obs.length > 0 ? obs : null];
        } catch { return [id, null]; }
      })
    );

    const results = {};
    for (const [id, data] of fetchResults) {
      if (data) { results[id] = data; }
      else { results[id] = FRED_FALLBACK[id] || []; usedFallback = true; }
    }

    const latest = {};
    for (const [key, obs] of Object.entries(results)) {
      if (obs.length > 0) {
        const cur = obs[0];
        const prev = obs.length > 1 ? obs[1] : null;
        latest[key] = {
          value: cur.value, date: cur.date,
          change: prev ? Math.round((cur.value - prev.value) * 1000) / 1000 : 0,
          label: FRED_SERIES[key] || key,
        };
      }
    }

    return {
      series: results, latest,
      source: !apiKey ? 'fallback' : usedFallback ? 'partial-fallback' : 'fred',
      ...(usedFallback && { fallbackDate: '2026-03-28', stale: true }),
    };
  } catch (error) {
    console.error('Failed to fetch FRED data:', error);
    return { series: {}, latest: {}, source: 'error' };
  }
}

async function getTreasuryCMT() {
  try {
    const year = new Date().getFullYear();
    const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/all/${year}?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&page&_format=csv`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const csv = await res.text();
    const lines = csv.trim().split('\n');
    if (lines.length < 3) return null;
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const idx1y = headers.findIndex(h => h === '1 Yr');
    const idx10y = headers.findIndex(h => h === '10 Yr');
    const idxDate = headers.findIndex(h => h === 'Date');
    if (idx1y === -1 || idx10y === -1) return null;
    const lastRow = lines[lines.length - 1].split(',').map(v => v.trim().replace(/"/g, ''));
    const prevRow = lines[lines.length - 2].split(',').map(v => v.trim().replace(/"/g, ''));
    return {
      date: idxDate >= 0 ? lastRow[idxDate] : null,
      oneYear: parseFloat(lastRow[idx1y]) || null,
      tenYear: parseFloat(lastRow[idx10y]) || null,
      oneYearPrev: parseFloat(prevRow[idx1y]) || null,
      tenYearPrev: parseFloat(prevRow[idx10y]) || null,
    };
  } catch (error) {
    console.error('Treasury CMT error:', error);
    return null;
  }
}

export async function generateMetadata() {
  let rateStr = '';
  try {
    const sql = neon(process.env.PC_DATABASE_URL || process.env.DATABASE_URL);
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
  const [rateHistory, fredData, nationalData, cmtData] = await Promise.all([
    getRateHistory(), getFredData(), getNationalRates(), getTreasuryCMT(),
  ]);

  let liveRates = null;
  let realRate = null;
  liveRates = await getHomepageRatesFromDB();
  realRate = liveRates?.conv30?.rate || null;

  const tier760 = rateHistory.filter((r) => r.credit_score_tier === '760+');
  const dbRate = tier760.length > 0 ? parseFloat(tier760[tier760.length - 1].rate) : null;
  const todayRate = realRate || dbRate;

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

  const rateChange = natRates?.conv30?.change
    || fredData.latest?.MORTGAGE30US?.change
    || 0;

  return (
    <div className="bg-slate-50 min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Google Material Symbols for icons */}
      <link
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        rel="stylesheet"
      />

      {/* Stale data warning */}
      {fredData.stale && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <div className="px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-xs">
            Market data may be delayed — live feed temporarily unavailable. Showing data from {fredData.fallbackDate || 'cache'}.
          </div>
        </div>
      )}

      {/* Header row — title + ticker */}
      <div className="max-w-7xl mx-auto px-4 pt-4 pb-2">
        <div className="flex items-center gap-4">
          <h1 className="text-slate-900 text-xl font-extrabold tracking-tight whitespace-nowrap">
            Rate <span className="text-primary">Watch</span>
          </h1>
          <div className="flex-1 min-w-0">
            <TickerBar
              fredLatest={fredData.latest}
              todayRate={todayRate}
              rateHistory={rateHistory}
            />
          </div>
        </div>
      </div>

      {/* Bento grid layout */}
      <PredictionDataProvider>
        <div className="max-w-7xl mx-auto px-4 py-4 space-y-4">

          {/* Row 1: Hero (2col) + Fed Prediction (1col) — fixed height */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:h-[280px]">
            <div className="lg:col-span-2 min-h-0">
              <HeroStrip todayRate={todayRate} rateChange={rateChange} apr={liveRates?.conv30?.apr || null} />
            </div>
            <div className="min-h-0">
              <FedPanelSection />
            </div>
          </div>

          {/* Row 2: Commentary (2col) + Treasury Yields (1col) — fixed height */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:h-[250px]">
            <div className="lg:col-span-2 min-h-0">
              <Commentary />
            </div>
            <div className="min-h-0">
              <TreasuryYields fredLatest={fredData.latest} />
            </div>
          </div>

          {/* Row 3: Rate Table (2col) + Economic Calendar (1col) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 min-h-0">
              <RateGrid
                netRates={liveRates}
                nationalRates={natRates}
                date={natDate}
              />
            </div>
            <div className="min-h-0">
              <EconomicCalendar />
            </div>
          </div>

          {/* Row 4: Rate History Chart — full width, fixed height */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-6 shadow-sm overflow-hidden lg:h-[400px]">
            <RateChart rateHistory={rateHistory} fredData={fredData.series} />
          </div>

          {/* Row 5: Benchmark Index Rates — full width */}
          <BenchmarkIndexes fredLatest={fredData.latest} cmtData={cmtData} />

          {/* Row 6: Commentary detail (2col) + Market News (1col) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:h-[320px]">
            <div className="lg:col-span-2 min-h-0" id="full-commentary">
              <WhatHappenedToday />
            </div>
            <div className="min-h-0">
              <MarketNews />
            </div>
          </div>

          {/* Row 7: Fed Statement Diff — full width */}
          <FedStatementDiff />

          {/* Below fold: events, CTA, SEO */}
          <BelowFold />

        </div>
      </PredictionDataProvider>
    </div>
  );
}
