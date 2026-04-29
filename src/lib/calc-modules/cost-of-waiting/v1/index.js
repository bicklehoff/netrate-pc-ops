/**
 * cost-of-waiting v1 — module def.
 *
 * Pure local archetype (per spec §4 §10). No services needed; compute
 * is fully deterministic from {scenario, config}. Eligible for any loan
 * type; relevant primarily for refinance/cashout (refi-context tool —
 * "what does waiting to refi cost"), but listed for purchase too in the
 * MLO picker because the math also illustrates "what does a higher rate
 * cost over the life of the loan" for purchase scenarios.
 */

import { compute } from './compute.js';
import { schema } from './schema.js';
import StandaloneView from './StandaloneView.js';
import EmbeddedView from './EmbeddedView.js';

/**
 * Default export rather than `export const module` because Next.js
 * ESLint forbids the name `module` (CommonJS-conflict guard).
 *
 * @type {import('../../types.js').ModuleDef}
 */
const definition = {
  id: 'cost-of-waiting',
  version: 1,
  label: 'Cost of Waiting',
  description: 'Monthly + lifetime savings from refinancing now vs. waiting.',
  inputSchema: schema,
  compute,
  views: {
    standalone: StandaloneView,
    embedded: EmbeddedView,
    // Lazy thunk — keeps @react-pdf/renderer out of every client bundle
    // that imports the registry. Send handler awaits this when needed.
    pdf: () => import('./PDFView.js').then((m) => m.default),
  },
  capabilities: {
    needsRates: false,
    needsToday: false,
    attachable: true,
    relevantPurposes: ['refinance', 'cashout'],
    relevantLoanTypes: [],
  },
};

export default definition;
