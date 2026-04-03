import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { priceScenario } from '@/lib/rates/price-scenario';
import { sendEmail } from '@/lib/resend';
import { rateAlertWelcomeTemplate } from '@/lib/email-templates/borrower';

const FREQUENCY_DEFAULTS = {
  daily: ['mon', 'tue', 'wed', 'thu', 'fri'],
  '3x_week': ['mon', 'wed', 'fri'],
  '2x_week': ['tue', 'thu'],
  weekly: ['mon'],
};

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email, phone, scenarioData, alertFrequency, alertDays } = body;

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

    // Create lead with scenario data — generate viewToken in code so it's
    // guaranteed in the response (dbgenerated defaults aren't always returned by Prisma)
    const viewToken = crypto.randomUUID();
    const lead = await prisma.lead.create({
      data: {
        name,
        email: email.trim().toLowerCase(),
        phone: phone || null,
        source: 'rate-tool-save',
        sourceDetail: 'saved-scenario',
        viewToken,
        scenarioData,
        loanPurpose: scenarioData.purpose || null,
        loanAmount: scenarioData.loanAmount || null,
        propertyState: scenarioData.state || null,
        propertyValue: scenarioData.propertyValue || null,
        propertyCounty: scenarioData.county || null,
        creditScore: scenarioData.fico || null,
      },
    });

    // Run initial pricing snapshot
    let initialPricing = null;
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
      // Store top 3 results as initial snapshot
      initialPricing = (result.results || [])
        .sort((a, b) => a.rate - b.rate)
        .slice(0, 3)
        .map(r => ({
          rate: r.rate,
          apr: r.apr,
          monthlyPI: r.monthlyPI,
          price: r.price,
          lenderName: r.lenderName,
          rebateDollars: r.rebateDollars,
          discountDollars: r.discountDollars,
          lenderFee: r.lenderFee,
        }));
    } catch (err) {
      console.error('Initial pricing snapshot failed:', err.message);
    }

    // Create saved scenario
    const savedScenario = await prisma.savedScenario.create({
      data: {
        leadId: lead.id,
        scenarioData,
        alertFrequency: freq,
        alertDays: days,
        alertStatus: 'active',
        lastPricingData: initialPricing,
        lastPricedAt: initialPricing ? new Date() : null,
      },
    });

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
        unsubscribeLink: `${SITE_URL}/api/saved-scenario/unsubscribe?token=${savedScenario.unsubToken}`,
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
      scenarioId: savedScenario.id,
      leadId: lead.id,
      viewToken,
      emailStatus,
    });
  } catch (err) {
    console.error('Save scenario API error:', err.message, err.stack);
    return NextResponse.json({ error: `Save failed: ${err.message}` }, { status: 500 });
  }
}
