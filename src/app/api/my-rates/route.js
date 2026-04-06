// API: My Rates — borrower-facing saved scenarios
// GET /api/my-rates?token=xxx
// Token-based auth (like quote viewer), no cookie session needed.

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 401 });
  }

  try {
    // Find the lead by viewToken (raw SQL — Prisma client doesn't expose this field)
    const leads = await prisma.$queryRaw`SELECT id::text, email, name FROM leads WHERE view_token::text = ${token} LIMIT 1`;
    const lead = leads?.[0] || null;

    if (!lead || !lead.email) {
      return NextResponse.json({ error: `Invalid token (found ${leads?.length || 0} leads)` }, { status: 401 });
    }

    // Find ALL leads with the same email (borrower may have saved multiple scenarios)
    const allLeads = await prisma.lead.findMany({
      where: { email: lead.email },
      select: { id: true },
    });
    const leadIds = allLeads.map(l => l.id);

    // Fetch the LATEST saved scenario for this borrower (one email = one active scenario)
    const scenarios = await prisma.savedScenario.findMany({
      where: { leadId: { in: leadIds } },
      orderBy: { createdAt: 'desc' },
      take: 1,
      select: {
        id: true,
        scenarioData: true,
        alertFrequency: true,
        alertDays: true,
        alertStatus: true,
        lastPricingData: true,
        lastPricedAt: true,
        lastSentAt: true,
        sendCount: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      name: lead.name,
      email: lead.email,
      scenarios,
    });
  } catch (err) {
    console.error('My Rates GET error:', err.message, err.stack);
    return NextResponse.json({ error: `Load failed: ${err.message}` }, { status: 500 });
  }
}
