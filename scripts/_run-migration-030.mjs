/**
 * Migration 030: completes migration 021 — id defaults on 24 remaining tables.
 *
 * Metadata-only (ALTER COLUMN SET DEFAULT) → rehearsal skipped per
 * DEV-PLAYBOOK criteria. Fully idempotent.
 *
 * Run against prod: node scripts/_run-migration-030.mjs
 */

import { neon } from '@neondatabase/serverless';
import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';

const DATABASE_URL = process.env.DATABASE_URL || process.env.PC_DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL or PC_DATABASE_URL must be set');
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const host = new URL(DATABASE_URL).host;
console.log(`Migration 030 (id defaults phase 2)`);
console.log(`Target: ${host}`);

const migrationSql = fs.readFileSync(
  path.join(process.cwd(), 'prisma', 'migrations', '030_id_defaults_phase2.sql'),
  'utf8'
);

const cleaned = migrationSql
  .replace(/^\s*BEGIN\s*;\s*$/m, '')
  .replace(/^\s*COMMIT\s*;\s*$/m, '');
const withoutComments = cleaned
  .split('\n')
  .map((l) => l.replace(/--.*$/, '').trimEnd())
  .filter((l) => l.length > 0)
  .join('\n');

const statements = [];
{
  let buf = '';
  let depth = 0;
  let inStr = false;
  for (let i = 0; i < withoutComments.length; i++) {
    const ch = withoutComments[i];
    if (inStr) {
      if (ch === "'") {
        if (withoutComments[i + 1] === "'") { buf += "''"; i++; continue; }
        inStr = false;
      }
      buf += ch;
      continue;
    }
    if (ch === "'") { inStr = true; buf += ch; continue; }
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ';' && depth === 0) {
      const s = buf.trim();
      if (s) statements.push(s);
      buf = '';
    } else {
      buf += ch;
    }
  }
  const tail = buf.trim();
  if (tail) statements.push(tail);
}

console.log(`\n--- Applying ${statements.length} statements ---`);
for (let i = 0; i < statements.length; i++) {
  const preview = statements[i].split('\n').find((l) => l.trim())?.trim().slice(0, 80) || '(empty)';
  process.stdout.write(`  [${i + 1}/${statements.length}] ${preview}... `);
  try {
    await sql.query(statements[i]);
    console.log('OK');
  } catch (err) {
    console.log(`FAIL: ${err.message}`);
    process.exit(1);
  }
}

// Verify: every public-schema uuid id column now has a default
const missing = await sql`
  SELECT table_name FROM information_schema.columns
  WHERE table_schema = 'public' AND column_name = 'id' AND data_type = 'uuid'
    AND column_default IS NULL
  ORDER BY table_name
`;

console.log('\n--- Verification ---');
if (missing.length) {
  console.error(`${missing.length} tables STILL missing id default:`);
  for (const m of missing) console.error(`  ${m.table_name}`);
  process.exit(1);
}
console.log('All public.* uuid id columns now have DEFAULT gen_random_uuid().');

// Also replicate the original failing INSERT to prove SMS send will work now.
try {
  await sql.query('BEGIN');
  const [row] = await sql`
    INSERT INTO sms_messages (organization_id, direction, from_number, to_number, body)
    VALUES ('00000000-0000-4000-8000-000000000001', 'outbound', '+10000000000', '+10000000001', 'migration 030 smoke')
    RETURNING id
  `;
  console.log(`Smoke INSERT OK — id=${row.id} (rolled back, no data written)`);
  await sql.query('ROLLBACK');
} catch (e) {
  console.error(`Smoke INSERT FAILED: ${e.message}`);
  process.exit(1);
}

console.log('\nMigration 030 complete.');
