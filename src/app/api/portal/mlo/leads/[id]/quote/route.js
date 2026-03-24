// API: Run Quote for Lead
// POST /api/portal/mlo/leads/:id/quote — Run pricing engine, save results
// Auth: MLO session required

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { priceScenario } from '@/lib/rates/pricing';
import { fetchGCSFile, isGCSConfigured } from '@/lib/gcs';

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Build scenario from lead data
    const scenario = {
      loanAmount: lead.loanAmount ? Number(lead.loanAmount) : null,
      propertyValue: lead.propertyValue ? Number(lead.propertyValue) : null,
      creditScore: lead.creditScore || null,
      state: lead.propertyState || null,
      county: lead.propertyCounty || null,
      propertyType: lead.propertyType || 'sfr',
      occupancy: lead.occupancy || 'primary',
      loanPurpose: lead.loanPurpose || 'purchase',
      employmentType: lead.employmentType || 'w2',
      loanTerm: 30,
    };

    // Validate minimum required fields
    if (!scenario.loanAmount) {
      return NextResponse.json({ error: 'Loan amount is required to run a quote' }, { status: 400 });
    }
    if (!scenario.creditScore) {
      return NextResponse.json({ error: 'Credit score is required to run a quote' }, { status: 400 });
    }

    // Calculate LTV if we have property value
    if (scenario.propertyValue && scenario.loanAmount) {
      scenario.ltv = (scenario.loanAmount / scenario.propertyValue) * 100;
    }

    // Load rate data from GCS
    let ratePrograms = [];
    try {
      if (isGCSConfigured()) {
        const manifest = await fetchGCSFile('rate-data/manifest.json');
        if (manifest?.lenders) {
          for (const lenderFile of manifest.lenders) {
            const lenderData = await fetchGCSFile(`rate-data/${lenderFile}`);
            if (lenderData?.products) {
              ratePrograms.push(...lenderData.products);
            }
          }
        }
      }
    } catch (gcsError) {
      console.error('GCS rate data load error:', gcsError?.message);
    }

    if (ratePrograms.length === 0) {
      return NextResponse.json({
        error: 'No rate data available. Rate sheets have not been uploaded yet.',
      }, { status: 503 });
    }

    // Run pricing engine
    let results;
    try {
      results = priceScenario(scenario, ratePrograms);
    } catch (priceError) {
      return NextResponse.json({
        error: 'Pricing engine error: ' + priceError.message,
      }, { status: 500 });
    }

    // Find best result
    const best = results?.results?.[0] || null;

    // Calculate monthly payment
    let monthlyPayment = null;
    if (best?.rate && scenario.loanAmount) {
      const r = best.rate / 100 / 12;
      const n = scenario.loanTerm * 12;
      monthlyPayment = Math.round(scenario.loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
    }

    // Save quote
    const quote = await prisma.leadQuote.create({
      data: {
        leadId: id,
        scenario,
        results: results || {},
        bestRate: best?.rate || null,
        bestLender: best?.lender || null,
        bestPrice: best?.adjustedPrice || null,
        monthlyPayment,
        compAmount: results?.comp?.amount || null,
        lenderFee: best?.lenderFee || null,
      },
    });

    // Update lead status to 'quoted' if it was new/contacted/qualified
    if (['new', 'contacted', 'qualified'].includes(lead.status)) {
      await prisma.lead.update({
        where: { id },
        data: { status: 'quoted' },
      });
    }

    return NextResponse.json({
      success: true,
      quote,
      scenario,
      resultCount: results?.results?.length || 0,
    });
  } catch (error) {
    console.error('Run quote error:', error);
    return NextResponse.json({ error: 'Failed to run quote' }, { status: 500 });
  }
}
