/**
 * ResiCentral DSCR top-level orchestrator (XLSX → DB-ready output).
 *
 * Reads a single ResiCentral wholesale workbook + filename and runs both
 * sub-parsers (rates, LLPAs), returning a combined `{ rates, llpas }`
 * shape compatible with `ingestNonqmSheet`.
 *
 * Per `Work/Dev/RESICENTRAL-LLPA-INVENTORY-2026-04-27.md` §11 D9c.6.6.
 *
 * Scope today (per inventory §10.6 + D9c.6.5c):
 *   Rates  — 4 programs (Premier, Investor Premier, Elite, Select)
 *            × 6 in-scope (program × term) ladders × 3 lock days
 *   LLPAs  — All 4 programs ingested. Select uses cols 2+3 forward-fill
 *            with FL-specific drops; Elite uses cols 3+4 with state drops;
 *            Premier + InvPremier use single-col labels. Foreign National
 *            (DSCR Elite FN) remains out of scope per inventory §3.
 */

import { parseResicentralRatesXlsx } from './resicentral-rates.js';
import { parseResicentralLlpasXlsx } from './resicentral-llpas.js';

/**
 * Parse the ResiCentral workbook end-to-end.
 *
 * @param {Buffer|ArrayBuffer} buf
 * @param {string} filename - source filename, used to extract effective_at
 *   (e.g. `67370_04242026_1128199760.xlsx` → 2026-04-24)
 * @returns {{
 *   rates: ReturnType<typeof parseResicentralRatesXlsx>,
 *   llpas: ReturnType<typeof parseResicentralLlpasXlsx>,
 * }}
 */
export function parseResicentralXlsx(buf, filename = '') {
  const rates = parseResicentralRatesXlsx(buf, filename);
  const llpas = parseResicentralLlpasXlsx(buf);
  return { rates, llpas };
}
