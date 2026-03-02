// Zoho Voice SMS Client
// Sends SMS via Zoho Voice REST API.
// Used for 2FA verification codes and transactional notifications.

const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.com/oauth/v2/token';
const ZOHO_VOICE_SMS_URL = 'https://voice.zoho.com/rest/json/v1/sms/send';

/**
 * Refresh Zoho OAuth access token for Voice API.
 * Uses the same client_id/client_secret as CRM, with a Voice-scoped refresh token.
 */
async function getZohoVoiceToken() {
  const res = await fetch(ZOHO_ACCOUNTS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: process.env.ZOHO_VOICE_REFRESH_TOKEN,
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zoho Voice token refresh failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error('No access token in Zoho Voice response');
  }

  return data.access_token;
}

/**
 * Send an SMS via Zoho Voice.
 * @param {string} to - Recipient phone number (E.164 format, e.g. "+15551234567")
 * @param {string} message - SMS body (max 1000 chars)
 * @returns {Promise<object>} Zoho Voice API response
 */
export async function sendSms(to, message) {
  const accessToken = await getZohoVoiceToken();

  const res = await fetch(ZOHO_VOICE_SMS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      senderId: process.env.ZOHO_VOICE_SENDER_NUMBER,
      customerNumber: to,
      message,
    }),
  });

  const data = await res.json();

  if (!res.ok || data.code !== 'ZVSMS-2000') {
    console.error('Zoho Voice SMS error:', data);
    throw new Error(`SMS send failed: ${data.message || data.code || res.status}`);
  }

  return data;
}
