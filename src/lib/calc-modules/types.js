/**
 * Calculator module type definitions (JSDoc).
 *
 * The framework is JS — no .d.ts. Module authors document their input/
 * output shapes with their per-module schema (zod). These typedefs are
 * the framework-level contract every module must conform to.
 *
 * Spec: Work/Dev/AD-11A-CALCULATOR-MODULE-REGISTRY.md §3
 */

/**
 * @typedef {Object} ModuleCapabilities
 * @property {boolean} needsRates           - True if compute() needs services.fetchRates injected.
 * @property {boolean} [needsHecmRefData]   - True if compute() needs services.fetchHecmRefData injected.
 * @property {boolean} [needsToday]         - True if compute() needs services.today injected.
 * @property {boolean} attachable           - True if MLO can attach this module to a quote.
 * @property {string[]} [relevantPurposes]  - Loan purposes this module is relevant for. Empty/missing = all.
 * @property {string[]} [relevantLoanTypes] - Loan types this module is relevant for. Empty/missing = all.
 */

/**
 * @typedef {Object} ModuleViews
 * @property {React.ComponentType<any>} standalone - Full-page layout for /tools/<id> routes.
 * @property {React.ComponentType<any>} embedded   - Compact card for /portal/quote/[id]. Pure presentational; consumes frozen result.
 * @property {React.ComponentType<any>} pdf        - @react-pdf/renderer component for PDF export. Pure presentational.
 */

/**
 * The shape every registered calculator module must export.
 *
 * Compute can be sync or async. The orchestrator awaits unconditionally.
 * Compute may throw for hard errors (invalid input the schema didn't
 * catch, missing service, etc.); soft warnings should be returned in
 * `result.warnings[]` instead.
 *
 * @typedef {Object} ModuleDef
 * @property {string} id                                - Stable id, never changes.
 * @property {number} version                           - Integer, bumped on borrower-visible logic change.
 * @property {string} label                             - Human-readable label for MLO picker + page header.
 * @property {string} [description]                     - One-line description for MLO picker.
 * @property {import('zod').ZodSchema} inputSchema      - Validates {scenario, config} input.
 * @property {(input: any, services: ModuleServices) => any | Promise<any>} compute  - Pure-ish compute function.
 * @property {ModuleViews} views                        - Three render variants.
 * @property {ModuleCapabilities} capabilities          - Declarative metadata.
 */

/**
 * Service functions injected into compute() based on module.capabilities.
 * Modules only see services they declared capability flags for.
 *
 * @typedef {Object} ModuleServices
 * @property {(input: any) => Promise<any>} [fetchRates]        - Wraps /api/pricing.
 * @property {(input: any) => Promise<any>} [fetchHecmRefData]  - Wraps ref_hecm_* table queries.
 * @property {Date} [today]                                     - Date instance for time-sensitive compute.
 */

/**
 * Frozen-result entry stored in quotes.attached_modules JSONB array.
 * One entry per attached module. Spec §5.
 *
 * @typedef {Object} AttachedModuleEntry
 * @property {string} moduleId
 * @property {number} version
 * @property {Object} config       - MLO-tunable config used at send time. Validated by inputSchema.
 * @property {any} result          - Frozen compute() return value. Borrower view reads this; never re-computes.
 * @property {Object} snapshotMeta - Provenance: ratesEffectiveDate, hecmRefVersion, computedAt.
 */

export {};
