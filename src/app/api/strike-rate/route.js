/**
 * Strike Rate / Rate Alert API
 *
 * POST /api/strike-rate — Create a new alert (strike rate or rate watch)
 * GET  /api/strike-rate?token=xxx — Confirm email (double opt-in)
 *
 * Request body (POST):
 * {
 *   email: "user@example.com",     // required
 *   type: "strike",                // "strike" | "watch" (default: "strike")
 *   loanType: "conventional",      // required for strike type
 *   targetRate: 5.5,               // required for strike type
 *   loanAmount: 400000,            // optional
 *   state: "CO",                   // optional
 *   term: 30,                      // optional (default: 30)
 *   newsletter: true,              // optional (default: true)
 *   source: "rate-tool",           // optional — where on the site they signed up
 * }
 */

import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

const sql = neon(process.env.PC_DATABASE_URL || process.env.DATABASE_URL);

// Validate email format
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// POST — Create new alert
export async function POST(request) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.email || !isValidEmail(body.email)) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }

    const type = body.type || 'strike';

    if (type === 'strike') {
      if (!body.loanType) {
        return NextResponse.json({ error: 'loanType required for strike rate alerts' }, { status: 400 });
      }
      if (!body.targetRate || body.targetRate < 1 || body.targetRate > 15) {
        return NextResponse.json({ error: 'targetRate required (1-15%)' }, { status: 400 });
      }
    }

    const email = body.email.toLowerCase().trim();
    const confirmToken = crypto.randomBytes(32).toString('hex');

    // Check for existing active alert with same email + type + loanType
    const loanTypeVal = body.loanType || null;
    const existing = loanTypeVal
      ? await sql`
          SELECT id, status FROM rate_alerts
          WHERE email = ${email} AND type = ${type} AND loan_type = ${loanTypeVal}
            AND status IN ('active', 'paused') LIMIT 1`
      : await sql`
          SELECT id, status FROM rate_alerts
          WHERE email = ${email} AND type = ${type} AND loan_type IS NULL
            AND status IN ('active', 'paused') LIMIT 1`;

    if (existing.length > 0) {
      // Update existing alert instead of creating duplicate
      const updTargetRate = body.targetRate ? Number(body.targetRate) : 0;
      const updLoanAmount = body.loanAmount ? Number(body.loanAmount) : 0;
      const updState = body.state || null;
      const updSource = body.source || null;
      const updTerm = body.term || 30;
      const updNewsletter = body.newsletter !== false;
      await sql`
        UPDATE rate_alerts SET
          target_rate = NULLIF(${updTargetRate}::numeric, 0),
          loan_amount = NULLIF(${updLoanAmount}::numeric, 0),
          state = ${updState},
          term = ${updTerm},
          newsletter = ${updNewsletter},
          source = ${updSource},
          status = 'active',
          updated_at = NOW()
        WHERE id = ${existing[0].id}
      `;

      return NextResponse.json({
        success: true,
        action: 'updated',
        message: 'Your rate alert has been updated.',
        id: existing[0].id,
      });
    }

    // Create new alert
    // Neon tagged templates can't infer types for nullable DECIMAL columns,
    // so we pass numbers directly (not null) or use separate queries
    const targetRate = body.targetRate ? Number(body.targetRate) : 0;
    const loanAmount = body.loanAmount ? Number(body.loanAmount) : 0;
    const stateVal = body.state || null;
    const sourceVal = body.source || null;
    const termVal = body.term || 30;
    const newsletterVal = body.newsletter !== false;

    const result = await sql`
      INSERT INTO rate_alerts (
        email, type, loan_type, target_rate, loan_amount, state, term,
        rate_alerts, newsletter, status, confirm_token, source
      ) VALUES (
        ${email},
        ${type},
        ${loanTypeVal},
        NULLIF(${targetRate}::numeric, 0),
        NULLIF(${loanAmount}::numeric, 0),
        ${stateVal},
        ${termVal},
        true,
        ${newsletterVal},
        'active',
        ${confirmToken},
        ${sourceVal}
      )
      RETURNING id
    `;

    const alertId = result[0].id;

    // TODO: Send confirmation email via Resend
    // For now, auto-confirm (remove this when Resend is wired)
    await sql`
      UPDATE rate_alerts SET confirmed_at = NOW() WHERE id = ${alertId}
    `;

    return NextResponse.json({
      success: true,
      action: 'created',
      message: type === 'strike'
        ? `We'll email you when ${body.loanType} rates hit ${body.targetRate}%.`
        : "You're signed up for rate alerts.",
      id: alertId,
    }, { status: 201 });

  } catch (err) {
    console.error('Strike rate API error:', err);
    return NextResponse.json(
      { error: 'Failed to create alert', detail: err.message },
      { status: 500 }
    );
  }
}

// GET — Confirm email or get alert status
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (token) {
    // Email confirmation
    const result = await sql`
      UPDATE rate_alerts
      SET confirmed_at = NOW(), confirm_token = NULL, updated_at = NOW()
      WHERE confirm_token = ${token} AND confirmed_at IS NULL
      RETURNING id, email, type
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Invalid or expired confirmation link' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Email confirmed! Your rate alert is now active.',
      email: result[0].email,
      type: result[0].type,
    });
  }

  // No token — return info
  return NextResponse.json({
    endpoint: 'POST /api/strike-rate',
    types: ['strike', 'watch'],
    description: 'Create a strike rate alert or rate watch subscription',
  });
}
