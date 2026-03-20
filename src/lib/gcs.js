// Google Cloud Storage — Authenticated fetch using service account JWT
// Uses the 'jose' library (already a dependency) to sign JWTs for GCS access.
// No additional npm packages needed.

import { SignJWT, importPKCS8 } from 'jose';

const GCS_API = 'https://storage.googleapis.com/storage/v1/b';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/devstorage.read_only';

// Cache the access token (valid for 1 hour, we refresh at 50 min)
let tokenCache = { token: null, expiresAt: 0 };

function getServiceAccountKey() {
  const raw = process.env.GCS_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    console.error('Failed to parse GCS_SERVICE_ACCOUNT_KEY');
    return null;
  }
}

async function getAccessToken() {
  const now = Date.now();

  // Return cached token if still valid (with 10-min buffer)
  if (tokenCache.token && now < tokenCache.expiresAt - 10 * 60 * 1000) {
    return tokenCache.token;
  }

  const key = getServiceAccountKey();
  if (!key) throw new Error('GCS_SERVICE_ACCOUNT_KEY not configured');

  const privateKey = await importPKCS8(key.private_key, 'RS256');

  // Create a signed JWT for Google OAuth2
  const jwt = await new SignJWT({
    scope: SCOPE,
  })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(key.client_email)
    .setSubject(key.client_email)
    .setAudience(TOKEN_URL)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);

  // Exchange JWT for access token
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GCS token exchange failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  tokenCache = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return data.access_token;
}

/**
 * Fetch a file from a private GCS bucket using service account auth.
 * Returns the parsed JSON content.
 */
export async function fetchGCSFile(bucket, path) {
  const token = await getAccessToken();
  const encodedPath = encodeURIComponent(path);

  const res = await fetch(
    `${GCS_API}/${bucket}/o/${encodedPath}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    }
  );

  if (!res.ok) {
    throw new Error(`GCS fetch ${path}: ${res.status}`);
  }

  return res.json();
}

/**
 * Check if GCS service account is configured.
 */
export function isGCSConfigured() {
  return !!process.env.GCS_SERVICE_ACCOUNT_KEY;
}
