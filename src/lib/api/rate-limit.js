// Sliding-window rate limiter backed by Upstash Redis.
//
// Usage (at the top of a route handler):
//   const limited = await rateLimit(request, { scope: 'strike-rate', limit: 5, window: '1 m' });
//   if (limited) return limited;
//
// Fails OPEN when Upstash env vars are missing (local dev, previews without
// integration, brief Upstash outage). Logs the fallback so it's visible in
// Vercel function logs. Never throws into the caller — a dead rate limiter
// must not take down the endpoint it's trying to protect.
//
// Vercel's Upstash marketplace integration sets KV_REST_API_URL +
// KV_REST_API_TOKEN (legacy Vercel KV naming). We read those directly instead
// of Redis.fromEnv() which looks for UPSTASH_REDIS_REST_*.

import { NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let redisClient = null;
function getRedis() {
  if (redisClient) return redisClient;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  redisClient = new Redis({ url, token });
  return redisClient;
}

// One Ratelimit instance per (scope, limit, window) tuple. Instances are cheap
// but caching avoids re-parsing the window string on every request.
const limiterCache = new Map();
function getLimiter(scope, limit, window) {
  const key = `${scope}:${limit}:${window}`;
  if (limiterCache.has(key)) return limiterCache.get(key);
  const redis = getRedis();
  if (!redis) return null;
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    analytics: false,
    prefix: `rl:${scope}`,
  });
  limiterCache.set(key, limiter);
  return limiter;
}

function clientIp(request) {
  // Vercel sets x-forwarded-for; take the first hop.
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}

export async function rateLimit(request, { scope, limit, window }) {
  const limiter = getLimiter(scope, limit, window);
  if (!limiter) {
    // Fail-open. Log once per cold start so it shows in Vercel logs without
    // spamming; cache miss above is 1-per-process.
    if (!limiterCache.has(`_warned:${scope}`)) {
      console.warn(`[rate-limit] ${scope}: KV_REST_API_URL or KV_REST_API_TOKEN missing — failing open`);
      limiterCache.set(`_warned:${scope}`, true);
    }
    return null;
  }

  const ip = clientIp(request);
  try {
    const { success, limit: max, remaining, reset } = await limiter.limit(ip);
    if (success) return null;
    const retryAfterSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSec),
          'X-RateLimit-Limit': String(max),
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset': String(Math.ceil(reset / 1000)),
        },
      }
    );
  } catch (err) {
    // Upstash unreachable — fail open rather than break the endpoint.
    console.error(`[rate-limit] ${scope}: limiter error, failing open:`, err?.message);
    return null;
  }
}
