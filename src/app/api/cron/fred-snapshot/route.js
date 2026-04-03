/**
 * Vercel Cron Job — Daily FRED + Treasury CMT Snapshot
 * Runs weekdays at 6:00pm EST (23:00 UTC) via vercel.json schedule.
 *
 * Fetches all economic indicator series and upserts into fred_series_data table.
 * Page reads from DB — eliminates 10+ live FRED API calls on every page load.
 *
 * Series stored:
 *   MORTGAGE30US, MORTGAGE15US          — Freddie Mac weekly survey
 *   DGS2, DGS5, DGS10, DGS30           — Treasury yields
 *   SOFR, SOFR30DAYAVG                  — SOFR rates
 *   DPRIME, FEDFUNDS                    — Fed rates
 *   CMT1Y, CMT10Y                       — Treasury CMT (from Treasury.gov, not FRED)
 */

import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';
const FRED_SERIES = [
  'MORTGAGE30US', 'MORTGAGE15US',
  'DGS1', 'DGS2', 'DGS5', 'DGS10', 'DGS30',  // DGS1 = CMT1Y, DGS10 = CMT10Y
  'SOFR', 'SOFR30DAYAVG',
  'DPRIME', 'FEDFUNDS',
];

// How many days of history to fetch/refresh each run
const LOOKBACK_DAYS = 400;

async function fetchFredSeries(seriesId, apiKey) {
  const start = new Date();
  start.setDate(start.getDate() - LOOKBACK_DAYS);
  const startStr = start.toISOString().split('T')[0];

  const url = `${FRED_BASE}?series_id=${seriesId}&api_key=${apiKey}&file_type=json&observation_start=${startStr}&sort_order=desc`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`FRED ${seriesId} returned ${res.status}`);

  const data = await res.json();
  return (data.observations || [])
    .filter(o => o.value !== '.')
    .map(o => ({ date: o.date, value: parseFloat(o.value) }));
}

// CMT aliases: DGS1 = CMT1Y, DGS10 = CMT10Y — same data, served via FRED
// Treasury.gov direct CSV blocks server-side requests; FRED is the reliable source.
async function upsertCmtAliases(sql, fredResults) {
  const aliases = { CMT1Y: 'DGS1', CMT10Y: 'DGS10' };
  const aliasResults = {};
  for (const [alias, sourceId] of Object.entries(aliases)) {
    const sourceRows = fredResults[sourceId];
    if (!sourceRows?.length) continue;
    const upserted = await upsertSeries(sql, alias, sourceRows);
    aliasResults[alias] = { upserted, latest: sourceRows[0], source: sourceId };
  }
  return aliasResults;
}

async function upsertSeries(sql, seriesId, rows) {
  let upserted = 0;
  // Batch in chunks of 50 to avoid query size limits
  const CHUNK = 50;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    for (const row of chunk) {
      await sql`
        INSERT INTO fred_series_data (series_id, date, value, fetched_at)
        VALUES (${seriesId}, ${row.date}::date, ${row.value}, NOW())
        ON CONFLICT (series_id, date)
        DO UPDATE SET value = EXCLUDED.value, fetched_at = NOW()
      `;
      upserted++;
    }
  }
  return upserted;
}

export async function GET(request) {
  // Auth: Vercel cron (Bearer) or CLAW_API_KEY for manual triggers
  const authHeader = request.headers.get('authorization') || '';
  const apiKey     = request.headers.get('x-api-key') || '';
  const urlKey     = new URL(request.url).searchParams.get('key') || '';

  const cronSecret = process.env.CRON_SECRET;
  const clawKey    = process.env.CLAW_API_KEY;

  const authorized =
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (clawKey && (apiKey === clawKey || urlKey === clawKey));

  if (!authorized && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const fredApiKey = process.env.FRED_API_KEY;
  if (!fredApiKey) {
    return NextResponse.json({ error: 'FRED_API_KEY not set' }, { status: 500 });
  }

  const sql = neon(process.env.PC_DATABASE_URL || process.env.DATABASE_URL);
  const results = {};
  const errors = {};

  // Fetch all FRED series in parallel
  const fredResults = await Promise.allSettled(
    FRED_SERIES.map(async (id) => {
      const rows = await fetchFredSeries(id, fredApiKey);
      return { id, rows };
    })
  );

  for (const result of fredResults) {
    if (result.status === 'fulfilled') {
      const { id, rows } = result.value;
      const upserted = await upsertSeries(sql, id, rows);
      results[id] = { upserted, latest: rows[0] };
    } else {
      errors[result.reason?.message || 'unknown'] = true;
    }
  }

  // Write CMT aliases from already-fetched FRED data (DGS1→CMT1Y, DGS10→CMT10Y)
  // No Treasury.gov needed — same data available through FRED.
  const fredResultsMap = {};
  for (const r of fredResults) {
    if (r.status === 'fulfilled') fredResultsMap[r.value.id] = r.value.rows;
  }
  const cmtResults = await upsertCmtAliases(sql, fredResultsMap);
  Object.assign(results, cmtResults);

  const hasErrors = Object.keys(errors).length > 0;
  const today = new Date().toISOString().split('T')[0];
  console.log(`[cron/fred-snapshot] ${today}: series=${Object.keys(results).length} errors=${Object.keys(errors).length}`);

  return NextResponse.json({
    ok: !hasErrors,
    date: today,
    results,
    ...(hasErrors && { errors: Object.keys(errors) }),
  });
}
