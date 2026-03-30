// FRED API Proxy — Fetches mortgage rates and treasury yields from St. Louis Fed
//
// GET /api/rates/fred?series=MORTGAGE30US&days=90
// GET /api/rates/fred?series=all (default — fetches all series)
//
// Series: MORTGAGE30US, MORTGAGE15US, DGS2, DGS5, DGS10, DGS30
// Cache: 1-hour CDN, 5-min browser (FRED updates daily/weekly)

import { NextResponse } from 'next/server';

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';

const SERIES_CONFIG = {
  MORTGAGE30US: { label: '30yr Fixed (Freddie Mac)', frequency: 'weekly' },
  MORTGAGE15US: { label: '15yr Fixed (Freddie Mac)', frequency: 'weekly' },
  DGS2: { label: '2yr Treasury', frequency: 'daily' },
  DGS5: { label: '5yr Treasury', frequency: 'daily' },
  DGS10: { label: '10yr Treasury', frequency: 'daily' },
  DGS30: { label: '30yr Treasury', frequency: 'daily' },
};

// Fallback data when FRED API key is not set, API is down, or no data for date range
// (weekends/holidays return empty). IMPORTANT: Update after each Thursday PMMS release.
// Last updated: 2026-03-28
const FALLBACK_DATA = {
  MORTGAGE30US: [
    { date: '2026-03-26', value: 6.38 },
    { date: '2026-03-20', value: 6.22 },
    { date: '2026-03-13', value: 6.65 },
    { date: '2026-03-06', value: 6.63 },
    { date: '2026-02-27', value: 6.76 },
    { date: '2026-02-20', value: 6.85 },
    { date: '2026-02-13', value: 6.87 },
    { date: '2026-02-06', value: 6.89 },
    { date: '2026-01-30', value: 6.95 },
    { date: '2026-01-23', value: 6.96 },
    { date: '2026-01-16', value: 6.93 },
    { date: '2026-01-09', value: 6.93 },
    { date: '2026-01-02', value: 6.91 },
    { date: '2025-12-26', value: 6.85 },
    { date: '2025-12-19', value: 6.72 },
  ],
  MORTGAGE15US: [
    { date: '2026-03-26', value: 5.75 },
    { date: '2026-03-20', value: 5.59 },
    { date: '2026-03-13', value: 5.89 },
  ],
  DGS2: [{ date: '2026-03-27', value: 3.919 }, { date: '2026-03-26', value: 3.978 }],
  DGS5: [{ date: '2026-03-27', value: 4.076 }, { date: '2026-03-26', value: 4.099 }],
  DGS10: [{ date: '2026-03-27', value: 4.434 }, { date: '2026-03-26', value: 4.42 }],
  DGS30: [{ date: '2026-03-27', value: 4.97 }, { date: '2026-03-26', value: 4.936 }],
};

const FALLBACK_DATE = '2026-03-28';

async function fetchFredSeries(seriesId, days = 365) {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) return null;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const start = startDate.toISOString().split('T')[0];

  try {
    const url = `${FRED_BASE}?series_id=${seriesId}&api_key=${apiKey}&file_type=json&observation_start=${start}&sort_order=desc`;
    const res = await fetch(url, { next: { revalidate: 3600 } });

    if (!res.ok) {
      console.error(`FRED API error for ${seriesId}:`, res.status);
      return null;
    }

    const data = await res.json();
    return (data.observations || [])
      .filter(o => o.value !== '.')
      .map(o => ({
        date: o.date,
        value: parseFloat(o.value),
      }));
  } catch (error) {
    console.error(`FRED fetch error for ${seriesId}:`, error.message);
    return null;
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const seriesParam = searchParams.get('series') || 'all';
    const days = parseInt(searchParams.get('days') || '365', 10);

    const seriesToFetch = seriesParam === 'all'
      ? Object.keys(SERIES_CONFIG)
      : seriesParam.split(',').filter(s => SERIES_CONFIG[s]);

    // Fetch all series in parallel instead of sequentially
    const fetchResults = await Promise.all(
      seriesToFetch.map(async (seriesId) => {
        const data = await fetchFredSeries(seriesId, days);
        return [seriesId, data];
      })
    );

    const results = {};
    let usedFallback = false;
    for (const [seriesId, data] of fetchResults) {
      if (data && data.length > 0) {
        results[seriesId] = data;
      } else {
        // API failed OR returned empty (weekends/holidays) — use fallback
        results[seriesId] = FALLBACK_DATA[seriesId] || [];
        usedFallback = true;
      }
    }

    // Compute latest values for convenience
    const latest = {};
    for (const [key, observations] of Object.entries(results)) {
      if (observations.length > 0) {
        const current = observations[0];
        const previous = observations.length > 1 ? observations[1] : null;
        latest[key] = {
          value: current.value,
          date: current.date,
          change: previous ? Math.round((current.value - previous.value) * 1000) / 1000 : 0,
          label: SERIES_CONFIG[key]?.label || key,
        };
      }
    }

    const source = !process.env.FRED_API_KEY ? 'fallback'
      : usedFallback ? 'partial-fallback'
      : 'fred';

    const response = NextResponse.json({
      series: results,
      latest,
      source,
      ...(usedFallback && { fallbackDate: FALLBACK_DATE, stale: true }),
    });

    response.headers.set(
      'Cache-Control',
      'public, s-maxage=3600, max-age=300, stale-while-revalidate=600'
    );

    return response;
  } catch (error) {
    console.error('FRED API route error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch FRED data', series: {}, latest: {} },
      { status: 500 }
    );
  }
}
