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
import { neon } from '@neondatabase/serverless';
import prisma from '@/lib/prisma';
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
    treasury10yr: record.treasury10yr != null ? Number(record.treasury10yr) : null,
    treasury10yrChg: record.treasury10yrChg != null ? Number(record.treasury10yrChg) : null,
    mbs6Coupon: record.mbs6Coupon ?? record.mbs_6_coupon ?? null,
    mbs6Change: record.mbs6Change != null ? Number(record.mbs6Change) : (record.mbs_6_change != null ? Number(record.mbs_6_change) : null),
    author: record.author,
    source: record.source,
    publishedAt: record.publishedAt ?? record.published_at ?? null,
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
    treasury10yr: legacy.treasury10yr != null ? Number(legacy.treasury10yr) : (legacy.treasury_10yr != null ? Number(legacy.treasury_10yr) : null),
    treasury10yrChg: legacy.treasury10yrChg != null ? Number(legacy.treasury10yrChg) : (legacy.treasury_10yr_chg != null ? Number(legacy.treasury_10yr_chg) : null),
    mbs6Coupon: legacy.mbs6Coupon ?? legacy.mbs_6_coupon ?? null,
    mbs6Change: legacy.mbs6Change != null ? Number(legacy.mbs6Change) : (legacy.mbs_6_change != null ? Number(legacy.mbs_6_change) : null),
    upcomingEvents: legacy.upcomingEvents ?? legacy.upcoming_events ?? null,
    createdBy: legacy.createdBy ?? legacy.created_by ?? null,
    updatedAt: legacy.updatedAt ?? legacy.updated_at ?? null,
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
    let record;
    if (dateParam) {
      record = await prisma.rateWatchCommentary.findUnique({
        where: { date: new Date(dateParam) },
      });
    }
    // If no record for specific date, or no date requested → get most recent
    if (!record) {
      record = await prisma.rateWatchCommentary.findFirst({
        orderBy: { date: 'desc' },
      });
    }

    if (record) {
      const stale = dateParam && record.date.toISOString().split('T')[0] !== dateParam;
      return cached200({ summary: formatCommentary(record), source: stale ? 'db_fallback' : 'db' });
    }

    // Fallback to legacy MarketSummary
    let legacy;
    if (dateParam) {
      legacy = await prisma.marketSummary.findUnique({
        where: { date: new Date(dateParam) },
      });
    }
    if (!legacy) {
      legacy = await prisma.marketSummary.findFirst({
        orderBy: { date: 'desc' },
      });
    }

    if (legacy) {
      return cached200({ summary: formatLegacy(legacy), source: 'legacy_db' });
    }

    return NextResponse.json({ summary: null, source: 'none' });
  } catch (error) {
    console.error('Market summary GET error:', error);
    // Graceful degradation: try raw SQL via neon to bypass Prisma issues
    try {
      const sql = neon(process.env.PC_DATABASE_URL || process.env.DATABASE_URL);
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

    // Upsert into RateWatchCommentary
    const record = await prisma.rateWatchCommentary.upsert({
      where: { date: new Date(date) },
      create: {
        date: new Date(date),
        headline,
        commentary,
        sentiment: sentiment || 'neutral',
        treasury10yr: treasury10yr ?? null,
        treasury10yrChg: treasury10yrChg ?? null,
        mbs6Coupon: mbs6Coupon ?? null,
        mbs6Change: mbs6Change ?? null,
        author: author || 'David Burson',
        source: inputSource || 'manual',
        publishedAt: new Date(),
      },
      update: {
        headline,
        commentary,
        sentiment: sentiment || 'neutral',
        treasury10yr: treasury10yr ?? null,
        treasury10yrChg: treasury10yrChg ?? null,
        mbs6Coupon: mbs6Coupon ?? null,
        mbs6Change: mbs6Change ?? null,
        author: author || 'David Burson',
        source: inputSource || 'manual',
        publishedAt: new Date(),
      },
    });

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
