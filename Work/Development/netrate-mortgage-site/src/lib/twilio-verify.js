// Twilio Verify — OTP/2FA Service
// Handles sending and checking verification codes via Twilio Verify API.
// Twilio manages code generation, delivery, expiry, rate limiting, and fraud prevention.

const TWILIO_VERIFY_BASE = 'https://verify.twilio.com/v2';

/**
 * Normalize a US phone number to E.164 format (+1XXXXXXXXXX).
 * Handles formats like "(720) 499-8384", "720-499-8384", "7204998384", "+17204998384".
 */
function toE164(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`; // Already has country code or international
}

function getAuthHeader() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  return 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64');
}

/**
 * Send a verification code via SMS.
 * @param {string} to - Phone number in E.164 format (e.g. "+15551234567")
 * @returns {Promise<object>} Twilio Verify response with status "pending"
 */
export async function sendVerification(to) {
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  const e164 = toE164(to);

  const res = await fetch(
    `${TWILIO_VERIFY_BASE}/Services/${serviceSid}/Verifications`,
    {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: e164, Channel: 'sms' }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    console.error('Twilio Verify send error:', data);
    throw new Error(data.message || `Twilio Verify failed: ${res.status}`);
  }

  return data;
}

/**
 * Check a verification code.
 * @param {string} to - Phone number in E.164 format (must match the send)
 * @param {string} code - The 6-digit code the user entered
 * @returns {Promise<{ valid: boolean, status: string }>}
 */
export async function checkVerification(to, code) {
  const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
  const e164 = toE164(to);

  const res = await fetch(
    `${TWILIO_VERIFY_BASE}/Services/${serviceSid}/VerificationCheck`,
    {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: e164, Code: code }),
    }
  );

  const data = await res.json();

  if (!res.ok) {
    console.error('Twilio Verify check error:', data);
    throw new Error(data.message || `Twilio Verify check failed: ${res.status}`);
  }

  return { valid: data.status === 'approved', status: data.status };
}
