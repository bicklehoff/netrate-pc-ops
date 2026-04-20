/**
 * DAL for site_scenarios + surface_pricing_config tables (D9b.5 + D9b.6).
 *
 * Replaces hardcoded DEFAULT_SCENARIO + hardcoded exclude* kwargs in
 * server-side pricing call sites. Deploy-safe — if the DB read fails
 * (table doesn't exist yet, connection issue, etc.) both readers fall
 * back to the legacy hardcoded values so homepage rate card keeps
 * rendering. The DB is the source of truth; the constants are a
 * last-known-good mirror kept for deploy ordering flexibility.
 *
 * Cache: 10-min module-level. These rows change rarely (admin tuning);
 * a 10-min lag on a ref-data change is fine. If we need faster busting
 * later, key the cache on an updated_at tick.
 */

import sql from '@/lib/db';
import { DEFAULT_SCENARIO } from './defaults';

const CACHE_TTL_MS = 10 * 60 * 1000;

const scenarioCache = new Map(); // slug → { data, fetchedAt }
const surfaceCache = new Map(); // surface → { data, fetchedAt }

/**
 * @typedef {object} SiteScenario
 * @property {number} loanAmount
 * @property {number} propertyValue
 * @property {number} fico
 * @property {string} loanPurpose
 * @property {string} propertyType
 * @property {string} state
 * @property {number} lockDays
 * @property {number} term
 */

/**
 * Load a named site scenario by slug (e.g. 'homepage_default').
 * Returns the scenario fields in the shape priceScenario() expects.
 * Falls back to DEFAULT_SCENARIO on any DB read failure.
 *
 * @param {string} slug
 * @returns {Promise<SiteScenario>}
 */
export async function loadSiteScenario(slug) {
  const now = Date.now();
  const hit = scenarioCache.get(slug);
  if (hit && now - hit.fetchedAt < CACHE_TTL_MS) return hit.data;

  try {
    const rows = await sql`
      SELECT loan_amount, property_value, fico, loan_purpose,
             property_type, state, lock_days, term
      FROM site_scenarios
      WHERE slug = ${slug}
      LIMIT 1
    `;
    const row = rows[0];
    if (row) {
      const data = {
        loanAmount: Number(row.loan_amount),
        propertyValue: Number(row.property_value),
        fico: Number(row.fico),
        loanPurpose: row.loan_purpose,
        propertyType: row.property_type,
        state: row.state,
        lockDays: Number(row.lock_days),
        term: Number(row.term),
      };
      scenarioCache.set(slug, { data, fetchedAt: now });
      return data;
    }
  } catch (err) {
    console.error(`[site-scenario-config] loadSiteScenario(${slug}) failed:`, err.message);
  }

  // Fallback — DEFAULT_SCENARIO values. Match the homepage_default seed row.
  return {
    loanAmount: DEFAULT_SCENARIO.loanAmount,
    propertyValue: DEFAULT_SCENARIO.propertyValue,
    fico: DEFAULT_SCENARIO.fico,
    loanPurpose: DEFAULT_SCENARIO.loanPurpose,
    propertyType: DEFAULT_SCENARIO.propertyType,
    state: DEFAULT_SCENARIO.state,
    lockDays: DEFAULT_SCENARIO.lockDays,
    term: DEFAULT_SCENARIO.term,
  };
}

/**
 * @typedef {object} SurfacePricingConfig
 * @property {boolean} borrowerPaid
 * @property {boolean} excludeStreamline
 * @property {boolean} excludeInterestOnly
 * @property {boolean} excludeHighBalance
 * @property {boolean} excludeBuydowns
 * @property {boolean} excludeJumbo
 * @property {string[]} productTypes
 * @property {string[]} occupancies
 * @property {string[]|null} tiersAllowed
 */

/**
 * Load surface pricing config by surface key (e.g. 'homepage').
 * Returns flags in the shape priceScenario() expects (camelCase fields).
 * Falls back to a hardcoded homepage-safe config on any DB read failure.
 *
 * @param {string} surface
 * @returns {Promise<SurfacePricingConfig>}
 */
export async function loadSurfaceConfig(surface) {
  const now = Date.now();
  const hit = surfaceCache.get(surface);
  if (hit && now - hit.fetchedAt < CACHE_TTL_MS) return hit.data;

  try {
    const rows = await sql`
      SELECT borrower_paid, exclude_streamline, exclude_interest_only,
             exclude_high_balance, exclude_buydowns, exclude_jumbo,
             product_types, occupancies, tiers_allowed
      FROM surface_pricing_config
      WHERE surface = ${surface}
      LIMIT 1
    `;
    const row = rows[0];
    if (row) {
      const data = {
        borrowerPaid: Boolean(row.borrower_paid),
        excludeStreamline: Boolean(row.exclude_streamline),
        excludeInterestOnly: Boolean(row.exclude_interest_only),
        excludeHighBalance: Boolean(row.exclude_high_balance),
        excludeBuydowns: Boolean(row.exclude_buydowns),
        excludeJumbo: Boolean(row.exclude_jumbo),
        productTypes: row.product_types || ['fixed'],
        occupancies: row.occupancies || ['primary'],
        tiersAllowed: row.tiers_allowed || null,
      };
      surfaceCache.set(surface, { data, fetchedAt: now });
      return data;
    }
  } catch (err) {
    console.error(`[site-scenario-config] loadSurfaceConfig(${surface}) failed:`, err.message);
  }

  // Fallback — matches current homepage.js hardcoded kwargs. Non-homepage
  // surfaces get a no-filter config (no exclusions, all product types)
  // since their pre-migration behavior was to pass no exclude* kwargs.
  if (surface === 'homepage') {
    return {
      borrowerPaid: false,
      excludeStreamline: true,
      excludeInterestOnly: true,
      excludeHighBalance: true,
      excludeBuydowns: false,
      excludeJumbo: true,
      productTypes: ['fixed'],
      occupancies: ['primary'],
      tiersAllowed: null,
    };
  }
  return {
    borrowerPaid: false,
    excludeStreamline: false,
    excludeInterestOnly: false,
    excludeHighBalance: false,
    excludeBuydowns: false,
    excludeJumbo: false,
    productTypes: ['fixed'],
    occupancies: ['primary'],
    tiersAllowed: null,
  };
}

/** Clear caches — exported for tests / admin tooling. */
export function clearSiteScenarioConfigCache() {
  scenarioCache.clear();
  surfaceCache.clear();
}
