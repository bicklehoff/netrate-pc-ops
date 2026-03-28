import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  getRecentMeetings,
  statementUrl,
  parseStatementHtml,
  diffStatements,
} from '@/lib/fomc-diff';

async function fetchAndCacheStatement(meetingDate) {
  // Check DB cache first
  const cached = await prisma.fomcStatement.findUnique({
    where: { meetingDate: new Date(meetingDate + 'T00:00:00Z') },
  });
  if (cached) return cached;

  // Scrape from Fed website
  const url = statementUrl(meetingDate);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'NetRate Mortgage Rate Watch (educational)' },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.error(`FOMC statement fetch failed: ${res.status} for ${url}`);
      return null;
    }

    const html = await res.text();
    const paragraphs = parseStatementHtml(html);

    if (paragraphs.length === 0) {
      console.error(`FOMC statement parse returned 0 paragraphs for ${url}`);
      return null;
    }

    // Cache in DB
    const statement = await prisma.fomcStatement.upsert({
      where: { meetingDate: new Date(meetingDate + 'T00:00:00Z') },
      create: {
        meetingDate: new Date(meetingDate + 'T00:00:00Z'),
        statementUrl: url,
        statementText: paragraphs.join('\n\n'),
        paragraphs: paragraphs,
      },
      update: {
        statementText: paragraphs.join('\n\n'),
        paragraphs: paragraphs,
      },
    });

    return statement;
  } catch (error) {
    clearTimeout(timeout);
    console.error(`FOMC statement fetch error for ${meetingDate}:`, error.message);
    return null;
  }
}

export async function GET() {
  try {
    const meetings = getRecentMeetings();
    if (!meetings) {
      return NextResponse.json(
        { error: 'Not enough past FOMC meetings in 2026 to compare' },
        { status: 404 }
      );
    }

    const [current, previous] = await Promise.all([
      fetchAndCacheStatement(meetings.current),
      fetchAndCacheStatement(meetings.previous),
    ]);

    if (!current || !previous) {
      return NextResponse.json(
        { error: 'Could not fetch one or both FOMC statements' },
        { status: 502 }
      );
    }

    const currentParagraphs = Array.isArray(current.paragraphs) ? current.paragraphs : [];
    const previousParagraphs = Array.isArray(previous.paragraphs) ? previous.paragraphs : [];

    const diff = diffStatements(previousParagraphs, currentParagraphs);

    const formatDate = (d) => new Date(d).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });

    return NextResponse.json({
      current: {
        date: meetings.current,
        dateFormatted: formatDate(meetings.current),
        url: current.statementUrl,
        paragraphs: currentParagraphs,
      },
      previous: {
        date: meetings.previous,
        dateFormatted: formatDate(meetings.previous),
        url: previous.statementUrl,
        paragraphs: previousParagraphs,
      },
      diff,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=86400, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('FOMC statements API error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
