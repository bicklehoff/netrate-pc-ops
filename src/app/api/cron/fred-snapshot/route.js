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
  'DGS2', 'DGS5', 'DGS10', 'DGS30',
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

async function fetchTreasuryCMT() {
  const year = new Date().getFullYear();
  const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/all/${year}?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&page&_format=csv`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Treasury CMT returned ${res.status}`);

  const csv = await res.text();
  const lines = csv.trim().split('\n');
  if (lines.length < 3) throw new Error('Treasury CMT CSV too short');

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const idxDate = headers.findIndex(h => h === 'Date');
  const idx1y   = headers.findIndex(h => h === '1 Yr');
  const idx10y  = headers.findIndex(h => h === '10 Yr');
  if (idx1y === -1 || idx10y === -1) throw new Error('Treasury CMT columns not found');

  const cmt1y = [];
  const cmt10y = [];

  // Skip header row, parse all data rows
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    const date = idxDate >= 0 ? cols[idxDate] : null;
    const v1y  = parseFloat(cols[idx1y]);
    const v10y = parseFloat(cols[idx10y]);
    if (!date || isNaN(v1y) || isNaN(v10y)) continue;

    // Treasury uses M/DD/YYYY — convert to YYYY-MM-DD
    const parts = date.split('/');
    if (parts.length !== 3) continue;
    const iso = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;

    cmt1y.push({ date: iso, value: v1y });
    cmt10y.push({ date: iso, value: v10y });
  }

  return { CMT1Y: cmt1y, CMT10Y: cmt10y };
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

  // Fetch Treasury CMT
  // CMT is best-effort — Treasury.gov blocks server-side requests intermittently.
  // CMT failure does not mark the job as failed; FRED data is the critical path.
  const cmtWarnings = [];
  try {
    const cmt = await fetchTreasuryCMT();
    for (const [id, rows] of Object.entries(cmt)) {
      const upserted = await upsertSeries(sql, id, rows);
      results[id] = { upserted, latest: rows[rows.length - 1] };
    }
  } catch (e) {
    cmtWarnings.push(`CMT unavailable: ${e.message}`);
  }

  const hasErrors = Object.keys(errors).length > 0;
  const today = new Date().toISOString().split('T')[0];
  console.log(`[cron/fred-snapshot] ${today}: series=${Object.keys(results).length} fred_errors=${Object.keys(errors).length} cmt_warnings=${cmtWarnings.length}`);

  return NextResponse.json({
    ok: !hasErrors,
    date: today,
    results,
    ...(hasErrors && { errors: Object.keys(errors) }),
    ...(cmtWarnings.length > 0 && { cmtWarnings }),
  });
}
