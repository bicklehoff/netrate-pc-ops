// Market Commentary Archive API — Paginated list of past commentaries
//
// GET /api/market/commentary?page=1&limit=10
//   Returns paginated list of past Rate Watch commentaries for archive display.
//   Sorted by date descending (most recent first).
//
// Query params:
//   page   — page number (default: 1)
//   limit  — items per page (default: 10, max: 50)

import { NextResponse } from 'next/server';
import sql from '@/lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const offset = (page - 1) * limit;

    const [commentaries, countRows] = await Promise.all([
      sql`
        SELECT id, date, headline, commentary, sentiment, treasury_10yr, treasury_10yr_chg,
               mbs_6_coupon, mbs_6_change, author, published_at
        FROM rate_watch_commentaries
        ORDER BY date DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      sql`SELECT COUNT(*)::int AS total FROM rate_watch_commentaries`,
    ]);

    const total = countRows[0].total;

    const items = commentaries.map((c) => ({
      id: c.id,
      date: c.date instanceof Date
        ? c.date.toISOString().split('T')[0]
        : String(c.date).split('T')[0],
      headline: c.headline,
      commentary: c.commentary,
      sentiment: c.sentiment,
      treasury_10yr: c.treasury_10yr,
      treasury_10yr_chg: c.treasury_10yr_chg,
      mbs_6_coupon: c.mbs_6_coupon,
      mbs_6_change: c.mbs_6_change,
      author: c.author,
      published_at: c.published_at,
    }));

    const response = NextResponse.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });

    response.headers.set(
      'Cache-Control',
      'public, s-maxage=300, max-age=60, stale-while-revalidate=120'
    );
    return response;
  } catch (error) {
    console.error('Commentary archive GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch commentaries', detail: error.message },
      { status: 500 }
    );
  }
}
