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
import { priceRate } from '@/lib/rates/pricing-v2';
import { getDbLenderAdj } from '@/lib/rates/db-adj-loader';
import { loadRateDataFromDB } from '@/lib/rates/db-loader';
import { DEFAULT_SCENARIO } from '@/lib/rates/defaults';

const CACHE_TTL_MS = 2 * 60 * 1000;

let rateCache = { data: null, fetchedAt: 0 };

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

async function getEffectiveDate() {
  try {
    const sheet = await (await import('@/lib/prisma')).default.rateSheet.findFirst({
      where: { status: 'active' },
      orderBy: { effectiveDate: 'desc' },
      select: { effectiveDate: true },
    });
    if (sheet?.effectiveDate) {
      const d = new Date(sheet.effectiveDate);
      return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}`;
    }
  } catch { /* fall through */ }
  return null;
}

// Fallback comp rate — actual rate comes from rate_lenders table per lender
const FALLBACK_COMP_RATE = 0.02;

export async function POST(request) {
  try {
    const body = await request.json();

    if (!body.loanAmount || body.loanAmount < 50000 || body.loanAmount > 10000000) {
      return NextResponse.json(
        { error: 'loanAmount required (50K-10M)' },
        { status: 400 }
      );
    }

    const loanAmount = Number(body.loanAmount);
    const propertyValue = body.propertyValue ? Number(body.propertyValue) : null;
    const ltv = propertyValue ? Math.floor((loanAmount / propertyValue) * 10000) / 100 : 75;

    const scenario = {
      loanAmount,
      loanPurpose: body.loanPurpose || 'purchase',
      loanType: body.loanType || 'conventional',
      state: body.state || 'CO',
      creditScore: body.creditScore || DEFAULT_SCENARIO.fico,
      ltv: Math.round(ltv * 100) / 100,
      propertyValue,
      term: body.term || 30,
    };

    const lockDays = body.lockDays || 30;
    const termFilter = body.term || 30;
    const allLenders = await loadRateData();
    const results = [];

    for (const lenderData of allLenders) {
      const lenderId = lenderData.lenderId;

      // Build broker config from DB lender data (comp rate, caps, fees)
      const brokerConfig = {
        compRate: lenderData.compRate || FALLBACK_COMP_RATE,
        compCapPurchase: lenderData.compCap?.purchase || 3595,
        compCapRefi: lenderData.compCap?.refinance || 3595,
        fhaUfmip: lenderData.fhaUfmip || 0.0175,
      };

      // Load adjustments from DB for this loan type — skip lenders with no rules
      const lenderAdj = await getDbLenderAdj(lenderId, scenario.loanType);
      if (!lenderAdj) continue;

      for (const program of lenderData.programs) {
        // Term filter
        if (program.term !== termFilter) continue;

        // Loan type filter
        if (scenario.loanType && program.loanType !== scenario.loanType) continue;

        // Occupancy filter — only primary for now
        if (program.occupancy && program.occupancy !== 'primary') continue;

        // Loan amount range filter
        if (program.loanAmountRange) {
          const { min, max } = program.loanAmountRange;
          if (min && loanAmount <= min) continue;
          if (max && loanAmount > max) continue;
        }

        // Product type filter (fixed vs arm)
        if (body.productType && program.productType !== body.productType) continue;

        // Get rates for requested lock period
        const lockRates = program.rates.filter(r => r.lockDays === lockDays);
        if (lockRates.length === 0) continue;

        // Build product object for pricing-v2
        const product = {
          name: program.name || program.rawName,
          lenderCode: lenderId,
          term: program.term,
          productType: program.productType || 'fixed',
          investor: program.investor || 'fnma',
          tier: program.tier || 'core',
          uwFee: lenderData.lenderFee || 999,
        };

        // LLPA grids from parsed rate sheet data
        const llpaGrids = lenderData.llpas || null;

        for (const rateEntry of lockRates) {
          const result = priceRate(rateEntry, product, scenario, lenderAdj, brokerConfig, llpaGrids);
          results.push(result);
        }
      }
    }

    // Sort by rate ascending
    results.sort((a, b) => a.rate - b.rate);

    const effectiveDate = await getEffectiveDate();

    return NextResponse.json({
      scenario,
      effectiveDate,
      resultCount: results.length,
      results,
    }, {
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

export async function GET() {
  return NextResponse.json({
    engine: 'NetRate Pricing Engine v2',
    endpoint: 'POST /api/pricing',
    lenders: ['everstream', 'tls', 'keystone', 'swmc', 'amwest', 'windsor'],
    comp: { rate: '2%', capRefi: 3595, capPurchase: 3595, type: 'lender-paid' },
  });
}
