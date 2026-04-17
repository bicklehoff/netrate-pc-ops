/**
 * POST /api/leads/inbound
 *
 * Server-to-server webhook for paid lead providers (other lenders, Zillow,
 * LendingTree, Google Ads conversion push, Zoho Flow relays, etc.). Handles
 * auth + rate limiting + payload normalization; delegates entity creation
 * to `createInboundLead` so a future public form endpoint can reuse it.
 *
 * NOT for ICanBuy — ICanBuy redirects borrowers to a landing page they fill
 * in themselves. That goes through the (future) public form endpoint.
 *
 * Auth: `x-api-key: $INBOUND_LEADS_API_KEY`
 *
 * Returns: `{ success, contactId, leadId, dealId, isNew, emailStatus }`
 *
 * Field naming: accepts camelCase AND snake_case variants. Full original
 * payload is preserved in `leads.scenario_data` so nothing is lost if a
 * field is misnamed.
 */

import { NextResponse } from 'next/server';
import { normalizePhone } from '@/lib/normalize-phone';
import { createInboundLead } from '@/lib/leads/create-inbound';

// ─── Rate limit ────────────────────────────────────────────────────
// By API key (not IP — auth is already required). In-memory window.

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 60;

function isRateLimited(key) {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(key, { windowStart: now, count: 1 });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

// ─── Helpers ───────────────────────────────────────────────────────

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Pick the first non-empty value among a set of field-name variants. */
function pick(body, ...names) {
  for (const n of names) {
    if (body[n] !== undefined && body[n] !== null && body[n] !== '') return body[n];
  }
  return null;
}

function toNumberOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toIntOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function normalizeState(s) {
  if (!s || typeof s !== 'string') return null;
  return s.trim().toUpperCase().slice(0, 2) || null;
}

// ─── POST ──────────────────────────────────────────────────────────

export async function POST(request) {
  try {
    // ── Auth ──────────────────────────────────────────────────────
    const apiKey = request.headers.get('x-api-key') || request.headers.get('X-Api-Key') || '';
    const expected = process.env.INBOUND_LEADS_API_KEY;

    if (!expected) {
      console.error('[leads/inbound] INBOUND_LEADS_API_KEY not configured');
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }
    if (!apiKey || apiKey !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isRateLimited(apiKey)) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    }

    // ── Payload ───────────────────────────────────────────────────
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const email = (pick(body, 'email') || '').toString().trim().toLowerCase();
    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    // Extract + normalize from either camelCase or snake_case.
    const rawPhone = pick(body, 'phone', 'mobile');
    const phone = rawPhone ? (normalizePhone(rawPhone) || rawPhone) : null;
    const propertyAddress = pick(body, 'propertyAddress', 'property_address');
    const stateFromAddress = propertyAddress && typeof propertyAddress === 'object'
      ? normalizeState(propertyAddress.state) : null;
    const state = normalizeState(pick(body, 'state', 'propertyState', 'property_state')) || stateFromAddress;

    const result = await createInboundLead({
      email,
      firstName: pick(body, 'firstName', 'first_name'),
      lastName: pick(body, 'lastName', 'last_name'),
      phone,
      state,
      loanPurpose: pick(body, 'loanPurpose', 'loan_purpose'),
      loanType: pick(body, 'loanType', 'loan_type'),
      loanAmount: toNumberOrNull(pick(body, 'loanAmount', 'loan_amount')),
      creditScore: toIntOrNull(pick(body, 'creditScore', 'credit_score', 'fico')),
      propertyValue: toNumberOrNull(pick(body, 'propertyValue', 'property_value', 'purchasePrice', 'purchase_price')),
      propertyAddress,
      propertyType: pick(body, 'propertyType', 'property_type'),
      source: (pick(body, 'source') || 'inbound-webhook').toString().slice(0, 64),
      sourceDetail: pick(body, 'sourceDetail', 'source_detail'),
      applicationChannel: 'inbound_webhook',
      utmSource: pick(body, 'utmSource', 'utm_source'),
      utmMedium: pick(body, 'utmMedium', 'utm_medium'),
      utmCampaign: pick(body, 'utmCampaign', 'utm_campaign'),
      message: pick(body, 'message', 'notes'),
      rawPayload: body.raw || body,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('[leads/inbound] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
