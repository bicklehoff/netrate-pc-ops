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
import prisma from '@/lib/prisma';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const skip = (page - 1) * limit;

    const [commentaries, total] = await Promise.all([
      prisma.rateWatchCommentary.findMany({
        orderBy: { date: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          date: true,
          headline: true,
          commentary: true,
          sentiment: true,
          treasury10yr: true,
          treasury10yrChg: true,
          mbs6Coupon: true,
          mbs6Change: true,
          author: true,
          publishedAt: true,
        },
      }),
      prisma.rateWatchCommentary.count(),
    ]);

    const items = commentaries.map((c) => ({
      id: c.id,
      date: c.date instanceof Date
        ? c.date.toISOString().split('T')[0]
        : String(c.date).split('T')[0],
      headline: c.headline,
      commentary: c.commentary,
      sentiment: c.sentiment,
      treasury10yr: c.treasury10yr,
      treasury10yrChg: c.treasury10yrChg,
      mbs6Coupon: c.mbs6Coupon,
      mbs6Change: c.mbs6Change,
      author: c.author,
      publishedAt: c.publishedAt,
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
