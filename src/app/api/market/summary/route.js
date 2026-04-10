// Market Summary API — Daily morning market updates for /rate-watch
//
// GET  /api/market/summary          → latest commentary (or ?date=2026-03-20)
// POST /api/market/summary          → create/update commentary (auth required)
//   Body: { date, headline, commentary, sentiment, treasury10yr, treasury10yrChg,
//           mbs6Coupon, mbs6Change, author, source }
//
// Auth: CLAW_API_KEY header or NextAuth session with MLO role.
// Cache: 5-min CDN, 1-min browser (summaries update once per morning)
//
// Reads from rate_watch_commentaries (primary), falls back to market_summaries (legacy).

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import sql from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

function formatCommentary(record) {
  return {
    date: record.date instanceof Date
      ? record.date.toISOString().split('T')[0]
      : String(record.date).split('T')[0],
    headline: record.headline,
    commentary: record.commentary,
    sentiment: record.sentiment,
    treasury_10yr: record.treasury_10yr != null ? Number(record.treasury_10yr) : null,
    treasury_10yr_chg: record.treasury_10yr_chg != null ? Number(record.treasury_10yr_chg) : null,
    mbs_6_coupon: record.mbs_6_coupon ?? null,
    mbs_6_change: record.mbs_6_change != null ? Number(record.mbs_6_change) : null,
    author: record.author,
    source: record.source,
    published_at: record.published_at ?? null,
  };
}

function formatLegacy(legacy) {
  return {
    date: legacy.date instanceof Date
      ? legacy.date.toISOString().split('T')[0]
      : String(legacy.date).split('T')[0],
    headline: legacy.headline,
    commentary: legacy.commentary,
    sentiment: legacy.sentiment,
    treasury_10yr: legacy.treasury_10yr != null ? Number(legacy.treasury_10yr) : null,
    treasury_10yr_chg: legacy.treasury_10yr_chg != null ? Number(legacy.treasury_10yr_chg) : null,
    mbs_6_coupon: legacy.mbs_6_coupon ?? null,
    mbs_6_change: legacy.mbs_6_change != null ? Number(legacy.mbs_6_change) : null,
    upcoming_events: legacy.upcoming_events ?? null,
    created_by: legacy.created_by ?? null,
    updated_at: legacy.updated_at ?? null,
  };
}

function cached200(data) {
  const response = NextResponse.json(data);
  response.headers.set(
    'Cache-Control',
    'public, s-maxage=300, max-age=60, stale-while-revalidate=120'
  );
  return response;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');

    // Try RateWatchCommentary first
    let rows;
    if (dateParam) {
      rows = await sql`SELECT * FROM rate_watch_commentaries WHERE date = ${new Date(dateParam)} LIMIT 1`;
    }
    // If no record for specific date, or no date requested → get most recent
    if (!rows?.length) {
      rows = await sql`SELECT * FROM rate_watch_commentaries ORDER BY date DESC LIMIT 1`;
    }

    if (rows.length) {
      const record = rows[0];
      const stale = dateParam && record.date.toISOString().split('T')[0] !== dateParam;
      return cached200({ summary: formatCommentary(record), source: stale ? 'db_fallback' : 'db' });
    }

    // Fallback to legacy MarketSummary
    let legacyRows;
    if (dateParam) {
      legacyRows = await sql`SELECT * FROM market_summaries WHERE date = ${new Date(dateParam)} LIMIT 1`;
    }
    if (!legacyRows?.length) {
      legacyRows = await sql`SELECT * FROM market_summaries ORDER BY date DESC LIMIT 1`;
    }

    if (legacyRows?.length) {
      return cached200({ summary: formatLegacy(legacyRows[0]), source: 'legacy_db' });
    }

    return NextResponse.json({ summary: null, source: 'none' });
  } catch (error) {
    console.error('Market summary GET error:', error);
    // Graceful degradation: try one more time
    try {
      const rows = await sql`SELECT * FROM rate_watch_commentaries ORDER BY date DESC LIMIT 1`;
      if (rows.length) {
        return cached200({ summary: formatCommentary(rows[0]), source: 'fallback' });
      }
    } catch (fallbackError) {
      console.error('Summary fallback also failed:', fallbackError);
    }
    return NextResponse.json({ summary: null, source: 'error' });
  }
}

export async function POST(request) {
  try {
    // Auth: CLAW_API_KEY header OR NextAuth MLO session
    const apiKey = request.headers.get('x-api-key')
      || request.headers.get('authorization')?.replace('Bearer ', '');
    const hasApiKey = apiKey && apiKey === process.env.CLAW_API_KEY;

    let hasMloSession = false;
    if (!hasApiKey) {
      const session = await getServerSession(authOptions);
      hasMloSession = session?.user?.role === 'mlo';
    }

    if (!hasApiKey && !hasMloSession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      date, headline, commentary, sentiment,
      treasury10yr, treasury10yrChg, mbs6Coupon, mbs6Change,
      author, source: inputSource,
    } = body;

    if (!date || !headline || !commentary) {
      return NextResponse.json(
        { error: 'Missing required fields: date, headline, commentary' },
        { status: 400 }
      );
    }

    // Upsert into rate_watch_commentaries
    const rows = await sql`
      INSERT INTO rate_watch_commentaries (date, headline, commentary, sentiment, treasury_10yr, treasury_10yr_chg, mbs_6_coupon, mbs_6_change, author, source, published_at)
      VALUES (${new Date(date)}, ${headline}, ${commentary}, ${sentiment || 'neutral'}, ${treasury10yr ?? null}, ${treasury10yrChg ?? null}, ${mbs6Coupon ?? null}, ${mbs6Change ?? null}, ${author || 'David Burson'}, ${inputSource || 'manual'}, ${new Date()})
      ON CONFLICT (date) DO UPDATE SET
        headline = EXCLUDED.headline,
        commentary = EXCLUDED.commentary,
        sentiment = EXCLUDED.sentiment,
        treasury_10yr = EXCLUDED.treasury_10yr,
        treasury_10yr_chg = EXCLUDED.treasury_10yr_chg,
        mbs_6_coupon = EXCLUDED.mbs_6_coupon,
        mbs_6_change = EXCLUDED.mbs_6_change,
        author = EXCLUDED.author,
        source = EXCLUDED.source,
        published_at = EXCLUDED.published_at
      RETURNING *
    `;

    const record = rows[0];

    // Bust ISR cache so pages show new commentary immediately
    revalidatePath('/rate-watch');
    revalidatePath('/');

    return NextResponse.json({
      ok: true,
      id: record.id,
      date: record.date,
    });
  } catch (error) {
    console.error('Market summary POST error:', error);
    return NextResponse.json(
      { error: 'Failed to save commentary', detail: error.message },
      { status: 500 }
    );
  }
}
