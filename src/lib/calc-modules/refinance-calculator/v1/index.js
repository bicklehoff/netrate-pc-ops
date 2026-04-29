/**
 * refinance-calculator v1 — module def.
 *
 * Rate-pulling archetype — first module to exercise services.fetchRates.
 * compute() awaits the injected service, builds the rate ladder, and
 * computes 4 strategy outcomes (noCost / zeroOop / lowest / custom).
 *
 * Default export — see Phase 2 PR #284 for the ESLint rationale.
 */

import { compute } from './compute.js';
import { schema } from './schema.js';
import StandaloneView from './StandaloneView.js';
import EmbeddedView from './EmbeddedView.js';

/** @type {import('../../types.js').ModuleDef} */
const definition = {
  id: 'refinance-calculator',
  version: 1,
  label: 'Refinance Calculator',
  description: '4-strategy refinance breakdown (no-cost, zero-OOP, lowest rate, custom) priced against today\'s wholesale rates.',
  inputSchema: schema,
  compute,
  views: {
    standalone: StandaloneView,
    embedded: EmbeddedView,
    // Lazy thunk — keeps @react-pdf/renderer out of client bundles.
    pdf: () => import('./PDFView.js').then((m) => m.default),
  },
  capabilities: {
    needsRates: true,
    needsToday: false,
    attachable: true,
    relevantPurposes: ['refinance', 'cashout'],
    relevantLoanTypes: [],
  },
};

export default definition;
