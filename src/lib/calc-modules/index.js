/**
 * Calculator module framework — public surface.
 *
 * Imports inside `src/lib/calc-modules/*` are private; consumers use
 * this index. Spec: Work/Dev/AD-11A-CALCULATOR-MODULE-REGISTRY.md
 */

export {
  REGISTRY,
  CURRENT_VERSIONS,
  getModule,
  getCurrentModule,
  listAttachableModules,
  getRelevanceScore,
} from './registry.js';

export { runCompute } from './orchestrator.js';
export { useCompute } from './useCompute.js';
export { fetchRatesLive, buildServices } from './services.js';
