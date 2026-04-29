/**
 * Vercel Cron Job — Weekly Economic Calendar Seed
 * Runs every Monday at 8:00 AM UTC via vercel.json schedule.
 *
 * Generates skeleton events for major economic releases over the next 90 days
 * using known release patterns (weekly, monthly nth-weekday, hardcoded). FRED's
 * release/dates API only returns past dates and is not viable for forward-looking
 * scheduling — that's why this cron uses patterns instead.
 *
 * Claw owns: actual, result, forecast, prior — this cron never overwrites those.
 * PC owns: date, name, time, big — the schedule skeleton.
 *
 * Pattern accuracy: these are approximations of typical release windows. Claw's
 * data fill (actual/result) drives display priority. If a date is off by 1-2
 * days from the actual release, Claw can either correct or insert the right
 * date and the next cron run's cleanup will reconcile.
 */

import { NextResponse } from 'next/server';
import sql from '@/lib/db';

const LOOKAHEAD_DAYS = 90;

// Hardcoded FOMC 2026 release dates (statement day, 2:00 PM ET)
const FOMC_DATES = [
  '2026-01-28', '2026-03-18', '2026-04-29',
  '2026-06-17', '2026-07-29', '2026-09-16',
  '2026-10-28', '2026-12-09',
];

// Date helpers — all return YYYY-MM-DD strings
function toISO(d) { return d.toISOString().split('T')[0]; }

function generateWeekly(dayOfWeek, fromDate, lookaheadDays) {
  const dates = [];
  const d = new Date(fromDate);
  d.setUTCHours(0, 0, 0, 0);
  while (d.getUTCDay() !== dayOfWeek) d.setUTCDate(d.getUTCDate() + 1);
  const end = new Date(fromDate);
  end.setUTCDate(end.getUTCDate() + lookaheadDays);
  while (d <= end) {
    dates.push(toISO(d));
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return dates;
}

function generateNthWeekdayOfMonth(nth, dayOfWeek, fromDate, lookaheadDays) {
  const dates = [];
  const start = new Date(fromDate);
  const end = new Date(fromDate);
  end.setUTCDate(end.getUTCDate() + lookaheadDays);
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cursor <= end) {
    const first = new Date(cursor);
    const offset = (dayOfWeek - first.getUTCDay() + 7) % 7;
    const target = new Date(first);
    target.setUTCDate(1 + offset + (nth - 1) * 7);
    if (target >= start && target <= end) dates.push(toISO(target));
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return dates;
}

function generateMonthlyOnDay(dayOfMonth, fromDate, lookaheadDays) {
  const dates = [];
  const start = new Date(fromDate);
  const end = new Date(fromDate);
  end.setUTCDate(end.getUTCDate() + lookaheadDays);
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), dayOfMonth));
  while (cursor <= end) {
    if (cursor >= start) dates.push(toISO(cursor));
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, dayOfMonth));
  }
  return dates;
}

// Quarterly: month 1, 4, 7, 10 — Nth weekday of that month
function generateQuarterlyNthWeekday(quarterMonths, nth, dayOfWeek, fromDate, lookaheadDays) {
  const all = generateNthWeekdayOfMonth(nth, dayOfWeek, fromDate, lookaheadDays);
  return all.filter(s => quarterMonths.includes(parseInt(s.slice(5, 7), 10)));
}

// Release definitions: name, time, big flag, and a function returning future dates
const RELEASE_PATTERNS = [
  // Weekly — every Thursday
  {
    name: 'Jobless Claims', time: '8:30 AM ET', big: true,
    generate: (today, lookahead) => generateWeekly(4, today, lookahead),
  },
  // First Friday of each month
  {
    name: 'Jobs Report', time: '8:30 AM ET', big: true,
    generate: (today, lookahead) => generateNthWeekdayOfMonth(1, 5, today, lookahead),
  },
  // ~2nd Wednesday — CPI
  {
    name: 'CPI Release', time: '8:30 AM ET', big: true,
    generate: (today, lookahead) => generateNthWeekdayOfMonth(2, 3, today, lookahead),
  },
  // ~2nd Thursday — PPI (day after CPI)
  {
    name: 'PPI Release', time: '8:30 AM ET', big: false,
    generate: (today, lookahead) => generateNthWeekdayOfMonth(2, 4, today, lookahead),
  },
  // ~3rd Tuesday — Retail Sales
  {
    name: 'Retail Sales', time: '8:30 AM ET', big: false,
    generate: (today, lookahead) => generateNthWeekdayOfMonth(3, 2, today, lookahead),
  },
  // ~3rd Wednesday — Housing Starts
  {
    name: 'Housing Starts', time: '8:30 AM ET', big: false,
    generate: (today, lookahead) => generateNthWeekdayOfMonth(3, 3, today, lookahead),
  },
  // ~4th Wednesday — Durable Goods
  {
    name: 'Durable Goods', time: '8:30 AM ET', big: false,
    generate: (today, lookahead) => generateNthWeekdayOfMonth(4, 3, today, lookahead),
  },
  // Last Friday — PCE / Personal Income (approximate; sometimes Thursday)
  {
    name: 'PCE / Personal Income', time: '8:30 AM ET', big: true,
    generate: (today, lookahead) => generateMonthlyOnDay(28, today, lookahead),
  },
  // GDP advance — 4th Thursday of Jan/Apr/Jul/Oct
  {
    name: 'GDP Release', time: '8:30 AM ET', big: true,
    generate: (today, lookahead) => generateQuarterlyNthWeekday([1, 4, 7, 10], 4, 4, today, lookahead),
  },
  // FOMC — hardcoded 2026 dates
  {
    name: 'FOMC Meeting', time: '2:00 PM ET', big: true,
    generate: (today, lookahead) => {
      const todayStr = toISO(today);
      const end = new Date(today);
      end.setUTCDate(end.getUTCDate() + lookahead);
      const endStr = toISO(end);
      return FOMC_DATES.filter(d => d >= todayStr && d <= endStr);
    },
  },
];

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

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayStr = toISO(today);

  const results = {};
  const errors = {};
  const datesByName = {};

  for (const release of RELEASE_PATTERNS) {
    try {
      const dates = release.generate(today, LOOKAHEAD_DAYS);
      let seeded = 0;

      for (const dateStr of dates) {
        await sql`
          INSERT INTO economic_calendar_events (date, name, time, big, source, updated_at)
          VALUES (${dateStr}::date, ${release.name}, ${release.time}, ${release.big}, 'pattern-seed', NOW())
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
  // freshly-generated pattern for that name. Skips rows where Claw has filled
  // in actual/result so published values are never clobbered.
  let cleaned = 0;
  for (const [name, dates] of Object.entries(datesByName)) {
    if (dates.length === 0) continue;
    const deleted = await sql`
      DELETE FROM economic_calendar_events
      WHERE source IN ('pattern-seed', 'fred-calendar')
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
  const totalSeeded = Object.values(results).reduce((s, r) => s + r.seeded, 0);
  console.log(`[cron/calendar-seed] ${todayStr}: seeded=${totalSeeded} cleaned=${cleaned} errors=${Object.keys(errors).length}`);

  return NextResponse.json({
    ok: !hasErrors,
    date: todayStr,
    lookahead: `${LOOKAHEAD_DAYS} days`,
    seeded: totalSeeded,
    cleaned,
    results,
    ...(hasErrors && { errors }),
  });
}
