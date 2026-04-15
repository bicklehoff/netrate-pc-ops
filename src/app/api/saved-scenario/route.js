import { NextResponse } from 'next/server';
import sql from '@/lib/db';
import { priceScenario } from '@/lib/rates/price-scenario';
import { sendEmail } from '@/lib/resend';
import { rateAlertWelcomeTemplate } from '@/lib/email-templates/borrower';
import { calcMonthlyPI } from '@/lib/rates/math';
import { createScenario } from '@/lib/scenarios/db';

const FREQUENCY_DEFAULTS = {
  daily: ['mon', 'tue', 'wed', 'thu', 'fri'],
  '3x_week': ['mon', 'wed', 'fri'],
  '2x_week': ['tue', 'thu'],
  weekly: ['mon'],
};

const DEFAULT_ORG_ID = '00000000-0000-4000-8000-000000000001';

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email, phone, scenarioData, alertFrequency, alertDays, selectedRates } = body;

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }
    if (!scenarioData || !scenarioData.loanAmount) {
      return NextResponse.json({ error: 'Scenario data is required' }, { status: 400 });
    }

    const freq = FREQUENCY_DEFAULTS[alertFrequency] ? alertFrequency : '2x_week';
    const days = Array.isArray(alertDays) && alertDays.length > 0
      ? alertDays
      : FREQUENCY_DEFAULTS[freq];

    // Create lead with scenario data
    const leadRows = await sql`
      INSERT INTO leads (name, email, phone, source, source_detail, scenario_data, loan_purpose, loan_amount, property_state, property_value, property_county, credit_score)
      VALUES (${name}, ${email.trim().toLowerCase()}, ${phone || null}, 'rate-tool-save', 'saved-scenario', ${JSON.stringify(scenarioData)}, ${scenarioData.purpose || null}, ${scenarioData.loanAmount || null}, ${scenarioData.state || null}, ${scenarioData.propertyValue || null}, ${scenarioData.county || null}, ${scenarioData.fico || null})
      RETURNING id, organization_id
    `;
    const leadId = leadRows[0].id;
    const orgId = leadRows[0].organization_id || DEFAULT_ORG_ID;

    // Fetch the DB-generated view_token
    const tokenRow = await sql`SELECT view_token::text FROM leads WHERE id::text = ${leadId}`;
    const viewToken = tokenRow?.[0]?.view_token || null;

    // Use client-side selected rates if provided, otherwise run server-side pricing
    let initialPricing = null;
    if (selectedRates?.length > 0) {
      initialPricing = selectedRates;
    } else {
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
        initialPricing = (result.results || [])
          .sort((a, b) => a.rate - b.rate)
          .slice(0, 3)
          .map(r => ({
            rate: r.rate,
            apr: r.apr || null,
            monthlyPI: r.monthlyPI || calcMonthlyPI(r.rate, loanAmt, term),
            price: r.finalPrice || r.price || null,
            finalPrice: r.finalPrice || r.price || null,
            lender: r.lender || r.lenderName || null,
            lenderName: r.lender || r.lenderName || null,
            program: r.program || null,
            rebateDollars: r.rebateDollars,
            discountDollars: r.discountDollars,
            lenderFee: r.lenderFee,
          }));
      } catch (err) {
        console.error('Initial pricing snapshot failed:', err.message);
      }
    }

    // Create scenario (unified table) with owner_type='borrower'
    const scenario = await createScenario(
      {
        organization_id: orgId,
        owner_type: 'borrower',
        source: 'rate-tool',
        visibility: 'borrower_visible',
        status: 'active',
        lead_id: leadId,
        borrower_name: name,
        borrower_email: email.trim().toLowerCase(),
        borrower_phone: phone || null,
        loan_purpose: scenarioData.purpose || null,
        loan_type: scenarioData.loanType || null,
        property_value: scenarioData.propertyValue || null,
        loan_amount: scenarioData.loanAmount || null,
        ltv: scenarioData.ltv || null,
        fico: scenarioData.fico || null,
        state: scenarioData.state || null,
        county: scenarioData.county || null,
        term: scenarioData.term || null,
        product_type: scenarioData.productType || null,
        property_type: scenarioData.propertyType || null,
        current_rate: scenarioData.currentRate || null,
        current_balance: scenarioData.currentPayoff || scenarioData.currentBalance || null,
        alert_frequency: freq,
        alert_days: days,
        alert_status: 'active',
        last_priced_at: initialPricing ? new Date() : null,
      },
      initialPricing || [],
      null,
    );

    // Fetch unsub_token (created by DB default)
    const tokRow = await sql`SELECT unsub_token FROM scenarios WHERE id = ${scenario.id}`;
    const unsubToken = tokRow?.[0]?.unsub_token;

    // Send welcome email
    const SITE_URL = process.env.NEXTAUTH_URL || 'https://www.netratemortgage.com';
    let emailStatus = 'not_attempted';
    try {
      const firstName = name.split(' ')[0];
      const welcomeEmail = rateAlertWelcomeTemplate({
        firstName,
        scenarioSummary: {
          purpose: scenarioData.purpose,
          loanAmount: scenarioData.loanAmount,
          fico: scenarioData.fico,
          ltv: scenarioData.ltv,
          state: scenarioData.state,
        },
        initialRates: initialPricing || [],
        frequency: freq,
        days,
        unsubscribeLink: `${SITE_URL}/api/saved-scenario/unsubscribe?token=${unsubToken}`,
        myRatesLink: `${SITE_URL}/portal/my-rates?token=${viewToken}`,
      });
      const emailResult = await sendEmail({
        to: email.trim().toLowerCase(),
        subject: welcomeEmail.subject,
        html: welcomeEmail.html,
        text: welcomeEmail.text,
      });
      emailStatus = emailResult?.skipped ? 'skipped_no_api_key' : 'sent';
      console.log('Welcome email result:', emailStatus, emailResult?.id);
    } catch (err) {
      emailStatus = 'failed';
      console.error('Welcome email failed:', err.message, err.stack);
      // Non-blocking — scenario is still saved even if email fails
    }

    return NextResponse.json({
      success: true,
      scenarioId: scenario.id,
      leadId,
      viewToken,
      emailStatus,
    });
  } catch (err) {
    console.error('Save scenario API error:', err.message, err.stack);
    return NextResponse.json({ error: `Save failed: ${err.message}` }, { status: 500 });
  }
}
