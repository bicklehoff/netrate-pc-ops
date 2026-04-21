/**
 * POST /api/leads/form
 *
 * Public lead-intake endpoint for browser form submissions (ICanBuy refi
 * landing, Google Ads landing, future public capture pages). No API key
 * required — protected by an IP-scoped rate limit + honeypot field.
 *
 * Sibling to POST /api/leads/inbound (server-to-server webhook, API-key
 * auth). Both delegate entity creation to the same `createInboundLead`
 * library.
 *
 * Honeypot: a hidden `website` field. Bots fill it; human forms leave it
 * empty. Filled honeypot → silent 200 (don't tell the bot it failed).
 *
 * Rate limit: 5 submits / 60s per IP. Abuse response is 429.
 *
 * Returns `{ success, contactId, leadId, dealId, isNew, emailStatus }`.
 */

import { NextResponse } from 'next/server';
import { normalizePhone } from '@/lib/normalize-phone';
import { createInboundLead } from '@/lib/leads/create-inbound';

// ─── Rate limit (per-IP, in-memory window) ─────────────────────────

const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 5;

function getClientIp(request) {
  // Vercel forwards the real IP in `x-forwarded-for` (comma-separated).
  const fwd = request.headers.get('x-forwarded-for') || '';
  const first = fwd.split(',')[0].trim();
  return first || request.headers.get('x-real-ip') || 'unknown';
}

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { windowStart: now, count: 1 });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

// ─── Helpers ───────────────────────────────────────────────────────

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

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
    const ip = getClientIp(request);

    if (isRateLimited(ip)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // ── Honeypot — bots fill `website`, real forms leave it empty.
    // Respond 200 with a synthetic success so bots don't learn the check.
    const honeypot = (body.website || body.url || '').toString().trim();
    if (honeypot) {
      return NextResponse.json({ success: true, isNew: false, emailStatus: 'skipped' });
    }

    const email = (pick(body, 'email') || '').toString().trim().toLowerCase();
    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    const rawPhone = pick(body, 'phone', 'mobile');
    const phone = rawPhone ? (normalizePhone(rawPhone) || rawPhone) : null;

    // Explicit SMS-consent gate per TCPA: if no consent flag, drop phone.
    // The landing form has to collect + pass `smsConsent: true` for SMS
    // outreach to be legal. Without it we keep the phone on the lead row
    // (for David to call back manually) but flag the scenario_data.
    const smsConsent = body.smsConsent === true || body.smsConsent === 'true' || body.sms_consent === true;

    const propertyAddress = pick(body, 'propertyAddress', 'property_address');
    const stateFromAddress = propertyAddress && typeof propertyAddress === 'object'
      ? normalizeState(propertyAddress.state) : null;
    const state = normalizeState(pick(body, 'state', 'propertyState', 'property_state')) || stateFromAddress;

    // Preserve the SMS consent flag in the raw payload so downstream
    // sequence engine (backlog #79) can gate texting on it.
    const rawPayload = { ...body, _smsConsent: smsConsent, _clientIp: ip };

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
      propertyValue: toNumberOrNull(pick(body, 'propertyValue', 'property_value')),
      propertyAddress,
      propertyType: pick(body, 'propertyType', 'property_type'),
      source: (pick(body, 'source') || 'landing-form').toString().slice(0, 64),
      sourceDetail: pick(body, 'sourceDetail', 'source_detail'),
      applicationChannel: 'landing_form',
      utmSource: pick(body, 'utmSource', 'utm_source'),
      utmMedium: pick(body, 'utmMedium', 'utm_medium'),
      utmCampaign: pick(body, 'utmCampaign', 'utm_campaign'),
      message: pick(body, 'message', 'notes'),
      rawPayload,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('[leads/form] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
