// Twilio Webhook Signature Validation
// Validates X-Twilio-Signature header to ensure webhook requests
// actually come from Twilio, not forged by external actors.
// See: https://www.twilio.com/docs/usage/security#validating-requests

import crypto from 'crypto';

const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

/**
 * Validate that a request came from Twilio by checking the X-Twilio-Signature header.
 *
 * @param {Request} req - The incoming request object
 * @param {Object} params - The parsed form data as a plain object
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateTwilioSignature(req, params) {
  if (!AUTH_TOKEN) {
    console.error('TWILIO_AUTH_TOKEN not set — cannot validate webhook signature');
    return { valid: false, error: 'Server misconfiguration' };
  }

  const signature = req.headers.get('x-twilio-signature');
  if (!signature) {
    return { valid: false, error: 'Missing X-Twilio-Signature header' };
  }

  // Build the full URL Twilio used to generate the signature.
  // On Vercel, we need the canonical URL (https, www subdomain).
  const url = getCanonicalUrl(req);

  // Sort the POST parameters alphabetically by key and concatenate key+value
  const sortedKeys = Object.keys(params).sort();
  let dataString = url;
  for (const key of sortedKeys) {
    dataString += key + (params[key] ?? '');
  }

  // HMAC-SHA1 with auth token, base64 encoded
  const expectedSignature = crypto
    .createHmac('sha1', AUTH_TOKEN)
    .update(dataString)
    .digest('base64');

  // Timing-safe comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length) {
    return { valid: false, error: 'Invalid signature' };
  }

  const valid = crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  return valid ? { valid: true } : { valid: false, error: 'Invalid signature' };
}

/**
 * Get the canonical URL for Twilio signature validation.
 * Twilio generates signatures using the URL configured in the webhook settings.
 * On Vercel behind a CDN, we must use the public-facing URL (https://www.netratemortgage.com).
 */
function getCanonicalUrl(req) {
  const url = new URL(req.url);
  // Use the configured base URL or reconstruct from headers
  const baseUrl = process.env.NEXTAUTH_URL || `https://${url.host}`;
  return `${baseUrl}${url.pathname}`;
}

/**
 * Helper to parse formData into a plain object (needed for signature computation).
 * Call this ONCE and pass the result to both validateTwilioSignature and your handler.
 */
export function formDataToObject(formData) {
  const obj = {};
  for (const [key, value] of formData.entries()) {
    obj[key] = value;
  }
  return obj;
}

/**
 * Standard 403 response for failed Twilio validation.
 */
export function twilioForbiddenResponse() {
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Unauthorized request.</Say></Response>',
    { status: 403, headers: { 'Content-Type': 'text/xml' } }
  );
}
