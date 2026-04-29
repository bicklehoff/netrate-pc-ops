/**
 * Calculator module registry — AD-11a Phase 1 framework.
 *
 * Single source of truth for "what calculators exist on this site".
 * Standalone tool pages, the MLO quote builder's module picker, and the
 * borrower-facing quote render at /portal/quote/[id] all read from here.
 *
 * Registry shape: Map<moduleId, Map<version, ModuleDef>>. Versions live
 * forever per AD-12a (sent quotes are regulated records and the v1 code
 * must always be available to re-render them — see
 * Work/Dev/AD-11A-CALCULATOR-MODULE-REGISTRY.md §6).
 *
 * Phase 1 ships strictly empty. Each subsequent PR registers one
 * calculator (cost-of-waiting first per §10 migration order). Adding a
 * module = importing it here and adding to REGISTRY + CURRENT_VERSIONS.
 */

import costOfWaitingV1 from './cost-of-waiting/v1/index.js';
import refiAnalyzerV1 from './refi-analyzer/v1/index.js';

/** @type {Map<string, Map<number, import('./types.js').ModuleDef>>} */
export const REGISTRY = new Map([
  ['cost-of-waiting', new Map([
    [1, costOfWaitingV1],
  ])],
  ['refi-analyzer', new Map([
    [1, refiAnalyzerV1],
  ])],
]);

/**
 * The "current" version of each module. The MLO picker and standalone
 * pages use this; sent quotes pin to whatever version was current at
 * send time and never auto-upgrade.
 *
 * @type {Record<string, number>}
 */
export const CURRENT_VERSIONS = {
  'cost-of-waiting': 1,
  'refi-analyzer': 1,
};

/**
 * Look up a specific version of a module. Returns null if either the
 * moduleId or version doesn't exist in the registry — defensive so a
 * sent quote referencing a hypothetically-retired version doesn't crash
 * the borrower view (the page renders without the module's section).
 *
 * @param {string} moduleId
 * @param {number} version
 * @returns {import('./types.js').ModuleDef | null}
 */
export function getModule(moduleId, version) {
  return REGISTRY.get(moduleId)?.get(version) ?? null;
}

/**
 * Look up the current version of a module. Used by /tools/<id> standalone
 * pages and the MLO picker (which should always offer the latest version
 * for new attachments).
 *
 * @param {string} moduleId
 * @returns {import('./types.js').ModuleDef | null}
 */
export function getCurrentModule(moduleId) {
  const v = CURRENT_VERSIONS[moduleId];
  return typeof v === 'number' ? getModule(moduleId, v) : null;
}

/**
 * List the modules an MLO can attach to a quote. Filters by
 * capabilities.attachable; loan-purpose / loan-type relevance is a
 * SOFT SORT applied by the picker UI, not a hard filter at the registry
 * level (per AD-11a spec §13 Q4 — show all attachable modules, surface
 * relevant ones at the top). Use `getRelevanceScore` to sort.
 *
 * @returns {Array<import('./types.js').ModuleDef>}
 */
export function listAttachableModules() {
  const out = [];
  for (const moduleId of Object.keys(CURRENT_VERSIONS)) {
    const m = getCurrentModule(moduleId);
    if (m && m.capabilities?.attachable) out.push(m);
  }
  return out;
}

/**
 * Soft-sort relevance score for the MLO picker. Higher = more relevant
 * to the scenario at hand. Pickers sort attachable modules by this
 * score descending; modules with score 0 still appear in the list.
 *
 * @param {import('./types.js').ModuleDef} module
 * @param {{loan_purpose?: string|null, loan_type?: string|null}} scenario
 * @returns {number}
 */
export function getRelevanceScore(module, scenario) {
  const caps = module.capabilities || {};
  let score = 0;
  if (caps.relevantPurposes?.length > 0 && scenario.loan_purpose) {
    if (caps.relevantPurposes.includes(scenario.loan_purpose)) score += 2;
  } else if (!caps.relevantPurposes?.length) {
    score += 1; // module accepts all purposes
  }
  if (caps.relevantLoanTypes?.length > 0 && scenario.loan_type) {
    if (caps.relevantLoanTypes.includes(scenario.loan_type)) score += 1;
  }
  return score;
}
