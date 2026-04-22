/**
 * Migration 029: seed staff.phone for David & Jamie.
 *
 * Bounded UPDATE by PK (2 rows) on an existing unused nullable column →
 * rehearsal skipped per DEV-PLAYBOOK criteria.
 *
 * Run against prod:      node scripts/_run-migration-029.mjs
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
console.log(`Migration 029 (staff.phone seed)`);
console.log(`Target: ${host}`);

const migrationSql = fs.readFileSync(
  path.join(process.cwd(), 'prisma', 'migrations', '029_seed_staff_personal_phones.sql'),
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

const rows = await sql`SELECT first_name, last_name, email, phone, twilio_phone_number FROM staff ORDER BY created_at NULLS LAST`;
console.log(`\n--- Verification ---`);
for (const r of rows) {
  console.log(`  ${r.first_name} ${r.last_name} — twilio=${r.twilio_phone_number || '<none>'} cell=${r.phone || '<none>'}`);
}

const david = rows.find((r) => r.email === 'david@netratemortgage.com');
const jamie = rows.find((r) => r.email === 'jamie@cmglending.com');
if (david?.phone !== '+17204998384') {
  console.error(`\nDavid cell missing. got=${david?.phone}`);
  process.exit(1);
}
if (jamie?.phone !== '+13037319262') {
  console.error(`\nJamie cell missing. got=${jamie?.phone}`);
  process.exit(1);
}

console.log('\nMigration 029 complete.');
