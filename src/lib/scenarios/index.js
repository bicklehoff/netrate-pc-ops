/**
 * Scenarios slice — public surface.
 *
 * Post-AD-10a (D9c Phase 2, 2026-04-29) the scenarios slice owns ONLY
 * pricing snapshots. Subscription lifecycle moved to `@/lib/rate-alerts`;
 * MLO deliverable lifecycle moved to `@/lib/quotes`. Functions that
 * produce a quote-shape or rate-alert-shape now live in those slices.
 *
 * Callers should import from `@/lib/scenarios`, not from individual files.
 */

export * from './db.js';
export * from './transform.js';
