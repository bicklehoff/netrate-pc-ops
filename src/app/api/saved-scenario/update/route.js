// API: Update an existing saved scenario (BRP reprice flow)
// POST /api/saved-scenario/update { token, scenarioData }
// Token-based auth — validates borrower owns the scenario, updates it with new inputs + fresh pricing.

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { priceScenario } from '@/lib/rates/price-scenario';
import { calcMonthlyPI } from '@/lib/rates/math';

export async function POST(request) {
  try {
    const { token, scenarioData } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 401 });
    }
    if (!scenarioData || !scenarioData.loanAmount) {
      return NextResponse.json({ error: 'Scenario data is required' }, { status: 400 });
    }

    // Validate token → get lead email
    const leads = await prisma.$queryRaw`
      SELECT id::text, email, name FROM leads WHERE view_token::text = ${token} LIMIT 1
    `;
    const lead = leads?.[0];

    if (!lead?.email) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Find all leads with this email (same borrower may have multiple lead records)
    const allLeads = await prisma.lead.findMany({
      where: { email: lead.email },
      select: { id: true },
    });
    const leadIds = allLeads.map(l => l.id);

    // Find the latest saved scenario for this borrower
    const existingScenario = await prisma.savedScenario.findFirst({
      where: { leadId: { in: leadIds } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, alertFrequency: true, alertDays: true },
    });

    if (!existingScenario) {
      return NextResponse.json({ error: 'No saved scenario found' }, { status: 404 });
    }

    // Run fresh pricing
    let pricingData = null;
    try {
      const pricingInput = {
        loanAmount: scenarioData.loanAmount,
        propertyValue: scenarioData.propertyValue,
        loanPurpose: scenarioData.purpose,
        loanType: scenarioData.loanType,
        creditScore: scenarioData.fico,
        state: scenarioData.state,
        county: scenarioData.county,
        term: scenarioData.term,
      };
      const result = await priceScenario(pricingInput);
      const loanAmt = scenarioData.loanAmount;
      const term = scenarioData.term || 30;
      pricingData = (result.results || [])
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
    } catch (err) {
      console.error('Update pricing failed:', err.message);
    }

    // Update the scenario with new inputs + pricing
    await prisma.savedScenario.update({
      where: { id: existingScenario.id },
      data: {
        scenarioData,
        lastPricingData: pricingData,
        lastPricedAt: pricingData ? new Date() : undefined,
      },
    });

    // Also update the lead record with latest scenario details
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        scenarioData,
        loanPurpose: scenarioData.purpose || null,
        loanAmount: scenarioData.loanAmount || null,
        propertyState: scenarioData.state || null,
        propertyValue: scenarioData.propertyValue || null,
        propertyCounty: scenarioData.county || null,
        creditScore: scenarioData.fico || null,
      },
    });

    return NextResponse.json({
      success: true,
      scenarioId: existingScenario.id,
      viewToken: token,
    });
  } catch (err) {
    console.error('Update scenario error:', err.message, err.stack);
    return NextResponse.json({ error: `Update failed: ${err.message}` }, { status: 500 });
  }
}
