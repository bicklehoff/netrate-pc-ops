// Zoho Bookings API Client
// Fetches available slots, books appointments.
// Uses same Zoho OAuth Self Client as other integrations (shared client_id/client_secret).
//
// Env vars required:
//   ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET — shared across all Zoho integrations
//   ZOHO_BOOKINGS_REFRESH_TOKEN — Bookings-scoped refresh token

const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.com/oauth/v2/token';
const BOOKINGS_BASE = 'https://www.zohoapis.com/bookings/v1/json';

// NetRate Mortgage workspace + service IDs
const WORKSPACE_ID = '4637398000002317013';
const SERVICE_ID = '4637398000002317033';
const STAFF_ID = '4637398000000041008';

// ─── Token Management ─────────────────────────────────────────

let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const refreshToken = process.env.ZOHO_BOOKINGS_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error('ZOHO_BOOKINGS_REFRESH_TOKEN not configured');
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.ZOHO_CLIENT_ID,
    client_secret: process.env.ZOHO_CLIENT_SECRET,
    refresh_token: refreshToken,
  });

  const res = await fetch(ZOHO_ACCOUNTS_URL, {
    method: 'POST',
    body: params,
  });

  if (!res.ok) {
    throw new Error(`Zoho token refresh failed: ${res.status}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(`Zoho token error: ${data.error}`);
  }

  cachedToken = data.access_token;
  tokenExpiry = Date.now() + 50 * 60 * 1000; // Cache for 50 min (expires in 60)
  return cachedToken;
}

// ─── API Helpers ──────────────────────────────────────────────

async function bookingsGet(endpoint, params = {}) {
  const token = await getAccessToken();
  const url = new URL(`${BOOKINGS_BASE}/${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Zoho Bookings API error: ${res.status}`);
  }

  const data = await res.json();
  return data.response;
}

async function bookingsPost(endpoint, formFields = {}) {
  const token = await getAccessToken();
  const form = new URLSearchParams();
  Object.entries(formFields).forEach(([k, v]) => {
    form.set(k, typeof v === 'object' ? JSON.stringify(v) : v);
  });

  const res = await fetch(`${BOOKINGS_BASE}/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  if (!res.ok) {
    throw new Error(`Zoho Bookings API error: ${res.status}`);
  }

  const data = await res.json();
  return data.response;
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Fetch available time slots for a given date.
 * @param {string} date — format: "dd-MMM-yyyy" e.g. "20-Mar-2026"
 * @returns {Promise<{ slots: string[], timeZone: string }>}
 */
export async function getAvailableSlots(date) {
  const resp = await bookingsGet('availableslots', {
    service_id: SERVICE_ID,
    staff_id: STAFF_ID,
    selected_date: date,
  });

  const rv = resp.returnvalue;
  if (!rv || !rv.data || !Array.isArray(rv.data)) {
    return { slots: [], timeZone: rv?.time_zone || 'America/Denver' };
  }

  return {
    slots: rv.data,
    timeZone: rv.time_zone || 'America/Denver',
  };
}

/**
 * Book an appointment.
 * @param {Object} params
 * @param {string} params.date — "dd-MMM-yyyy" e.g. "20-Mar-2026"
 * @param {string} params.time — "hh:mm AM/PM" e.g. "10:00 AM"
 * @param {string} params.name
 * @param {string} params.email
 * @param {string} params.phone
 * @param {string} [params.notes]
 * @returns {Promise<Object>} booking confirmation from Zoho
 */
export async function bookAppointment({ date, time, name, email, phone, notes }) {
  // Convert "10:00 AM" to 24hr "10:00:00" for from_time
  const [timePart, ampm] = time.split(' ');
  let [hours, minutes] = timePart.split(':').map(Number);
  if (ampm === 'PM' && hours !== 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;
  const time24 = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;

  const fromTime = `${date} ${time24}`;

  const fields = {
    service_id: SERVICE_ID,
    staff_id: STAFF_ID,
    from_time: fromTime,
    timezone: 'America/Denver',
    customer_details: { name, email, phone_number: phone },
  };

  if (notes) {
    fields.notes = notes;
  }

  const resp = await bookingsPost('appointment', fields);

  if (resp.status !== 'success') {
    throw new Error(resp.returnvalue?.message || 'Booking failed');
  }

  return resp.returnvalue;
}

/**
 * Get service info (name, duration, etc.)
 */
export async function getServiceInfo() {
  const resp = await bookingsGet('services', {
    workspace_id: WORKSPACE_ID,
    service_id: SERVICE_ID,
  });

  const services = resp.returnvalue?.data;
  if (!services || services.length === 0) return null;

  const s = services[0];
  return {
    id: s.id,
    name: s.name,
    duration: s.duration,
    price: s.price,
    currency: s.currency,
  };
}
