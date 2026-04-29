/**
 * Rate-alerts slice — DAL.
 *
 * Subscriptions table created by migration 053 per UAD AD-10a. A `rate_alert`
 * row references a `scenarios` row (the immutable pricing snapshot the
 * subscription is "watching") and carries the mutable lifecycle: cadence,
 * status, last sent, send count, unsub token.
 *
 * Slice ownership rule (per Phase 2 spec §3): if a function reads or writes
 * the `rate_alerts` table, it lives here. Functions that produce a rate-alert
 * shape from a scenario row also live in this slice (transform.js).
 *
 * Phase 2 invariant: this file's helpers exist but no live consumer calls
 * them yet. Phase 3 sub-PR 3a wires them in.
 */

import sql from '@/lib/db';

// ─── CREATE ────────────────────────────────────────────────────────

/**
 * Create a rate alert subscription on an existing scenario.
 *
 * Throws if a rate_alert row already exists for the scenario (UNIQUE
 * constraint on scenario_id). Caller should query first via
 * getRateAlertByScenarioId() if they want upsert semantics.
 *
 * @param {object} data
 * @param {string} data.scenarioId - REQUIRED. FK to scenarios.id.
 * @param {string} data.organizationId - REQUIRED.
 * @param {string|null} [data.contactId]
 * @param {string|null} [data.leadId]
 * @param {string} [data.alertStatus] - 'active' (default), 'paused',
 *   'triggered', 'unsubscribed'.
 * @param {string|null} [data.alertFrequency] - 'daily' | '2x_week' | 'weekly'
 *   | 'manual' | null.
 * @param {string[]|null} [data.alertDays] - e.g. ['mon','wed','fri'].
 * @param {string|null} [data.unsubToken] - Pre-generated unsub token. Caller
 *   decides whether to populate.
 * @returns {Promise<object>} The created rate_alert row.
 */
export async function createRateAlert({
  scenarioId,
  organizationId,
  contactId = null,
  leadId = null,
  alertStatus = 'active',
  alertFrequency = null,
  alertDays = null,
  unsubToken = null,
}) {
  if (!scenarioId) throw new Error('createRateAlert: scenarioId is required');
  if (!organizationId) throw new Error('createRateAlert: organizationId is required');

  const result = await sql.query(
    `INSERT INTO rate_alerts (
      id, organization_id, scenario_id, contact_id, lead_id,
      alert_status, alert_frequency, alert_days,
      unsub_token, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), $1, $2, $3, $4,
      $5, $6, $7::text[],
      $8, NOW(), NOW()
    ) RETURNING *`,
    [
      organizationId,
      scenarioId,
      contactId,
      leadId,
      alertStatus,
      alertFrequency,
      alertDays,
      unsubToken,
    ],
  );
  return result.rows[0];
}

// ─── READ ──────────────────────────────────────────────────────────

/**
 * Get a rate alert by primary key, scoped to an organization.
 * @param {string} id
 * @param {string} orgId
 * @returns {Promise<object|null>}
 */
export async function getRateAlertById(id, orgId) {
  const rows = await sql`
    SELECT * FROM rate_alerts
    WHERE id = ${id} AND organization_id = ${orgId}
    LIMIT 1
  `;
  return rows[0] || null;
}

/**
 * Get a rate alert by its unsub token. Org-unscoped because the token
 * IS the auth (used by /api/saved-scenario/unsubscribe and similar
 * borrower-magic-link entry points).
 *
 * @param {string} token
 * @returns {Promise<object|null>}
 */
export async function getRateAlertByUnsubToken(token) {
  if (!token) return null;
  const rows = await sql`
    SELECT * FROM rate_alerts
    WHERE unsub_token = ${token}
    LIMIT 1
  `;
  return rows[0] || null;
}

/**
 * Get the rate_alert row for a given scenario_id (or null if none exists).
 * Useful during the Phase 3 transition window when a caller has a scenario
 * and wants to know if an alert subscription exists for it.
 *
 * @param {string} scenarioId
 * @param {string} orgId
 * @returns {Promise<object|null>}
 */
export async function getRateAlertByScenarioId(scenarioId, orgId) {
  const rows = await sql`
    SELECT * FROM rate_alerts
    WHERE scenario_id = ${scenarioId} AND organization_id = ${orgId}
    LIMIT 1
  `;
  return rows[0] || null;
}

/**
 * List rate_alerts with optional filters. Returned rows are plain rate_alert
 * shape — caller JOINs scenarios separately for the input snapshot if needed.
 *
 * @param {object} [filters]
 * @param {string} filters.orgId - REQUIRED for multi-tenant scoping.
 * @param {string} [filters.contactId]
 * @param {string} [filters.alertStatus]
 * @returns {Promise<object[]>}
 */
export async function listRateAlerts({ orgId, contactId = null, alertStatus = null } = {}) {
  if (!orgId) throw new Error('listRateAlerts: orgId is required');

  const where = [`organization_id = $1`];
  const params = [orgId];
  let p = 2;

  if (contactId) {
    where.push(`contact_id = $${p++}`);
    params.push(contactId);
  }
  if (alertStatus) {
    where.push(`alert_status = $${p++}`);
    params.push(alertStatus);
  }

  const result = await sql.query(
    `SELECT * FROM rate_alerts WHERE ${where.join(' AND ')} ORDER BY updated_at DESC`,
    params,
  );
  return result.rows;
}

// ─── UPDATE ────────────────────────────────────────────────────────

/**
 * Update mutable fields on a rate_alert. Allowlist:
 *   - alert_status, alert_frequency, alert_days
 *   - last_priced_at, last_sent_at, send_count
 *   - contact_id (when borrower converts from anon → contact)
 *
 * Throws on disallowed keys. NOT a soft-deprecation surface — this is a
 * brand-new function; callers know what they're calling.
 *
 * @param {string} id
 * @param {string} orgId
 * @param {object} fields
 * @returns {Promise<object|null>} Updated row or null if not found.
 */
export async function updateRateAlert(id, orgId, fields) {
  const allowedCols = new Set([
    'alert_status', 'alert_frequency', 'alert_days',
    'last_priced_at', 'last_sent_at', 'send_count',
    'contact_id',
  ]);

  const setClauses = [];
  const params = [id, orgId];
  let paramIdx = 3;

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (!allowedCols.has(key)) {
      throw new Error(`updateRateAlert: disallowed field "${key}". Allowed: ${[...allowedCols].join(', ')}`);
    }
    if (key === 'alert_days') {
      setClauses.push(`${key} = $${paramIdx}::text[]`);
    } else {
      setClauses.push(`${key} = $${paramIdx}`);
    }
    params.push(value);
    paramIdx++;
  }

  if (setClauses.length === 0) return null;

  setClauses.push('updated_at = NOW()');

  const query = `
    UPDATE rate_alerts
    SET ${setClauses.join(', ')}
    WHERE id = $1 AND organization_id = $2
    RETURNING *
  `;
  const result = await sql.query(query, params);
  return result.rows[0] || null;
}
