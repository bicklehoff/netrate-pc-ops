// Market Summary API — Daily morning market updates for /rate-watch
//
// GET  /api/market/summary          → latest summary (or ?date=2026-03-20)
// POST /api/market/summary          → create/update summary (agent use)
//   Body: { date, headline, commentary, sentiment, treasury10yr, treasury10yrChg,
//           mbs6Coupon, mbs6Change, upcomingEvents, createdBy }
//
// POST requires CLAW_API_KEY header for authentication.
// Cache: 5-min CDN, 1-min browser (summaries update once per morning)

import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

function getSql() {
  return neon(process.env.DATABASE_URL);
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    const sql = getSql();

    let rows;
    if (dateParam) {
      rows = await sql`
        SELECT * FROM market_summaries
        WHERE date = ${dateParam}::date
        LIMIT 1
      `;
    } else {
      rows = await sql`
        SELECT * FROM market_summaries
        ORDER BY date DESC
        LIMIT 1
      `;
    }

    if (!rows.length) {
      return NextResponse.json({ summary: null, source: 'none' });
    }

    const row = rows[0];
    const summary = {
      date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date).split('T')[0],
      headline: row.headline,
      commentary: row.commentary,
      sentiment: row.sentiment,
      treasury10yr: row.treasury_10yr ? parseFloat(row.treasury_10yr) : null,
      treasury10yrChg: row.treasury_10yr_chg ? parseFloat(row.treasury_10yr_chg) : null,
      mbs6Coupon: row.mbs_6_coupon,
      mbs6Change: row.mbs_6_change ? parseFloat(row.mbs_6_change) : null,
      upcomingEvents: row.upcoming_events || null,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
    };

    const response = NextResponse.json({ summary, source: 'db' });
    response.headers.set(
      'Cache-Control',
      'public, s-maxage=300, max-age=60, stale-while-revalidate=120'
    );
    return response;
  } catch (error) {
    console.error('Market summary GET error:', error);
    return NextResponse.json(
      { summary: null, source: 'error', error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    // Authenticate — require CLAW_API_KEY
    const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '');
    if (!apiKey || apiKey !== process.env.CLAW_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      date, headline, commentary, sentiment,
      treasury10yr, treasury10yrChg, mbs6Coupon, mbs6Change,
      upcomingEvents, createdBy,
    } = body;

    if (!date || !headline || !commentary) {
      return NextResponse.json(
        { error: 'Missing required fields: date, headline, commentary' },
        { status: 400 }
      );
    }

    const sql = getSql();

    // Upsert — if a summary for this date already exists, update it
    const rows = await sql`
      INSERT INTO market_summaries (
        date, headline, commentary, sentiment,
        treasury_10yr, treasury_10yr_chg, mbs_6_coupon, mbs_6_change,
        upcoming_events, created_by, created_at, updated_at
      ) VALUES (
        ${date}::date,
        ${headline},
        ${commentary},
        ${sentiment || 'neutral'},
        ${treasury10yr || null},
        ${treasury10yrChg || null},
        ${mbs6Coupon || null},
        ${mbs6Change || null},
        ${upcomingEvents ? JSON.stringify(upcomingEvents) : null}::jsonb,
        ${createdBy || 'claw'},
        NOW(), NOW()
      )
      ON CONFLICT (date) DO UPDATE SET
        headline = EXCLUDED.headline,
        commentary = EXCLUDED.commentary,
        sentiment = EXCLUDED.sentiment,
        treasury_10yr = EXCLUDED.treasury_10yr,
        treasury_10yr_chg = EXCLUDED.treasury_10yr_chg,
        mbs_6_coupon = EXCLUDED.mbs_6_coupon,
        mbs_6_change = EXCLUDED.mbs_6_change,
        upcoming_events = EXCLUDED.upcoming_events,
        created_by = EXCLUDED.created_by,
        updated_at = NOW()
      RETURNING id, date
    `;

    return NextResponse.json({
      ok: true,
      id: rows[0]?.id,
      date: rows[0]?.date,
    });
  } catch (error) {
    console.error('Market summary POST error:', error);
    return NextResponse.json(
      { error: 'Failed to save market summary', detail: error.message },
      { status: 500 }
    );
  }
}
