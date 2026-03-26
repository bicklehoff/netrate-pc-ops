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
 *   creditScore: 780,            // optional (default: from DEFAULT_SCENARIO)
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
import { loadRateDataFromDB } from '@/lib/rates/db-loader';
import { DEFAULT_SCENARIO } from '@/lib/rates/defaults';

const CACHE_TTL_MS = 2 * 60 * 1000;

// Module-level cache for rate data from DB
let rateCache = { data: null, fetchedAt: 0 };

/**
 * Load rate data from the database (with 2-minute cache).
 */
async function loadRateData() {
  const now = Date.now();
  if (rateCache.data && (now - rateCache.fetchedAt) < CACHE_TTL_MS) {
    return rateCache.data;
  }

  try {
    const lenders = await loadRateDataFromDB();
    if (lenders?.length) {
      rateCache = { data: lenders, fetchedAt: now };
      return lenders;
    }
  } catch (err) {
    console.error('DB rate data load failed:', err.message);
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
      creditScore: body.creditScore || DEFAULT_SCENARIO.fico,
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
