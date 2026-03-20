#!/usr/bin/env node
/**
 * Upload rate JSON files to GCS bucket.
 *
 * Usage:
 *   node scripts/upload-to-gcs.js <local-file> <gcs-path>
 *
 * Examples:
 *   node scripts/upload-to-gcs.js src/data/rates/amwest.json live/amwest.json
 *   node scripts/upload-to-gcs.js src/data/rates/manifest.json live/manifest.json
 *
 * Requires GCS_SERVICE_ACCOUNT_KEY and GCS_BUCKET_NAME in .env
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BUCKET = process.env.GCS_BUCKET_NAME || 'netrate-rates';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
// Need read_write scope for uploads
const SCOPE = 'https://www.googleapis.com/auth/devstorage.read_write';

function getServiceAccountKey() {
  const raw = process.env.GCS_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('GCS_SERVICE_ACCOUNT_KEY not set in .env');
  return JSON.parse(raw);
}

/** Create a JWT and exchange it for an access token (pure Node.js, no jose) */
async function getAccessToken() {
  const key = getServiceAccountKey();

  // Build JWT header + payload
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: key.client_email,
    sub: key.client_email,
    aud: TOKEN_URL,
    scope: SCOPE,
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsigned = `${encode(header)}.${encode(payload)}`;

  // Sign with RSA-SHA256
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsigned);
  const signature = sign.sign(key.private_key, 'base64url');

  const jwt = `${unsigned}.${signature}`;

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
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function uploadToGCS(localPath, gcsPath) {
  const content = fs.readFileSync(localPath, 'utf-8');
  const token = await getAccessToken();

  const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=media&name=${encodeURIComponent(gcsPath)}`;

  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: content,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed: ${res.status} ${text}`);
  }

  const result = await res.json();
  return result;
}

// ── CLI ──────────────────────────────────────────────────────

const localFile = process.argv[2];
const gcsPath = process.argv[3];

if (!localFile || !gcsPath) {
  console.error('Usage: node scripts/upload-to-gcs.js <local-file> <gcs-path>');
  console.error('  e.g. node scripts/upload-to-gcs.js src/data/rates/amwest.json live/amwest.json');
  process.exit(1);
}

const fullPath = path.resolve(localFile);
if (!fs.existsSync(fullPath)) {
  console.error(`File not found: ${fullPath}`);
  process.exit(1);
}

console.log(`Uploading ${fullPath} → gs://${BUCKET}/${gcsPath}`);

uploadToGCS(fullPath, gcsPath)
  .then((result) => {
    console.log(`✓ Uploaded successfully`);
    console.log(`  Bucket: ${result.bucket}`);
    console.log(`  Object: ${result.name}`);
    console.log(`  Size: ${result.size} bytes`);
    console.log(`  Updated: ${result.updated}`);
  })
  .catch((err) => {
    console.error(`✗ ${err.message}`);
    if (err.message.includes('403')) {
      console.error('\nThe service account needs "Storage Object Creator" or "Storage Object Admin" role.');
      console.error('Go to: https://console.cloud.google.com/iam-admin/iam?project=netrate-mortgage');
      console.error('Find: website-rates-reader@netrate-mortgage.iam.gserviceaccount.com');
      console.error('Add role: Storage Object Creator');
    }
    process.exit(1);
  });
