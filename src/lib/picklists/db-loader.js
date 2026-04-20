/**
 * Picklists DAL — server-only reads from ref_licensed_states + ref_loan_types.
 *
 * In-memory TTL cache keyed by request shape. Serverless instance lifetime
 * bounds the cache; first call per instance hits DB, subsequent calls
 * within TTL serve memory. Mirrors the site_scenarios / surface_pricing_config
 * pattern (migration 010).
 *
 * Consumers:
 *   - /api/picklists (route serves JSON for client components)
 *   - Server components that can inject picklists as props
 *
 * Client components: fetch via /api/picklists (see src/lib/picklists/client.js).
 */

import sql from '@/lib/db';

const TTL_MS = 10 * 60 * 1000; // 10 minutes

const cache = new Map(); // key → { data, expiresAt }

function getCached(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return hit.data;
}

function setCached(key, data) {
  cache.set(key, { data, expiresAt: Date.now() + TTL_MS });
  return data;
}

/**
 * Licensed states — returns active-first, then all, in display_order.
 * @param {object} opts
 * @param {boolean} opts.activeOnly — return only NMLS-licensed states
 * @returns {Promise<Array<{ value: string, label: string, is_active: boolean }>>}
 */
export async function getLicensedStates({ activeOnly = false } = {}) {
  const key = `states:${activeOnly ? 'active' : 'all'}`;
  const hit = getCached(key);
  if (hit) return hit;

  const rows = activeOnly
    ? await sql`SELECT code, name, is_active FROM ref_licensed_states WHERE is_active = true ORDER BY display_order ASC`
    : await sql`SELECT code, name, is_active FROM ref_licensed_states ORDER BY display_order ASC`;

  const data = rows.map((r) => ({
    value: r.code,
    label: r.name,
    is_active: r.is_active,
  }));
  return setCached(key, data);
}

/**
 * Loan types — returns active codes in sort_order. Legacy/inactive codes
 * (e.g. nonqm) hidden by default.
 * @param {object} opts
 * @param {boolean} opts.includeInactive
 * @returns {Promise<Array<{ value: string, label: string, category: string|null }>>}
 */
export async function getLoanTypes({ includeInactive = false } = {}) {
  const key = `loan_types:${includeInactive ? 'all' : 'active'}`;
  const hit = getCached(key);
  if (hit) return hit;

  const rows = includeInactive
    ? await sql`SELECT code, display_label, category, is_active FROM ref_loan_types ORDER BY sort_order ASC`
    : await sql`SELECT code, display_label, category, is_active FROM ref_loan_types WHERE is_active = true ORDER BY sort_order ASC`;

  const data = rows.map((r) => ({
    value: r.code,
    label: r.display_label,
    category: r.category,
  }));
  return setCached(key, data);
}

export function clearPicklistCache() {
  cache.clear();
}
