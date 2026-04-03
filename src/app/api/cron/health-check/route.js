/**
 * Vercel Cron Job — Daily Data Health Check
 * Runs weekdays at 9:00am EST (14:00 UTC) via vercel.json schedule.
 *
 * Validates that yesterday's cron jobs ran and produced sane data.
 * Posts a relay alert to TrackerPortal inbox if anything looks wrong.
 *
 * Checks:
 *   1. MND rate_history has an entry for today (if weekday) or last weekday
 *   2. MND 30yr rate is within plausible range (5.0% – 9.0%)
 *   3. MND rate didn't move more than ±0.5% from previous day (parse failure guard)
 *   4. fred_series_data has DGS10 updated within last 36 hours
 *   5. fred_series_data has MORTGAGE30US updated within last 8 days (weekly series)
 */

import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

const RELAY_URL  = 'https://tracker.netratemortgage.com/api/relay';
const RATE_MIN   = 5.0;
const RATE_MAX   = 9.0;
const RATE_MAX_DAILY_MOVE = 0.5;  // flag if MND moves more than this in one day
const FRED_DAILY_STALE_HOURS  = 36;
const FRED_WEEKLY_STALE_DAYS  = 8;

function lastWeekday(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  if (day === 0) d.setDate(d.getDate() - 2); // Sunday → Friday
  if (day === 6) d.setDate(d.getDate() - 1); // Saturday → Friday
  return d.toISOString().split('T')[0];
}

async function postRelay(apiKey, failures) {
  const content = [
    '**Rate Watch Health Check FAILED**',
    '',
    ...failures.map(f => `- ${f}`),
    '',
    `Time: ${new Date().toISOString()}`,
    'Action: Check Vercel logs for /api/cron/mnd-scrape and /api/cron/fred-snapshot',
  ].join('\n');

  await fetch(RELAY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-tracker-api-key': apiKey,
    },
    body: JSON.stringify({
      fromDevice: 'pc',
      toDevice:   'mac',
      type:       'alert',
      content,
      context:    { source: 'health-check-cron', severity: 'warning' },
    }),
  });
}

export async function GET(request) {
  // Auth: Vercel cron (Bearer) or CLAW_API_KEY
  const authHeader = request.headers.get('authorization') || '';
  const apiKey     = request.headers.get('x-api-key') || '';
  const urlKey     = new URL(request.url).searchParams.get('key') || '';

  const cronSecret    = process.env.CRON_SECRET;
  const clawKey       = process.env.CLAW_API_KEY;
  const trackerApiKey = process.env.TRACKER_API_KEY;

  const authorized =
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (clawKey && (apiKey === clawKey || urlKey === clawKey));

  if (!authorized && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sql = neon(process.env.PC_DATABASE_URL || process.env.DATABASE_URL);
  const failures = [];
  const checks = {};
  const today = new Date().toISOString().split('T')[0];
  const expectedDate = lastWeekday(); // today if weekday, last Friday otherwise

  // ── Check 1: MND has entry for expected date ──────────────────────────────
  try {
    const mndRows = await sql`
      SELECT rate::float, date::text
      FROM rate_history
      WHERE source = 'mnd'
        AND loan_type = '30yr_fixed'
        AND credit_score_tier = 'national'
      ORDER BY date DESC
      LIMIT 2
    `;

    if (!mndRows.length) {
      failures.push('MND: no data in rate_history at all');
      checks.mnd = 'no_data';
    } else {
      const latest = mndRows[0];
      const latestDate = String(latest.date).split('T')[0];
      const rate = parseFloat(latest.rate);

      // Check freshness
      if (latestDate < expectedDate) {
        failures.push(`MND: latest entry is ${latestDate}, expected ${expectedDate}`);
        checks.mnd = `stale:${latestDate}`;
      } else {
        checks.mnd = `ok:${latestDate}:${rate}%`;
      }

      // Check plausible range
      if (rate < RATE_MIN || rate > RATE_MAX) {
        failures.push(`MND: 30yr rate ${rate}% is outside plausible range (${RATE_MIN}–${RATE_MAX}%)`);
        checks.mndRange = `out_of_range:${rate}`;
      } else {
        checks.mndRange = `ok:${rate}`;
      }

      // Check daily move vs previous entry
      if (mndRows.length >= 2) {
        const prevRate = parseFloat(mndRows[1].rate);
        const move = Math.abs(rate - prevRate);
        if (move > RATE_MAX_DAILY_MOVE) {
          failures.push(`MND: 30yr moved ${move.toFixed(3)}% in one day (${prevRate}% → ${rate}%) — possible parse error`);
          checks.mndMove = `suspicious:${move.toFixed(3)}`;
        } else {
          checks.mndMove = `ok:${move.toFixed(3)}`;
        }
      }
    }
  } catch (e) {
    failures.push(`MND check error: ${e.message}`);
    checks.mnd = `error:${e.message}`;
  }

  // ── Check 2: FRED daily series (DGS10) freshness ─────────────────────────
  try {
    const fredDaily = await sql`
      SELECT date::text, fetched_at
      FROM fred_series_data
      WHERE series_id = 'DGS10'
      ORDER BY date DESC
      LIMIT 1
    `;

    if (!fredDaily.length) {
      failures.push('FRED: DGS10 has no data — fred-snapshot cron may not have run yet');
      checks.fredDaily = 'no_data';
    } else {
      const fetchedAt = new Date(fredDaily[0].fetched_at);
      const hoursAgo = (Date.now() - fetchedAt.getTime()) / (1000 * 60 * 60);
      if (hoursAgo > FRED_DAILY_STALE_HOURS) {
        failures.push(`FRED: DGS10 last fetched ${hoursAgo.toFixed(1)} hours ago (threshold: ${FRED_DAILY_STALE_HOURS}h)`);
        checks.fredDaily = `stale:${hoursAgo.toFixed(1)}h`;
      } else {
        checks.fredDaily = `ok:${hoursAgo.toFixed(1)}h ago`;
      }
    }
  } catch (e) {
    failures.push(`FRED daily check error: ${e.message}`);
    checks.fredDaily = `error:${e.message}`;
  }

  // ── Check 3: FRED weekly series (MORTGAGE30US) freshness ─────────────────
  try {
    const fredWeekly = await sql`
      SELECT date::text, fetched_at
      FROM fred_series_data
      WHERE series_id = 'MORTGAGE30US'
      ORDER BY date DESC
      LIMIT 1
    `;

    if (!fredWeekly.length) {
      failures.push('FRED: MORTGAGE30US has no data');
      checks.fredWeekly = 'no_data';
    } else {
      const fetchedAt = new Date(fredWeekly[0].fetched_at);
      const daysAgo = (Date.now() - fetchedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysAgo > FRED_WEEKLY_STALE_DAYS) {
        failures.push(`FRED: MORTGAGE30US last fetched ${daysAgo.toFixed(1)} days ago (threshold: ${FRED_WEEKLY_STALE_DAYS}d)`);
        checks.fredWeekly = `stale:${daysAgo.toFixed(1)}d`;
      } else {
        checks.fredWeekly = `ok:${daysAgo.toFixed(1)}d ago`;
      }
    }
  } catch (e) {
    failures.push(`FRED weekly check error: ${e.message}`);
    checks.fredWeekly = `error:${e.message}`;
  }

  // ── Send relay alert if any failures ─────────────────────────────────────
  if (failures.length > 0 && trackerApiKey) {
    try {
      await postRelay(trackerApiKey, failures);
    } catch (e) {
      console.error('[health-check] Failed to send relay alert:', e.message);
    }
  }

  const passed = failures.length === 0;
  console.log(`[cron/health-check] ${today}: ${passed ? 'PASS' : `FAIL (${failures.length} issues)`}`, checks);

  return NextResponse.json({
    ok: passed,
    date: today,
    checks,
    ...(failures.length > 0 && { failures }),
  }, { status: passed ? 200 : 207 });
}
