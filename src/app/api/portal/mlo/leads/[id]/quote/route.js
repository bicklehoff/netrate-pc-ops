// API: Run Quote for Lead
// POST /api/portal/mlo/leads/:id/quote — Run pricing engine, save results
// Auth: MLO session required

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import sql from '@/lib/db';
import { priceScenario } from '@/lib/rates/pricing';
import { fetchGCSFile, isGCSConfigured } from '@/lib/gcs';

export async function POST(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'mlo') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const leadRows = await sql`SELECT * FROM leads WHERE id = ${id} LIMIT 1`;
    const lead = leadRows[0];
    if (!lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Build scenario from lead data
    const scenario = {
      loanAmount: lead.loan_amount ? Number(lead.loan_amount) : null,
      propertyValue: lead.property_value ? Number(lead.property_value) : null,
      creditScore: lead.credit_score || null,
      state: lead.property_state || null,
      county: lead.property_county || null,
      propertyType: lead.property_type || 'sfr',
      occupancy: lead.occupancy || 'primary',
      loanPurpose: lead.loan_purpose || 'purchase',
      employmentType: lead.employment_type || 'w2',
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

    // Load rate data — try GCS first, fall back to local parsed JSON
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

    // Fallback: load from local parsed rates file
    if (ratePrograms.length === 0) {
      try {
        const { readFileSync } = await import('fs');
        const { join } = await import('path');
        const filePath = join(process.cwd(), 'src/data/parsed-rates.json');
        const data = JSON.parse(readFileSync(filePath, 'utf8'));
        ratePrograms = data.products || [];
      } catch (localError) {
        console.error('Local rate data load error:', localError?.message);
      }
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
    const quoteRows = await sql`
      INSERT INTO lead_quotes (lead_id, scenario, results, best_rate, best_lender, best_price, monthly_payment, comp_amount, lender_fee, created_at)
      VALUES (
        ${id}, ${JSON.stringify(scenario)}::jsonb, ${JSON.stringify(results || {})}::jsonb,
        ${best?.rate || null}, ${best?.lender || null}, ${best?.adjustedPrice || null},
        ${monthlyPayment}, ${results?.comp?.amount || null}, ${best?.lenderFee || null},
        NOW()
      )
      RETURNING *
    `;
    const quote = quoteRows[0];

    // Update lead status to 'quoted' if it was new/contacted/qualified
    if (['new', 'contacted', 'qualified'].includes(lead.status)) {
      await sql`UPDATE leads SET status = 'quoted', updated_at = NOW() WHERE id = ${id}`;
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
