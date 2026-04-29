/**
 * Calculator module compute orchestrator.
 *
 * Single entry point for invoking a module's compute function. Used by:
 *   - useCompute hook (live standalone view)
 *   - Quote send pipeline (frozen snapshot-on-send per AD-12a)
 *
 * Responsibilities:
 *   1. Validate input via module.inputSchema (zod)
 *   2. Build the services bundle (live or frozen)
 *   3. Invoke compute(validatedInput, services) — awaiting unconditionally
 *   4. Return { result, snapshotMeta } for the caller
 *
 * Spec: Work/Dev/AD-11A-CALCULATOR-MODULE-REGISTRY.md §4-5
 */

import { buildServices } from './services.js';

/**
 * Invoke a module's compute function with validated input + the
 * appropriate services bundle.
 *
 * @param {Object} args
 * @param {import('./types.js').ModuleDef} args.module
 * @param {Object} args.input                                     - Raw input { scenario, config }; validated against module.inputSchema.
 * @param {Partial<import('./types.js').ModuleServices>} [args.serviceOverrides]
 *   When set, these override the live services. Used at quote-send time
 *   to freeze rate data at a specific effective_date.
 * @returns {Promise<{ result: any, snapshotMeta: Object }>}
 *   The frozen entry shape that goes into quotes.attached_modules.result + snapshotMeta.
 *   Caller is responsible for adding moduleId, version, config to the
 *   final stored entry — this function returns only the compute output.
 */
export async function runCompute({ module, input, serviceOverrides = {} }) {
  if (!module) throw new Error('runCompute: module is required');
  if (!module.inputSchema) {
    throw new Error(`runCompute: module ${module.id} v${module.version} has no inputSchema`);
  }

  // 1. Validate. zod's .parse() throws ZodError on invalid input —
  //    let it propagate. Caller (useCompute / send pipeline) decides
  //    whether to surface as error state or swallow.
  const validated = module.inputSchema.parse(input);

  // 2. Build services bundle.
  const services = buildServices(module.capabilities || {}, serviceOverrides);

  // 3. Compute. Await unconditionally — async or sync both work.
  const result = await module.compute(validated, services);

  // 4. Snapshot metadata. Captures what the result was computed against.
  //    Modules can extend this by returning result.snapshotMeta in their
  //    output (merged in below) — useful when the module knows specifics
  //    like effectiveDate from its rate fetch.
  /** @type {Record<string, unknown>} */
  const snapshotMeta = {
    computedAt: new Date().toISOString(),
  };
  if (result && typeof result === 'object' && result.snapshotMeta) {
    Object.assign(snapshotMeta, result.snapshotMeta);
  }

  return { result, snapshotMeta };
}
