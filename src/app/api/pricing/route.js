/**
 * Pricing Engine API
 *
 * POST /api/pricing — Price a borrower scenario against all lender rate sheets.
 *
 * Request body:
 * {
 *   loanAmount: 400000,          // required
 *   loanPurpose: "purchase",     // "purchase" | "refinance" | "cashout" (default: "purchase")
 *   loanType: "conventional",    // null (all) | "conventional" | "fha" | "va" | "usda" | "dscr" | "bankstatement"
 *   category: null,              // null (all) | "agency" | "nonqm" | "other"
 *   state: "CO",                 // optional — enables county limits + closing cost estimate
 *   county: "Boulder",           // optional — enables precise loan limit classification
 *   creditScore: 740,            // optional (default: 740)
 *   propertyValue: 500000,       // optional — if provided, LTV is calculated
 *   term: 30,                    // optional (default: 30)
 *   lockDays: 30,                // optional (default: 30)
 *   productType: "fixed",        // optional — "fixed" | "arm"
 *   includeBuydowns: false,      // optional
 *   includeIO: false,            // optional
 * }
 *
 * Response: see priceScenario() return shape in pricing.js
 *
 * Caching: 2-minute in-memory cache keyed by scenario hash.
 */

import { NextResponse } from 'next/server';
import { priceScenario } from '@/lib/rates/pricing';
import { fetchGCSFile, isGCSConfigured } from '@/lib/gcs';

const GCS_BUCKET = process.env.GCS_BUCKET_NAME || 'netrate-rates';
const CACHE_TTL_MS = 2 * 60 * 1000;

// Module-level cache for parsed rate data
let rateCache = { data: null, fetchedAt: 0 };

/**
 * Load parsed rate data from GCS (or static fallback).
 * Returns array of { lenderId, programs, sheetDate }
 */
async function loadRateData() {
  const now = Date.now();
  if (rateCache.data && (now - rateCache.fetchedAt) < CACHE_TTL_MS) {
    return rateCache.data;
  }

  // Primary: local parsed-rates.json (includes LLPAs, adjustments, spec payups)
  try {
    const { default: parsedRates } = await import('@/data/parsed-rates.json');
    if (parsedRates?.lenders?.length) {
      rateCache = { data: parsedRates.lenders, fetchedAt: now };
      return parsedRates.lenders;
    }
  } catch { /* ignore */ }

  // Fallback: GCS (legacy — doesn't include lender-specific adjustments yet)
  if (isGCSConfigured()) {
    try {
      const manifest = await fetchGCSFile(GCS_BUCKET, 'parsed/manifest.json');
      const lenders = await Promise.all(
        manifest.lenders.map(async (entry) => {
          const data = await fetchGCSFile(GCS_BUCKET, `parsed/${entry.file}`);
          return { lenderId: entry.id, ...data };
        })
      );
      rateCache = { data: lenders, fetchedAt: now };
      return lenders;
    } catch (err) {
      console.error('GCS parsed rate fetch failed:', err.message);
    }
  }

  return [];
}

export async function POST(request) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.loanAmount || body.loanAmount < 50000 || body.loanAmount > 10000000) {
      return NextResponse.json(
        { error: 'loanAmount required (50K-10M)' },
        { status: 400 }
      );
    }

    const scenario = {
      loanAmount: Number(body.loanAmount),
      loanPurpose: body.loanPurpose || 'purchase',
      loanType: body.loanType || null,
      category: body.category || null,
      state: body.state || null,
      county: body.county || null,
      creditScore: body.creditScore || 740,
      propertyValue: body.propertyValue ? Number(body.propertyValue) : null,
      propertyType: body.propertyType || 'sfr',
      occupancy: body.occupancy || 'primary',
      term: body.term || 30,
      employmentType: body.employmentType || 'w2',
      subFinancing: body.subFinancing || false,
      subFinancingBalance: body.subFinancingBalance ? Number(body.subFinancingBalance) : 0,
      includeBuydowns: body.includeBuydowns || false,
      includeIO: body.includeIO || false,
    };

    const options = {
      lockDays: body.lockDays || 30,
      termFilter: body.term || 30,
      productType: body.productType || null,
    };

    const allPrograms = await loadRateData();
    const result = priceScenario(scenario, allPrograms, options);

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, max-age=30, stale-while-revalidate=60',
      },
    });
  } catch (err) {
    console.error('Pricing API error:', err);
    return NextResponse.json(
      { error: 'Pricing engine error', detail: err.message },
      { status: 500 }
    );
  }
}

// GET for health check / info
export async function GET() {
  return NextResponse.json({
    engine: 'NetRate Pricing Engine v1',
    endpoint: 'POST /api/pricing',
    lenders: ['everstream', 'tls', 'keystone', 'swmc', 'amwest'],
    comp: { rate: '2%', capRefi: 3595, capPurchase: 4595, type: 'lender-paid' },
    features: ['multi-lender', 'county-loan-limits', 'price-normalization', 'best-execution'],
  });
}
