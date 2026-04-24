/**
 * Rate Alert API
 *
 * POST /api/rate-alert — Create or update a rate alert subscription
 * GET  /api/rate-alert?token=xxx — Confirm email (double opt-in)
 *
 * Request body (POST):
 * {
 *   email: "user@example.com",     // required
 *   loanType: "conventional",      // optional — loan type the subscriber wants updates on
 *   newsletter: true,              // optional (default: true)
 *   source: "rate-tool",           // optional — analytics tag for where they signed up
 * }
 *
 * All inserts set type='watch'. The 'strike' (target-based) mode was retired
 * with the public-facing Strike Rate → Rate Alert rename. Target-rate threshold
 * monitoring is reserved for the future "Target Rate" product.
 */

import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';
import { apiError } from '@/lib/api/safe-error';
import { rateLimit } from '@/lib/api/rate-limit';

const sql = neon(process.env.PC_DATABASE_URL || process.env.DATABASE_URL);

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request) {
  const limited = await rateLimit(request, { scope: 'rate-alert', limit: 5, window: '1 m' });
  if (limited) return limited;

  try {
    const body = await request.json();

    if (!body.email || !isValidEmail(body.email)) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }

    const email = body.email.toLowerCase().trim();
    const loanTypeVal = body.loanType || null;
    const newsletterVal = body.newsletter !== false;
    const sourceVal = body.source || null;
    const confirmToken = crypto.randomBytes(32).toString('hex');

    // Check for existing active subscription with same email + loan_type
    const existing = loanTypeVal
      ? await sql`
          SELECT id FROM rate_alerts
          WHERE email = ${email} AND loan_type = ${loanTypeVal}
            AND status IN ('active', 'paused') LIMIT 1`
      : await sql`
          SELECT id FROM rate_alerts
          WHERE email = ${email} AND loan_type IS NULL
            AND status IN ('active', 'paused') LIMIT 1`;

    if (existing.length > 0) {
      await sql`
        UPDATE rate_alerts SET
          newsletter = ${newsletterVal},
          source = ${sourceVal},
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

    // Create new subscription
    const result = await sql`
      INSERT INTO rate_alerts (
        email, type, loan_type, rate_alerts, newsletter, status, confirm_token, source
      ) VALUES (
        ${email},
        'watch',
        ${loanTypeVal},
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
    // For now, auto-confirm (remove when Resend is wired as part of the full Rate Alert product build)
    await sql`
      UPDATE rate_alerts SET confirmed_at = NOW() WHERE id = ${alertId}
    `;

    return NextResponse.json({
      success: true,
      action: 'created',
      message: "You're signed up for rate alerts.",
      id: alertId,
    }, { status: 201 });

  } catch (err) {
    return apiError(err, 'Failed to create alert', 500, { scope: 'rate-alert' });
  }
}

// GET — Confirm email or get endpoint info
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (token) {
    const result = await sql`
      UPDATE rate_alerts
      SET confirmed_at = NOW(), confirm_token = NULL, updated_at = NOW()
      WHERE confirm_token = ${token} AND confirmed_at IS NULL
      RETURNING id, email
    `;

    if (result.length === 0) {
      return NextResponse.json({ error: 'Invalid or expired confirmation link' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Email confirmed! Your rate alert is now active.',
      email: result[0].email,
    });
  }

  return NextResponse.json({
    endpoint: 'POST /api/rate-alert',
    description: 'Create a rate alert subscription',
  });
}
