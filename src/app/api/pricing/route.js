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
 * Core logic lives in priceScenario() — shared with MLO quote generator.
 */

import { NextResponse } from 'next/server';
import { priceScenario } from '@/lib/rates/price-scenario';

export async function POST(request) {
  try {
    const body = await request.json();

    if (!body.loanAmount || body.loanAmount < 50000 || body.loanAmount > 10000000) {
      return NextResponse.json(
        { error: 'loanAmount required (50K-10M)' },
        { status: 400 }
      );
    }

    const result = await priceScenario(body);

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

export async function GET() {
  return NextResponse.json({
    engine: 'NetRate Pricing Engine v2',
    endpoint: 'POST /api/pricing',
    lenders: ['everstream', 'tls', 'keystone', 'swmc', 'amwest', 'windsor'],
    comp: { rate: '2%', capRefi: 3595, capPurchase: 3595, type: 'lender-paid' },
  });
}
