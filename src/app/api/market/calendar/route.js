// Economic Calendar API — Claw posts events, website renders them
//
// GET  /api/market/calendar  → events in date range (public)
//   ?from=2026-03-25&to=2026-05-01  (default: 7 days back → 30 days forward)
//   ?upcoming=true                  (only future events)
//   ?limit=20
//
// POST /api/market/calendar  → bulk upsert events (auth required)
//   Body: { events: [{ date, time, name, forecast, actual, prior, impact, result, big }] }
//   Auth: x-api-key: CLAW_API_KEY
//
// Cache: 5-min CDN, 1-min browser

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import sql from '@/lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const upcoming = searchParams.get('upcoming') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

    const now = new Date();
    const defaultFrom = new Date(now);
    defaultFrom.setDate(defaultFrom.getDate() - 7);
    const defaultTo = new Date(now);
    defaultTo.setDate(defaultTo.getDate() + 30);

    const from = searchParams.get('from') ? new Date(searchParams.get('from')) : defaultFrom;
    const to = searchParams.get('to') ? new Date(searchParams.get('to')) : defaultTo;

    let events;
    if (upcoming) {
      const todayStr = now.toISOString().split('T')[0];
      events = await sql`
        SELECT id, date, time, name, forecast, actual, prior, impact, result, big
        FROM economic_calendar_events
        WHERE date >= ${todayStr}::date
        ORDER BY date ASC
        LIMIT ${limit}
      `;
    } else {
      events = await sql`
        SELECT id, date, time, name, forecast, actual, prior, impact, result, big
        FROM economic_calendar_events
        WHERE date >= ${from} AND date <= ${to}
        ORDER BY date ASC
        LIMIT ${limit}
      `;
    }

    const formatted = events.map(ev => ({
      id: ev.id,
      date: ev.date instanceof Date ? ev.date.toISOString().split('T')[0] : String(ev.date).split('T')[0],
      time: ev.time,
      name: ev.name,
      forecast: ev.forecast,
      actual: ev.actual,
      prior: ev.prior,
      impact: ev.impact,
      result: ev.result,
      big: ev.big,
    }));

    const response = NextResponse.json({ events: formatted, count: formatted.length });
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=300, max-age=60, stale-while-revalidate=120'
    );
    return response;
  } catch (error) {
    console.error('Calendar GET error:', error);
    // Graceful degradation: return empty instead of 500 so page renders
    return NextResponse.json({ events: [], count: 0, source: 'error' });
  }
}

export async function POST(request) {
  try {
    const apiKey = request.headers.get('x-api-key')
      || request.headers.get('authorization')?.replace('Bearer ', '');

    if (!apiKey || apiKey !== process.env.CLAW_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { events } = body;

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: 'events array required' }, { status: 400 });
    }

    if (events.length > 100) {
      return NextResponse.json({ error: 'Max 100 events per request' }, { status: 400 });
    }

    const results = [];
    for (const ev of events) {
      if (!ev.date || !ev.name) {
        results.push({ name: ev.name, error: 'date and name required' });
        continue;
      }

      const rows = await sql`
        INSERT INTO economic_calendar_events (date, time, name, forecast, actual, prior, impact, result, big, source, updated_at)
        VALUES (${new Date(ev.date)}, ${ev.time ?? null}, ${ev.name}, ${ev.forecast ?? null}, ${ev.actual ?? null}, ${ev.prior ?? null}, ${ev.impact ?? null}, ${ev.result ?? null}, ${ev.big ?? false}, ${ev.source ?? 'claw'}, NOW())
        ON CONFLICT (date, name) DO UPDATE SET
          time = COALESCE(EXCLUDED.time, economic_calendar_events.time),
          forecast = COALESCE(EXCLUDED.forecast, economic_calendar_events.forecast),
          actual = COALESCE(EXCLUDED.actual, economic_calendar_events.actual),
          prior = COALESCE(EXCLUDED.prior, economic_calendar_events.prior),
          impact = COALESCE(EXCLUDED.impact, economic_calendar_events.impact),
          result = COALESCE(EXCLUDED.result, economic_calendar_events.result),
          big = COALESCE(EXCLUDED.big, economic_calendar_events.big),
          source = COALESCE(EXCLUDED.source, economic_calendar_events.source),
          updated_at = NOW()
        RETURNING id, name, date
      `;

      results.push({ id: rows[0].id, name: rows[0].name, date: rows[0].date });
    }

    // Bust ISR cache so Rate Watch shows new events immediately
    revalidatePath('/rate-watch');

    return NextResponse.json({ ok: true, upserted: results.length, results });
  } catch (error) {
    console.error('Calendar POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
