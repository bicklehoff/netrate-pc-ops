/**
 * purchase-calculator v1 — module def.
 *
 * Pure local archetype despite the original migration plan calling
 * this "first rate-pulling". The actual code accepts the rate as user
 * input and uses the homepage parRate cache only as an SSR seed; no
 * /api/pricing fetch happens at compute time. needsRates: false. The
 * first true rate-pulling migration is refinance-calculator (Phase 5).
 *
 * Default export — see Phase 2 PR #284 for the ESLint rationale.
 */

import { compute } from './compute.js';
import { schema } from './schema.js';
import StandaloneView from './StandaloneView.js';
import EmbeddedView from './EmbeddedView.js';
import PDFView from './PDFView.js';

/** @type {import('../../types.js').ModuleDef} */
const definition = {
  id: 'purchase-calculator',
  version: 1,
  label: 'Purchase Payment Breakdown',
  description: 'Monthly PITI(A) payment, cash to close, and DTI for a purchase scenario.',
  inputSchema: schema,
  compute,
  views: {
    standalone: StandaloneView,
    embedded: EmbeddedView,
    pdf: PDFView,
  },
  capabilities: {
    needsRates: false,
    needsToday: false,
    attachable: true,
    relevantPurposes: ['purchase'],
    relevantLoanTypes: [],
  },
};

export default definition;
