// Rate Data API — Fetches live rate data from Google Cloud Storage
// Uses service account auth (private bucket). Falls back to static data if GCS unavailable.
//
// GET /api/rates → { lenders: [...], manifest: {...}, source: 'gcs'|'static' }
//
// Caching: 2-minute in-memory cache (serverless function warm instances)
// + Cache-Control header for CDN/browser caching (60s CDN, 30s browser).

import { NextResponse } from 'next/server';
import { fetchGCSFile, isGCSConfigured } from '@/lib/gcs';

// Static fallback data (bundled at build time)
import staticAmwest from '@/data/rates/amwest.json';
import staticManifest from '@/data/rates/manifest.json';

const GCS_BUCKET = process.env.GCS_BUCKET_NAME || 'netrate-rates';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes — rates change once/day

// Module-level cache (persists across warm invocations on Vercel)
let cache = { data: null, fetchedAt: 0 };

async function fetchFromGCS() {
  const manifest = await fetchGCSFile(GCS_BUCKET, 'live/manifest.json');

  const lenders = await Promise.all(
    manifest.lenders.map((entry) =>
      fetchGCSFile(GCS_BUCKET, `live/${entry.file}`)
    )
  );

  // Strip lender names from manifest too
  const cleanManifest = {
    ...manifest,
    lenders: manifest.lenders.map((entry) => omit(entry, 'name')),
  };

  return { lenders: lenders.map(sanitizeLender), manifest: cleanManifest, source: 'gcs' };
}

// Remove a key from an object (used to strip proprietary lender names)
function omit(obj, key) {
  return Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));
}

// Strip proprietary lender names from consumer-facing API response
function sanitizeLender(data) {
  if (data?.lender) {
    return { ...data, lender: omit(data.lender, 'name') };
  }
  return data;
}

function getStaticFallback() {
  return {
    lenders: [sanitizeLender(staticAmwest)],
    manifest: staticManifest,
    source: 'static',
  };
}

async function getRateData() {
  const now = Date.now();

  // Return cached data if fresh
  if (cache.data && (now - cache.fetchedAt) < CACHE_TTL_MS) {
    return cache.data;
  }

  // If GCS isn't configured, use static data
  if (!isGCSConfigured()) {
    return getStaticFallback();
  }

  try {
    const data = await fetchFromGCS();
    cache = { data, fetchedAt: now };
    return data;
  } catch (err) {
    console.error('GCS fetch failed, using static fallback:', err.message);

    // If we have stale cache, prefer it over static (it was from GCS at some point)
    if (cache.data) {
      return { ...cache.data, source: 'gcs-stale' };
    }

    return getStaticFallback();
  }
}

export async function GET() {
  try {
    const data = await getRateData();

    return NextResponse.json(data, {
      headers: {
        // CDN: 60s fresh, browser: 30s fresh, stale-while-revalidate: 60s
        // Total worst-case staleness: ~3 minutes (2m function cache + 60s CDN)
        'Cache-Control': 'public, s-maxage=60, max-age=30, stale-while-revalidate=60',
      },
    });
  } catch (err) {
    console.error('Rate API error:', err);
    return NextResponse.json(
      { error: 'Failed to load rate data' },
      { status: 500 }
    );
  }
}
