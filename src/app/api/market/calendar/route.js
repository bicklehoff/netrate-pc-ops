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
import prisma from '@/lib/prisma';

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

    const where = {
      date: upcoming
        ? { gte: new Date(now.toISOString().split('T')[0]) }
        : { gte: from, lte: to },
    };

    const events = await prisma.economicCalendarEvent.findMany({
      where,
      orderBy: { date: 'asc' },
      take: limit,
    });

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
    return NextResponse.json({ error: error.message }, { status: 500 });
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

      const record = await prisma.economicCalendarEvent.upsert({
        where: {
          date_name: {
            date: new Date(ev.date),
            name: ev.name,
          },
        },
        create: {
          date: new Date(ev.date),
          time: ev.time ?? null,
          name: ev.name,
          forecast: ev.forecast ?? null,
          actual: ev.actual ?? null,
          prior: ev.prior ?? null,
          impact: ev.impact ?? null,
          result: ev.result ?? null,
          big: ev.big ?? false,
          source: ev.source ?? 'claw',
        },
        update: {
          time: ev.time ?? undefined,
          forecast: ev.forecast ?? undefined,
          actual: ev.actual ?? undefined,
          prior: ev.prior ?? undefined,
          impact: ev.impact ?? undefined,
          result: ev.result ?? undefined,
          big: ev.big ?? undefined,
          source: ev.source ?? undefined,
        },
      });

      results.push({ id: record.id, name: record.name, date: record.date });
    }

    // Bust ISR cache so Rate Watch shows new events immediately
    revalidatePath('/rate-watch');

    return NextResponse.json({ ok: true, upserted: results.length, results });
  } catch (error) {
    console.error('Calendar POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
