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
    // Find the lead by viewToken
    const lead = await prisma.lead.findFirst({
      where: { viewToken: token },
      select: { id: true, email: true, name: true },
    });

    if (!lead || !lead.email) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Find ALL leads with the same email (borrower may have saved multiple scenarios)
    const allLeads = await prisma.lead.findMany({
      where: { email: lead.email },
      select: { id: true },
    });
    const leadIds = allLeads.map(l => l.id);

    // Fetch all saved scenarios for those leads
    const scenarios = await prisma.savedScenario.findMany({
      where: { leadId: { in: leadIds } },
      orderBy: { createdAt: 'desc' },
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
    console.error('My Rates GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
