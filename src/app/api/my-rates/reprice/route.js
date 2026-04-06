// API: Reprice a saved scenario on demand
// POST /api/my-rates/reprice { token, scenarioId }
// Token-based auth — validates borrower owns the scenario.

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { priceScenario } from '@/lib/rates/price-scenario';
import { calcMonthlyPI } from '@/lib/rates/math';

export async function POST(request) {
  try {
    const { token, scenarioId } = await request.json();

    if (!token || !scenarioId) {
      return NextResponse.json({ error: 'Token and scenarioId required' }, { status: 400 });
    }

    // Validate token → get email (raw SQL — Prisma client doesn't expose viewToken)
    const leads = await prisma.$queryRaw`SELECT email FROM leads WHERE view_token::text = ${token} LIMIT 1`;
    const lead = leads?.[0] || null;

    if (!lead?.email) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Fetch the scenario and verify ownership via email
    const scenario = await prisma.savedScenario.findUnique({
      where: { id: scenarioId },
      include: {
        lead: { select: { email: true } },
      },
    });

    if (!scenario || scenario.lead?.email !== lead.email) {
      return NextResponse.json({ error: 'Scenario not found' }, { status: 404 });
    }

    const sd = scenario.scenarioData;
    if (!sd?.loanAmount) {
      return NextResponse.json({ error: 'Invalid scenario data' }, { status: 400 });
    }

    // Run pricing
    const pricingInput = {
      loanAmount: sd.loanAmount,
      propertyValue: sd.propertyValue,
      loanPurpose: sd.purpose,
      loanType: sd.loanType,
      creditScore: sd.fico,
      state: sd.state,
      county: sd.county,
      term: sd.term,
    };

    const result = await priceScenario(pricingInput);
    const loanAmt = sd.loanAmount;
    const term = sd.term || 30;
    const topRates = (result.results || [])
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 3)
      .map(r => ({
        rate: r.rate,
        apr: r.apr || null,
        monthlyPI: r.monthlyPI || calcMonthlyPI(r.rate, loanAmt, term),
        price: r.finalPrice || r.price || null,
        lenderName: r.lender || r.lenderName || null,
        program: r.program || null,
        rebateDollars: r.rebateDollars,
        discountDollars: r.discountDollars,
        lenderFee: r.lenderFee,
      }));

    // Update scenario with fresh pricing
    await prisma.savedScenario.update({
      where: { id: scenarioId },
      data: {
        lastPricingData: topRates,
        lastPricedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      rates: topRates,
      effectiveDate: result.effectiveDate || null,
      pricedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Reprice error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
