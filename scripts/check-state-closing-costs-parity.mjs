/**
 * Verifies src/lib/rates/closing-costs.js STATE_DEFAULTS matches
 * ref_state_closing_costs rows (D9d · migration 024). Protects against
 * drift between the client-bundled mirror and the DB source of truth.
 *
 * The static file is retained for synchronous client-side UX — RateTool
 * initial form state and state-dropdown labels. Server code reads
 * third-party costs from the DB via src/lib/rates/ref-state-closing-
 * costs.js. This script enforces that both always agree.
 *
 * Note: closing-costs.js uses ESM `export` syntax which plain Node
 * can't load via require/import (Next.js transpiles for the app, Node
 * doesn't for a one-off script). Rather than pulling in a transpiler,
 * we regex-parse the STATE_DEFAULTS object literal. The file shape is
 * stable enough for this to be durable.
 *
 * Run annually (or whenever a NetRate-licensed state's baseline
 * changes) — update BOTH sources, then re-run this.
 *
 * Exit codes:
 *   0 — parity holds
 *   1 — mismatch found
 *   2 — setup error
 */

import { neon } from '@neondatabase/serverless';
import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';

const DATABASE_URL = process.env.DATABASE_URL || process.env.PC_DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL or PC_DATABASE_URL must be set');
  process.exit(2);
}

const sql = neon(DATABASE_URL);

// ─── Parse STATE_DEFAULTS from src/lib/rates/closing-costs.js ────────

const filePath = path.join(process.cwd(), 'src', 'lib', 'rates', 'closing-costs.js');
const fileSrc = fs.readFileSync(filePath, 'utf8');

// Matches entries like: `  CO: { label: 'Colorado', thirdPartyCosts: 2800 },`
const entryRe = /([A-Z]{2}):\s*\{[^}]*thirdPartyCosts:\s*(\d+)[^}]*\}/g;
const fileValues = new Map();
let m;
while ((m = entryRe.exec(fileSrc)) !== null) {
  fileValues.set(m[1], Number(m[2]));
}

if (fileValues.size === 0) {
  console.error('Parity script could not parse any STATE_DEFAULTS entries — regex out of sync with closing-costs.js shape');
  process.exit(2);
}

// ─── Fetch active rows from DB ───────────────────────────────────────

const dbRows = await sql`
  SELECT state, third_party_cost
    FROM ref_state_closing_costs
   WHERE effective_from <= CURRENT_DATE
     AND (effective_to IS NULL OR effective_to > CURRENT_DATE)
   ORDER BY state
`;

const dbByState = new Map(dbRows.map((r) => [r.state, r.third_party_cost]));
const mismatches = [];

for (const [state, fileCost] of fileValues) {
  const dbCost = dbByState.get(state);
  if (dbCost == null) {
    mismatches.push(`${state}: in file (${fileCost}), not in DB`);
    continue;
  }
  if (Number(dbCost) !== Number(fileCost)) {
    mismatches.push(`${state}: file=${fileCost} db=${dbCost}`);
  }
}

for (const [state] of dbByState) {
  if (!fileValues.has(state)) {
    mismatches.push(`${state}: in DB (${dbByState.get(state)}), not in file STATE_DEFAULTS`);
  }
}

console.log(`File states: ${fileValues.size}`);
console.log(`DB states:   ${dbRows.length}`);

if (mismatches.length === 0) {
  console.log('\n✓ parity holds — file STATE_DEFAULTS and ref_state_closing_costs agree');
  process.exit(0);
}

console.error(`\n✗ ${mismatches.length} mismatch(es):`);
for (const m of mismatches) console.error(`  ${m}`);
process.exit(1);
