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
 * Build TwiML to route an incoming call to an MLO.
 * Rings the browser client AND the MLO's personal cell in parallel inside a
 * single <Dial> — first to answer wins. If neither answers in 30s, falls
 * through to voicemail.
 * @param {string} clientIdentity - The Twilio Client identity to ring (e.g. "mlo-uuid")
 * @param {string} [callerName] - Optional name to display on the browser client
 * @param {string} [fallbackNumber] - MLO's personal cell (E.164) for parallel ring
 * @returns {string} TwiML XML
 */
function xmlAttrEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildIncomingTwiml(clientIdentity, callerName, fallbackNumber, contactId) {
  // The url= on <Number> fires /api/dialer/whisper when the cell leg answers,
  // BEFORE the caller is bridged. Whisper plays privately to the MLO so they
  // hear "NetRate Mortgage call from {name}" before connecting to the caller.
  //
  // callerName + contactId are passed as TwiML <Parameter>s on the <Client>
  // so the browser dialer can show caller info on ring AND link "Open contact"
  // from the sticky popup during/after the call.
  const nameParam = callerName
    ? `<Parameter name="callerName" value="${xmlAttrEscape(callerName)}" />`
    : '';
  const contactIdParam = contactId
    ? `<Parameter name="contactId" value="${xmlAttrEscape(contactId)}" />`
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="30" action="/api/dialer/call-complete">
    <Client>
      <Identity>${clientIdentity}</Identity>
      ${nameParam}
      ${contactIdParam}
    </Client>
    ${fallbackNumber ? `<Number url="/api/dialer/whisper">${fallbackNumber}</Number>` : ''}
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
 * Routes through the Messaging Service (for A2P 10DLC campaign compliance)
 * when TWILIO_MESSAGING_SERVICE_SID is set; the service MUST contain every
 * number we'd want to send from. When `from` is provided, Twilio uses it as
 * the explicit sender — the number must be in the service's pool.
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
  // Route through Messaging Service whenever configured — this is what attaches
  // the outbound to our registered A2P campaign. Sending with a bare `From` (no
  // service) is non-compliant for business messaging and Twilio rejects it.
  if (process.env.TWILIO_MESSAGING_SERVICE_SID) {
    params.MessagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    if (from) params.From = from; // explicit sender selection within the service
  } else if (from) {
    params.From = from;
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
