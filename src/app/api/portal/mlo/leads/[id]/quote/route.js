// API: Run Quote for Lead
// POST /api/portal/mlo/leads/:id/quote — Run pricing engine, save results
// Auth: MLO session required

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import sql from '@/lib/db';
import { priceScenario } from '@/lib/rates/price-scenario';

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

    // Build scenario from lead data (camelCase — matches price-scenario.js input schema)
    const scenario = {
      loanAmount: lead.loan_amount ? Number(lead.loan_amount) : null,
      propertyValue: lead.property_value ? Number(lead.property_value) : null,
      creditScore: lead.credit_score || null,
      state: lead.property_state || null,
      county: lead.property_county || null,
      propertyType: lead.property_type || 'sfr',
      loanPurpose: lead.loan_purpose || 'purchase',
      loanType: lead.loan_type || 'conventional',
      term: 30,
      lockDays: 30,
    };

    // Validate minimum required fields
    if (!scenario.loanAmount) {
      return NextResponse.json({ error: 'Loan amount is required to run a quote' }, { status: 400 });
    }
    if (!scenario.creditScore) {
      return NextResponse.json({ error: 'Credit score is required to run a quote' }, { status: 400 });
    }

    // Run pricing engine — DB-driven, async
    let results;
    try {
      results = await priceScenario(scenario);
    } catch (priceError) {
      return NextResponse.json({
        error: 'Pricing engine error: ' + priceError.message,
      }, { status: 500 });
    }

    if (!results?.results?.length) {
      return NextResponse.json({
        error: 'No rates available for this scenario',
        configWarnings: results?.configWarnings || [],
      }, { status: 503 });
    }

    // Best result is the first entry — price-scenario.js returns results sorted by rate ascending
    const best = results.results[0];

    // Calculate monthly payment from the best rate
    let monthlyPayment = null;
    if (best?.rate && scenario.loanAmount) {
      const r = best.rate / 100 / 12;
      const n = scenario.term * 12;
      monthlyPayment = Math.round(scenario.loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
    }

    // Save quote
    const quoteRows = await sql`
      INSERT INTO lead_quotes (lead_id, scenario, results, best_rate, best_lender, best_price, monthly_payment, comp_amount, lender_fee, created_at)
      VALUES (
        ${id}, ${JSON.stringify(scenario)}::jsonb, ${JSON.stringify(results || {})}::jsonb,
        ${best?.rate || null}, ${best?.lender || null}, ${best?.finalPrice ?? best?.price ?? null},
        ${monthlyPayment}, ${best?.compDollars ?? null}, ${best?.lenderFee ?? null},
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
      resultCount: results.results.length,
      effectiveDate: results.effectiveDate,
    });
  } catch (error) {
    console.error('Run quote error:', error);
    return NextResponse.json({ error: 'Failed to run quote' }, { status: 500 });
  }
}
