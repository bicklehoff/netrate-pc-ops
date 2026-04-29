/**
 * refi-analyzer v1 — module def.
 *
 * Pure local archetype. Compares a borrower's existing loan to a refi
 * candidate and computes break-even + verdict ('Worth It' / 'Maybe' /
 * 'Not Worth It') against an intended hold period.
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
  id: 'refi-analyzer',
  version: 1,
  label: 'Refi Recoup Analyzer',
  description: 'Break-even + verdict for refinancing the current loan at a new rate.',
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
    relevantPurposes: ['refinance', 'cashout'],
    relevantLoanTypes: [],
  },
};

export default definition;
