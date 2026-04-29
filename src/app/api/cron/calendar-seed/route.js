/**
 * Vercel Cron Job — Weekly Economic Calendar Seed
 * Runs every Monday at 8:00 AM UTC via vercel.json schedule.
 *
 * Fetches upcoming release dates from FRED's releases API for key economic
 * indicators and upserts them into economic_calendar_events as skeleton events.
 * Claw owns: actual, result, forecast, prior — this cron never overwrites those.
 * PC owns: date, name, time, big — the schedule skeleton.
 *
 * Events seeded (verified FRED release IDs):
 *   50  — Jobs Report          (Employment Situation)                    — 8:30 AM ET
 *   10  — CPI Release          (Consumer Price Index)                    — 8:30 AM ET
 *   54  — PCE / Personal Income (Personal Income and Outlays)            — 8:30 AM ET
 *   46  — PPI Release          (Producer Price Index)                    — 8:30 AM ET
 *   101 — FOMC Meeting         (FOMC Press Release)                      — 2:00 PM ET
 *   53  — GDP Release          (Gross Domestic Product)                  — 8:30 AM ET
 *   9   — Retail Sales         (Advance Monthly Retail and Food Services) — 8:30 AM ET
 *   180 — Jobless Claims       (Unemployment Insurance Weekly)           — 8:30 AM ET
 *   95  — Durable Goods        (Manufacturer's Shipments, Inventories)   — 8:30 AM ET
 *   27  — Housing Starts       (New Residential Construction)            — 8:30 AM ET
 */

import { NextResponse } from 'next/server';
import sql from '@/lib/db';

const FRED_BASE = 'https://api.stlouisfed.org/fred/release/dates';

// FRED release ID → calendar display name + time + big flag
const KEY_RELEASES = [
  { id: 50,  name: 'Jobs Report',           time: '8:30 AM ET',  big: true  },
  { id: 10,  name: 'CPI Release',           time: '8:30 AM ET',  big: true  },
  { id: 54,  name: 'PCE / Personal Income', time: '8:30 AM ET',  big: true  },
  { id: 46,  name: 'PPI Release',           time: '8:30 AM ET',  big: false },
  { id: 101, name: 'FOMC Meeting',          time: '2:00 PM ET',  big: true  },
  { id: 53,  name: 'GDP Release',           time: '8:30 AM ET',  big: true  },
  { id: 9,   name: 'Retail Sales',          time: '8:30 AM ET',  big: false },
  { id: 180, name: 'Jobless Claims',        time: '8:30 AM ET',  big: true  },
  { id: 95,  name: 'Durable Goods',         time: '8:30 AM ET',  big: false },
  { id: 27,  name: 'Housing Starts',        time: '8:30 AM ET',  big: false },
];

// How many days ahead to seed
const LOOKAHEAD_DAYS = 90;

async function fetchReleaseDates(releaseId, apiKey, todayStr, toStr) {
  const url = `${FRED_BASE}?release_id=${releaseId}&sort_order=asc&realtime_start=${todayStr}&api_key=${apiKey}&file_type=json`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`FRED release/${releaseId} returned ${res.status}`);
  const data = await res.json();
  return (data.release_dates || [])
    .map(d => d.date)
    .filter(d => d >= todayStr && d <= toStr);
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

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const toDate = new Date(today);
  toDate.setDate(toDate.getDate() + LOOKAHEAD_DAYS);
  const toStr = toDate.toISOString().split('T')[0];

  const results = {};
  const errors = {};
  const datesByName = {};

  for (const release of KEY_RELEASES) {
    try {
      const dates = await fetchReleaseDates(release.id, fredApiKey, todayStr, toStr);
      let seeded = 0;

      for (const dateStr of dates) {
        // Upsert: create skeleton event; never overwrite Claw-owned fields (actual, result, forecast, prior)
        await sql`
          INSERT INTO economic_calendar_events (date, name, time, big, source, updated_at)
          VALUES (${new Date(dateStr)}, ${release.name}, ${release.time}, ${release.big}, 'fred-calendar', NOW())
          ON CONFLICT (date, name) DO UPDATE SET
            time = EXCLUDED.time,
            big = EXCLUDED.big,
            updated_at = NOW()
        `;
        seeded++;
      }

      datesByName[release.name] = dates;
      results[release.name] = { seeded, dates };
    } catch (err) {
      errors[release.name] = err.message;
    }
  }

  // Cleanup: remove stale future skeleton events whose date is no longer in the
  // freshly-fetched FRED schedule for that name. Catches drift from prior seeds
  // (e.g. wrong release IDs that pulled dates from a different release calendar).
  // Skip cleanup for rows where Claw has already filled in actual/result values.
  let cleaned = 0;
  for (const [name, dates] of Object.entries(datesByName)) {
    if (dates.length === 0) continue;
    const deleted = await sql`
      DELETE FROM economic_calendar_events
      WHERE source = 'fred-calendar'
        AND name = ${name}
        AND date >= ${todayStr}::date
        AND actual IS NULL
        AND result IS NULL
        AND date != ALL(${dates}::date[])
      RETURNING id
    `;
    cleaned += deleted.length;
  }

  const hasErrors = Object.keys(errors).length > 0;
  console.log(`[cron/calendar-seed] ${todayStr}: seeded=${Object.values(results).reduce((s, r) => s + r.seeded, 0)} cleaned=${cleaned} errors=${Object.keys(errors).length}`);

  return NextResponse.json({
    ok: !hasErrors,
    date: todayStr,
    lookahead: `${todayStr} → ${toStr}`,
    results,
    cleaned,
    ...(hasErrors && { errors }),
  });
}
