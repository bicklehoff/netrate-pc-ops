// Twilio Voice — Token Generation & TwiML Helpers
// Handles Access Token creation for the Twilio Voice JS SDK (browser calling)
// and TwiML generation for call routing.

import crypto from 'crypto';

// Twilio Access Tokens are short-lived JWTs that grant the browser permission
// to make/receive calls via WebRTC. They contain a VoiceGrant that binds
// the token to a specific TwiML App (which defines the webhooks).

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_API_KEY = process.env.TWILIO_API_KEY;       // Starts with SK...
const TWILIO_API_SECRET = process.env.TWILIO_API_SECRET;
const TWILIO_TWIML_APP_SID = process.env.TWILIO_TWIML_APP_SID; // Starts with AP...
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;     // +1XXXXXXXXXX

/**
 * Generate a Twilio Access Token with a VoiceGrant for the browser SDK.
 *
 * Uses the Twilio REST API to create a token (no SDK dependency needed).
 * The token lets the browser register as a Twilio Client device and
 * make/receive calls.
 *
 * @param {string} identity - Unique identity for this client (e.g. mlo-uuid)
 * @returns {string} JWT access token string
 */
export function generateAccessToken(identity) {
  // Build JWT manually to avoid twilio SDK dependency (keep bundle small).
  // Twilio Access Tokens are standard JWTs with specific claims.

  const header = {
    typ: 'JWT',
    alg: 'HS256',
    cty: 'twilio-fpa;v=1',
  };

  const now = Math.floor(Date.now() / 1000);
  const ttl = 3600; // 1 hour

  const grants = {
    identity,
    voice: {
      incoming: { allow: true },
      outgoing: { application_sid: TWILIO_TWIML_APP_SID },
    },
  };

  const payload = {
    jti: `${TWILIO_API_KEY}-${now}`,
    iss: TWILIO_API_KEY,
    sub: TWILIO_ACCOUNT_SID,
    exp: now + ttl,
    grants,
  };

  // Encode JWT
  const encode = (obj) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64url');

  const segments = [encode(header), encode(payload)];
  const signingInput = segments.join('.');

  const signature = crypto
    .createHmac('sha256', TWILIO_API_SECRET)
    .update(signingInput)
    .digest('base64url');

  return `${signingInput}.${signature}`;
}

/**
 * Build TwiML for an outbound call (MLO → contact).
 * callerId is the MLO's own Twilio number (from staff.twilio_phone_number).
 * Falls back to TWILIO_PHONE_NUMBER only when the MLO has no number assigned.
 * @param {string} to - Phone number to dial (E.164)
 * @param {string} callerId - Caller ID to display
 * @returns {string} TwiML XML
 */
export function buildOutboundTwiml(to, callerId) {
  const resolvedCallerId = callerId || TWILIO_PHONE_NUMBER;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${resolvedCallerId}" record="record-from-answer-dual" recordingStatusCallback="/api/dialer/recording-status">
    <Number>${to}</Number>
  </Dial>
</Response>`;
}

/**
 * Build TwiML to route an incoming call to an MLO's browser client.
 * @param {string} clientIdentity - The Twilio Client identity to ring (e.g. "mlo-uuid")
 * @param {string} [callerName] - Optional name to display
 * @returns {string} TwiML XML
 */
export function buildIncomingTwiml(clientIdentity, callerName) {
  // Ring the browser client for 30s, if no answer go to voicemail
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="30" action="/api/dialer/call-complete">
    <Client>
      <Identity>${clientIdentity}</Identity>
      ${callerName ? `<Parameter name="callerName" value="${callerName}" />` : ''}
    </Client>
  </Dial>
  <Say>Sorry, no one is available to take your call. Please leave a message after the beep.</Say>
  <Record maxLength="120" transcribe="true" action="/api/dialer/voicemail" />
</Response>`;
}

/**
 * Build TwiML for voicemail fallback.
 * @returns {string} TwiML XML
 */
export function buildVoicemailTwiml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Thank you for your message. We will get back to you shortly.</Say>
  <Hangup />
</Response>`;
}

/**
 * Send an SMS via Twilio Programmable Messaging API.
 * When `from` is provided, sends explicitly from that number (per-staff routing).
 * When omitted, falls back to MessagingServiceSid (Twilio auto-selects) or the
 * legacy TWILIO_PHONE_NUMBER env var.
 * @param {string} to - Recipient phone (E.164)
 * @param {string} body - Message text
 * @param {string} [from] - Sender phone (E.164) — the MLO's staff.twilio_phone_number
 * @returns {Promise<object>} Twilio API response
 */
export async function sendSms(to, body, from) {
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');

  const params = {
    To: to,
    Body: body,
    StatusCallback: 'https://www.netratemortgage.com/api/dialer/sms/status',
  };
  if (from) {
    params.From = from;
  } else if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
    params.MessagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  } else {
    params.From = TWILIO_PHONE_NUMBER;
  }

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    console.error('Twilio SMS error:', data);
    throw new Error(data.message || `SMS send failed: ${res.status}`);
  }

  return data;
}

/**
 * Look up a phone number in the contacts DB by E.164 number.
 * Used to match incoming calls/SMS to existing contacts.
 */
export function getPhoneNumber() {
  return TWILIO_PHONE_NUMBER;
}
