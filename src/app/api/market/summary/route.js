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
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

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
    } else {
      record = await prisma.rateWatchCommentary.findFirst({
        orderBy: { date: 'desc' },
      });
    }

    // Fallback to legacy MarketSummary if no commentary found
    if (!record) {
      let legacy;
      if (dateParam) {
        legacy = await prisma.marketSummary.findUnique({
          where: { date: new Date(dateParam) },
        });
      } else {
        legacy = await prisma.marketSummary.findFirst({
          orderBy: { date: 'desc' },
        });
      }

      if (!legacy) {
        return NextResponse.json({ summary: null, source: 'none' });
      }

      const summary = {
        date: legacy.date instanceof Date
          ? legacy.date.toISOString().split('T')[0]
          : String(legacy.date).split('T')[0],
        headline: legacy.headline,
        commentary: legacy.commentary,
        sentiment: legacy.sentiment,
        treasury10yr: legacy.treasury10yr ? Number(legacy.treasury10yr) : null,
        treasury10yrChg: legacy.treasury10yrChg ? Number(legacy.treasury10yrChg) : null,
        mbs6Coupon: legacy.mbs6Coupon,
        mbs6Change: legacy.mbs6Change ? Number(legacy.mbs6Change) : null,
        upcomingEvents: legacy.upcomingEvents || null,
        createdBy: legacy.createdBy,
        updatedAt: legacy.updatedAt,
      };

      const response = NextResponse.json({ summary, source: 'legacy_db' });
      response.headers.set(
        'Cache-Control',
        'public, s-maxage=300, max-age=60, stale-while-revalidate=120'
      );
      return response;
    }

    // Format RateWatchCommentary response
    const summary = {
      date: record.date instanceof Date
        ? record.date.toISOString().split('T')[0]
        : String(record.date).split('T')[0],
      headline: record.headline,
      commentary: record.commentary,
      sentiment: record.sentiment,
      treasury10yr: record.treasury10yr,
      treasury10yrChg: record.treasury10yrChg,
      mbs6Coupon: record.mbs6Coupon,
      mbs6Change: record.mbs6Change,
      author: record.author,
      publishedAt: record.publishedAt,
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
