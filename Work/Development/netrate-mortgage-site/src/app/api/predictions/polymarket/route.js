// Polymarket Prediction Markets — Fetches financial/economic prediction probabilities
//
// GET /api/predictions/polymarket
// No API key required — public endpoint
// Cache: 1-hour CDN, 5-min browser

import { NextResponse } from 'next/server';

const POLYMARKET_BASE = 'https://gamma-api.polymarket.com';

// Keywords to filter for mortgage/economy-relevant markets
const RELEVANT_TERMS = [
  'fed', 'federal reserve', 'fomc', 'interest rate', 'rate cut', 'rate hike',
  'recession', 'gdp', 'unemployment', 'inflation', 'cpi',
  'housing', 'mortgage', 'treasury', 'bond',
];

function isRelevant(question) {
  const q = question.toLowerCase();
  return RELEVANT_TERMS.some(term => q.includes(term));
}

async function fetchMarkets() {
  try {
    const res = await fetch(`${POLYMARKET_BASE}/markets?limit=100&active=true&closed=false`, {
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      console.error('Polymarket API error:', res.status);
      return null;
    }

    const data = await res.json();
    const markets = Array.isArray(data) ? data : data.data || [];

    return markets
      .filter(m => m.active && !m.closed && isRelevant(m.question || ''))
      .slice(0, 12)
      .map(m => ({
        id: m.id || m.condition_id,
        question: m.question,
        outcomes: m.outcomes || ['Yes', 'No'],
        outcomePrices: parseOutcomePrices(m),
        volume: parseFloat(m.volume || m.volumeNum || 0),
        liquidity: parseFloat(m.liquidity || m.liquidityNum || 0),
        endDate: m.end_date_iso || m.endDate || m.expiresAt || null,
        slug: m.slug || null,
      }));
  } catch (error) {
    console.error('Polymarket fetch error:', error.message);
    return null;
  }
}

function parseOutcomePrices(market) {
  // Polymarket returns prices in various formats depending on the endpoint
  if (market.outcomePrices) {
    try {
      const prices = typeof market.outcomePrices === 'string'
        ? JSON.parse(market.outcomePrices)
        : market.outcomePrices;
      return prices.map(p => parseFloat(p));
    } catch { /* fall through */ }
  }
  if (market.price) {
    const p = Array.isArray(market.price) ? market.price : [market.price, 1 - market.price];
    return p.map(v => parseFloat(v));
  }
  return [0.5, 0.5];
}

export async function GET() {
  try {
    const markets = await fetchMarkets();

    const response = NextResponse.json({
      markets: markets || [],
      source: markets ? 'polymarket' : 'error',
      timestamp: new Date().toISOString(),
    });

    response.headers.set(
      'Cache-Control',
      'public, s-maxage=3600, max-age=300, stale-while-revalidate=600'
    );

    return response;
  } catch (error) {
    console.error('Polymarket API route error:', error);
    return NextResponse.json(
      { markets: [], source: 'error', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
