// Zoho OAuth Substrate — shared refresh-token plumbing for all Zoho integrations.
//
// See Work/Dev/ZOHO-OAUTH-SUBSTRATE-DESIGN.md for design rationale, trade-offs,
// and migration plan. Replaces ~50 LOC of duplicated getAccessToken() logic
// across zoho-workdrive.js, zoho-sign.js, and (eventually) zoho-bookings.
//
// Layered cache: (1) in-process Map (per-Lambda, fastest), (2) Vercel KV
// via Upstash (cross-instance, survives cold starts), (3) refresh from Zoho.
// In-process Promise dedup suppresses concurrent refreshes within an instance
// and emits a console.warn when suppression fires (active stampede signal —
// see design note Trade-off #2).

import { Redis } from '@upstash/redis';

const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.com/oauth/v2/token';
const DEFAULT_TTL_MINUTES = 55;
const STAMPEDE_WARN_INTERVAL = 5;

// ─── Upstash KV client (lazy, fail-soft) ──────────────────────

let redisClient = null;
function getRedis() {
  if (redisClient) return redisClient;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  redisClient = new Redis({ url, token });
  return redisClient;
}

// ─── Per-instance state ───────────────────────────────────────

// In-process token cache: cacheKey -> { token, expiresAt }
const memCache = new Map();

// In-flight refresh promises (dedup against stampede): cacheKey -> Promise<string>
const inflight = new Map();

// Stampede counter — total suppressions per process, logged at intervals
let stampedeCount = 0;

// ─── Errors ───────────────────────────────────────────────────

/**
 * Typed error for Zoho OAuth failures. Routes can branch on httpStatus/code.
 *
 * @property {number|undefined} httpStatus — HTTP status from Zoho refresh endpoint, if any
 * @property {string|undefined} code — discriminator: 'config_missing' | 'network' | 'http' | <zoho_error_code>
 * @property {*} details — raw response body or error
 */
export class ZohoOAuthError extends Error {
  constructor(message, { httpStatus, code, details } = {}) {
    super(message);
    this.name = 'ZohoOAuthError';
    this.httpStatus = httpStatus;
    this.code = code;
    this.details = details;
  }
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Get a valid Zoho access token. Cached in-process (fast) and in Vercel KV
 * (cross-instance) for ttlMinutes. Concurrent callers within the same Lambda
 * instance dedupe to a single refresh.
 *
 * @param {object} opts
 * @param {string} opts.refreshTokenEnv — env var holding the refresh token, e.g. 'ZOHO_REFRESH_TOKEN'
 * @param {number} [opts.ttlMinutes=55] — cache TTL; Zoho tokens expire at 60 min
 * @param {boolean} [opts.forceRefresh=false] — bypass caches and refresh now (use after a 401 from a downstream API)
 * @returns {Promise<string>} access token
 * @throws {ZohoOAuthError}
 */
export async function getZohoToken(opts = {}) {
  const { refreshTokenEnv, ttlMinutes = DEFAULT_TTL_MINUTES, forceRefresh = false } = opts;
  if (!refreshTokenEnv) {
    throw new ZohoOAuthError('refreshTokenEnv option is required', { code: 'config_missing' });
  }

  const cacheKey = `zoho:oauth:${refreshTokenEnv}`;
  const now = Date.now();

  // Layer 1: in-process cache
  if (!forceRefresh) {
    const memEntry = memCache.get(cacheKey);
    if (memEntry && memEntry.expiresAt > now) {
      return memEntry.token;
    }

    // Layer 2: Vercel KV (Upstash)
    const kv = getRedis();
    if (kv) {
      try {
        const kvEntry = await kv.get(cacheKey);
        if (kvEntry && typeof kvEntry === 'object' && kvEntry.expiresAt > now && kvEntry.token) {
          memCache.set(cacheKey, kvEntry);
          return kvEntry.token;
        }
      } catch (e) {
        // KV failure is not fatal — fall through to refresh
        console.warn(`[zoho-oauth] KV read failed for ${cacheKey}: ${e?.message}`);
      }
    }
  }

  // Layer 3: refresh from Zoho — dedupe concurrent callers within this instance
  const existing = inflight.get(cacheKey);
  if (existing) {
    stampedeCount++;
    if (stampedeCount === 1 || stampedeCount % STAMPEDE_WARN_INTERVAL === 0) {
      console.warn(`[zoho-oauth] stampede suppressed: ${cacheKey} (count=${stampedeCount})`);
    }
    return existing;
  }

  const promise = doRefresh(refreshTokenEnv, ttlMinutes, cacheKey).finally(() => {
    inflight.delete(cacheKey);
  });
  inflight.set(cacheKey, promise);
  return promise;
}

// ─── Refresh implementation ───────────────────────────────────

async function doRefresh(refreshTokenEnv, ttlMinutes, cacheKey) {
  const refreshToken = process.env[refreshTokenEnv];
  if (!refreshToken) {
    throw new ZohoOAuthError(`${refreshTokenEnv} not configured`, { code: 'config_missing' });
  }

  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new ZohoOAuthError('ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET not configured', {
      code: 'config_missing',
    });
  }

  let res;
  try {
    res = await fetch(ZOHO_ACCOUNTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
      }),
    });
  } catch (e) {
    throw new ZohoOAuthError(`Zoho token refresh network error: ${e?.message || e}`, {
      code: 'network',
      details: e,
    });
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new ZohoOAuthError(`Zoho token refresh failed: HTTP ${res.status}`, {
      httpStatus: res.status,
      code: 'http',
      details: text,
    });
  }

  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new ZohoOAuthError('Zoho refresh response was not JSON', {
      httpStatus: res.status,
      code: 'http',
      details: e?.message,
    });
  }

  if (data.error) {
    throw new ZohoOAuthError(`Zoho refresh API error: ${data.error}`, {
      httpStatus: 200,
      code: data.error,
      details: data,
    });
  }
  if (!data.access_token) {
    throw new ZohoOAuthError('Zoho refresh response missing access_token', {
      httpStatus: 200,
      code: 'missing_token',
      details: data,
    });
  }

  const expiresAt = Date.now() + ttlMinutes * 60 * 1000;
  const entry = { token: data.access_token, expiresAt };

  memCache.set(cacheKey, entry);

  const kv = getRedis();
  if (kv) {
    try {
      await kv.set(cacheKey, entry, { ex: ttlMinutes * 60 });
    } catch (e) {
      console.warn(`[zoho-oauth] KV write failed for ${cacheKey}: ${e?.message}`);
    }
  }

  return data.access_token;
}
