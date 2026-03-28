// Polymarket Prediction Markets — Fed meeting + economy predictions
//
// GET /api/predictions/polymarket
// No API key required — public endpoint
// Cache: 1-hour CDN, 5-min browser
//
// Uses the /events endpoint (not /markets) — events contain nested markets
// with outcome probabilities for multi-outcome questions like Fed decisions.

import { NextResponse } from 'next/server';

const POLYMARKET_BASE = 'https://gamma-api.polymarket.com';

// Event slugs we care about — Fed decisions by meeting date
const FED_SLUGS = [
  'fed-decision-in-april',
  'fed-decision-in-june',
  'fed-decision-in-july',
  'fed-decision-in-september',
  'fed-decision-in-october',
  'fed-decision-in-november',
  'fed-decision-in-december',
];

// Keywords to match broader economic events
const RELEVANT_TERMS = [
  'fed', 'federal reserve', 'fomc', 'interest rate', 'rate cut', 'rate hike',
  'recession', 'gdp', 'unemployment', 'inflation', 'cpi',
  'housing', 'mortgage', 'treasury', 'bond', 'tariff',
];

function isRelevant(title) {
  const t = (title || '').toLowerCase();
  return RELEVANT_TERMS.some(term => t.includes(term));
}

// Parse a Fed decision event into a structured object
function parseFedEvent(event) {
  const markets = event.markets || [];
  // Extract outcomes: no change, increase, decrease variants
  const outcomes = [];
  for (const m of markets) {
    const q = (m.question || '').toLowerCase();
    let rawPrices = m.outcomePrices || '["0.5","0.5"]';
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    if (typeof rawPrices === 'string') { try { rawPrices = JSON.parse(rawPrices); } catch (e) { rawPrices = ['0.5', '0.5']; } }
    const yesPrice = parseFloat(rawPrices?.[0] || '0');

    if (q.includes('no change')) {
      outcomes.push({ label: 'Hold', probability: yesPrice, type: 'hold' });
    } else if (q.includes('increase') || q.includes('hike')) {
      const label = q.includes('50+') ? '50+ bps Hike' : '25 bps Hike';
      outcomes.push({ label, probability: yesPrice, type: 'hike' });
    } else if (q.includes('decrease') || q.includes('cut')) {
      const label = q.includes('50+') ? '50+ bps Cut' : '25 bps Cut';
      outcomes.push({ label, probability: yesPrice, type: 'cut' });
    }
  }

  // Sort: hold first, then cuts, then hikes
  const order = { hold: 0, cut: 1, hike: 2 };
  outcomes.sort((a, b) => (order[a.type] ?? 3) - (order[b.type] ?? 3));

  return {
    id: event.id,
    title: event.title,
    slug: event.slug,
    endDate: event.endDate || event.end_date_iso || null,
    outcomes,
    volume: parseFloat(event.volume || 0),
    liquidity: parseFloat(event.liquidity || 0),
  };
}

async function fetchEvents() {
  try {
    // Fetch with AbortController timeout — response can be 8MB+
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(
      `${POLYMARKET_BASE}/events?active=true&closed=false&limit=50&order=volume&ascending=false`,
      { cache: 'no-store', signal: controller.signal }
    );
    clearTimeout(timeout);

    if (!res.ok) {
      console.error('Polymarket events API error:', res.status);
      return null;
    }

    const text = await res.text();
    const data = JSON.parse(text);
    const events = Array.isArray(data) ? data : data.data || [];

    // Separate Fed decision events from other relevant events
    const fedEvents = [];
    const otherEvents = [];

    for (const event of events) {
      const slug = event.slug || '';
      const title = event.title || '';

      if (FED_SLUGS.some(s => slug.includes(s)) || /fed.?decision/i.test(title)) {
        fedEvents.push(parseFedEvent(event));
      } else if (isRelevant(title)) {
        // General economic events — return as simple markets
        const markets = (event.markets || []).slice(0, 3).map(m => {
          let prices = m.outcomePrices || ['0.5', '0.5'];
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          if (typeof prices === 'string') { try { prices = JSON.parse(prices); } catch (e) { prices = ['0.5', '0.5']; } }
          return {
            id: m.id || m.condition_id,
            question: m.question,
            outcomes: typeof m.outcomes === 'string' ? JSON.parse(m.outcomes) : (m.outcomes || ['Yes', 'No']),
            outcomePrices: prices.map(p => parseFloat(p)),
            volume: parseFloat(m.volume || 0),
            endDate: m.end_date_iso || m.endDate || null,
            slug: event.slug,
          };
        });
        otherEvents.push(...markets);
      }
    }

    // Sort Fed events by date (next meeting first)
    fedEvents.sort((a, b) => {
      if (!a.endDate) return 1;
      if (!b.endDate) return -1;
      return new Date(a.endDate) - new Date(b.endDate);
    });

    return { fedEvents, otherMarkets: otherEvents.slice(0, 6) };
  } catch (error) {
    console.error('Polymarket fetch error:', error.message, error.stack?.split('\n').slice(0,3).join(' '));
    return null;
  }
}

export async function GET() {
  try {
    const result = await fetchEvents();

    const response = NextResponse.json({
      fedEvents: result?.fedEvents || [],
      markets: result?.otherMarkets || [],
      source: result ? 'polymarket' : 'error',
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
      { fedEvents: [], markets: [], source: 'error', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
