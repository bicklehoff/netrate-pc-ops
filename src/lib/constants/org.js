/**
 * Organization constants.
 * NetRate Mortgage is org 1 — the default organization.
 * All existing data gets this org_id via DEFAULT constraint.
 */

// Deterministic UUID for NetRate — referenced by migration SQL and application code
export const DEFAULT_ORG_ID = '00000000-0000-4000-8000-000000000001';
export const DEFAULT_ORG_NAME = 'NetRate Mortgage';
export const DEFAULT_ORG_SLUG = 'netrate';
