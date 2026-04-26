// Zoho Bookings client — server-side, built on the shared OAuth substrate.
//
// Replaces the stale src/lib/zoho-bookings.js (deleted in PR #205). Uses the
// new ZOHO_BOOKINGS_* workspace IDs Claw verified during Phase 0, the
// shared lib/zoho/oauth substrate (KV cache + dedup + typed errors), and
// multipart/form-data for appointment creation per Zoho's API requirements.
//
// Env vars required:
//   ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET — shared Self Client credentials
//   ZOHO_BOOKINGS_REFRESH_TOKEN — Bookings-scoped refresh token (least-privilege:
//     a separate token per Zoho integration, matching the existing pattern for
//     WorkDrive/Sign. Avoids blast radius on token leak + avoids the re-consent
//     fragility that broke us 2026-04-26 when Phase 0 added CREATE to the Mail
//     token but dropped READ).
//   ZOHO_BOOKINGS_WORKSPACE_ID, ZOHO_BOOKINGS_SERVICE_ID, ZOHO_BOOKINGS_STAFF_ID
//   ZOHO_BOOKINGS_TIMEZONE — e.g. "America/Denver"
//
// Critical Zoho gotchas (per Claw dev brief, source of #1 cause of 400s):
//   - /appointment is multipart/form-data NOT JSON
//   - Date format is dd-MMM-yyyy HH:mm:ss (3-letter month, leading-zero hours)
//   - customer_details is a JSON STRING field, not nested form data
//   - Response shape is response.returnvalue.data (double-nested)
//   - booking_id includes literal "#" prefix — URL-encode as %23 in query strings

import { getZohoToken, ZohoOAuthError } from './oauth';

const BOOKINGS_BASE = 'https://www.zohoapis.com/bookings/v1/json';
const REFRESH_TOKEN_ENV = 'ZOHO_BOOKINGS_REFRESH_TOKEN';

// ─── Errors ───────────────────────────────────────────────────

/**
 * Typed error for Zoho Bookings API failures. Routes can branch on httpStatus.
 *
 * @property {number|undefined} httpStatus — HTTP status from Zoho, if any
 * @property {string|undefined} code — discriminator: 'config' | 'oauth' | 'http' | 'api'
 * @property {*} details — raw response body or error
 */
export class ZohoBookingsError extends Error {
  constructor(message, { httpStatus, code, details } = {}) {
    super(message);
    this.name = 'ZohoBookingsError';
    this.httpStatus = httpStatus;
    this.code = code;
    this.details = details;
  }
}

// ─── Config helpers ───────────────────────────────────────────

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new ZohoBookingsError(`${name} not configured`, { code: 'config' });
  return v;
}

function getConfig() {
  return {
    workspaceId: requireEnv('ZOHO_BOOKINGS_WORKSPACE_ID'),
    serviceId: requireEnv('ZOHO_BOOKINGS_SERVICE_ID'),
    staffId: requireEnv('ZOHO_BOOKINGS_STAFF_ID'),
    timezone: process.env.ZOHO_BOOKINGS_TIMEZONE || 'America/Denver',
  };
}

async function authHeader() {
  try {
    const token = await getZohoToken({ refreshTokenEnv: REFRESH_TOKEN_ENV });
    return `Zoho-oauthtoken ${token}`;
  } catch (e) {
    if (e instanceof ZohoOAuthError) {
      throw new ZohoBookingsError(`OAuth refresh failed: ${e.message}`, {
        code: 'oauth',
        details: e,
      });
    }
    throw e;
  }
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Fetch available appointment slots for a date.
 *
 * @param {string} date — Zoho format: "dd-MMM-yyyy" e.g. "27-Apr-2026"
 * @param {object} [opts]
 * @param {boolean} [opts.halfHourOnly=true] — filter to :00 and :30 boundaries
 * @returns {Promise<{slots: string[], timeZone: string}>} slots are display strings like "10:00 AM"
 * @throws {ZohoBookingsError}
 */
export async function getAvailableSlots(date, { halfHourOnly = true } = {}) {
  const cfg = getConfig();
  const url = new URL(`${BOOKINGS_BASE}/availableslots`);
  url.searchParams.set('service_id', cfg.serviceId);
  url.searchParams.set('staff_id', cfg.staffId);
  url.searchParams.set('selected_date', date);

  const auth = await authHeader();
  let res;
  try {
    res = await fetch(url.toString(), { headers: { Authorization: auth } });
  } catch (e) {
    throw new ZohoBookingsError(`Network error fetching slots: ${e?.message}`, {
      code: 'http',
      details: e,
    });
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ZohoBookingsError(`Slots fetch failed: HTTP ${res.status}`, {
      httpStatus: res.status,
      code: 'http',
      details: body,
    });
  }

  const json = await res.json();
  const rv = json?.response?.returnvalue;
  if (!rv) {
    throw new ZohoBookingsError('Unexpected response shape (missing response.returnvalue)', {
      code: 'api',
      details: json,
    });
  }

  const allSlots = Array.isArray(rv.data) ? rv.data : [];
  const slots = halfHourOnly ? allSlots.filter(isHalfHourBoundary) : allSlots;

  return {
    slots,
    timeZone: rv.time_zone || cfg.timezone,
  };
}

/**
 * Book an appointment.
 *
 * @param {object} params
 * @param {string} params.date — "dd-MMM-yyyy" e.g. "27-Apr-2026"
 * @param {string} params.time — "hh:mm AM/PM" e.g. "10:00 AM" (display format from getAvailableSlots)
 * @param {string} params.name — full name
 * @param {string} params.email
 * @param {string} params.phone
 * @param {string} [params.notes] — optional, sent as Zoho notes field
 * @param {object} [params.customFields] — optional intake field map (loan_purpose, etc.)
 * @returns {Promise<{bookingId: string, status: string, summary: object}>}
 * @throws {ZohoBookingsError}
 */
export async function bookAppointment({ date, time, name, email, phone, notes, customFields }) {
  const cfg = getConfig();
  const fromTime = `${date} ${to24h(time)}`; // dd-MMM-yyyy HH:mm:ss

  // multipart/form-data with customer_details as JSON STRING (not nested form fields)
  const form = new FormData();
  form.append('service_id', cfg.serviceId);
  form.append('staff_id', cfg.staffId);
  form.append('from_time', fromTime);
  form.append('timezone', cfg.timezone);
  form.append(
    'customer_details',
    JSON.stringify({ name, email, phone_number: phone, ...(customFields || {}) })
  );
  if (notes) form.append('notes', notes);

  const auth = await authHeader();
  let res;
  try {
    res = await fetch(`${BOOKINGS_BASE}/appointment`, {
      method: 'POST',
      headers: { Authorization: auth }, // Don't set Content-Type — fetch sets multipart boundary
      body: form,
    });
  } catch (e) {
    throw new ZohoBookingsError(`Network error creating booking: ${e?.message}`, {
      code: 'http',
      details: e,
    });
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ZohoBookingsError(`Booking create failed: HTTP ${res.status}`, {
      httpStatus: res.status,
      code: 'http',
      details: body,
    });
  }

  const json = await res.json();
  const resp = json?.response;
  if (!resp || resp.status !== 'success') {
    const msg = resp?.returnvalue?.message || 'Booking failed';
    throw new ZohoBookingsError(msg, {
      httpStatus: 200,
      code: 'api',
      details: json,
    });
  }

  // Response shape: response.returnvalue.data (double-nested per Claw spec)
  const rv = resp.returnvalue;
  const data = rv?.data || rv;

  return {
    bookingId: data?.booking_id || data?.id || null, // Includes "#" prefix per Zoho convention
    status: data?.status || 'success',
    summary: data,
  };
}

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Convert "10:00 AM" → "10:00:00" (24h, with seconds).
 * Matches Zoho's required HH:mm:ss in the from_time field.
 */
function to24h(displayTime) {
  const [timePart, ampm] = String(displayTime).trim().split(/\s+/);
  if (!timePart || !ampm) {
    throw new ZohoBookingsError(`Invalid time format: "${displayTime}" (expected "h:mm AM/PM")`, {
      code: 'api',
    });
  }
  let [h, m] = timePart.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) {
    throw new ZohoBookingsError(`Invalid time numbers in "${displayTime}"`, { code: 'api' });
  }
  const upper = ampm.toUpperCase();
  if (upper === 'PM' && h !== 12) h += 12;
  if (upper === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

/**
 * Filter to slots starting at :00 or :30 minutes (drop :15, :45 etc.).
 * Zoho returns 15-min granularity; our consultation cadence is 30-min.
 */
function isHalfHourBoundary(displayTime) {
  const m = String(displayTime).match(/:(\d{2})/);
  if (!m) return false;
  const minutes = parseInt(m[1], 10);
  return minutes === 0 || minutes === 30;
}
