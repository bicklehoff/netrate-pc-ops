#!/usr/bin/env node
/**
 * One-shot DB correction: keystone.max_comp_cap_purchase was set to $3595.
 * Per David's comp policy (2026-04-17): tier-2 cap is $4595 on purchase,
 * $3595 on refi. All other active lenders (amwest, everstream, swmc,
 * windsor) are already correct at 4595 — keystone is the outlier.
 *
 * Impact: every keystone purchase funded loan was under-collecting $1000
 * of broker comp because the cap was set too low. Fixing brings keystone
 * in line with David's stated tier-2 policy.
 *
 * Idempotent: only writes if the current value is actually wrong.
 * Safe to run multiple times.
 *
 * Run:  node scripts/fix-keystone-purchase-cap.mjs
 */

import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const envLine = fs
  .readFileSync(path.join(REPO_ROOT, '.env'), 'utf8')
  .split('\n')
  .find((l) => l.startsWith('PC_DATABASE_URL='));
if (!envLine) {
  console.error('[fix-keystone] PC_DATABASE_URL not found in .env');
  process.exit(2);
}
const url = envLine.split('=').slice(1).join('=').replace(/^"|"$/g, '');
const sql = neon(url);

const before = await sql`
  SELECT code, max_comp_cap_purchase, max_comp_cap_refi
  FROM rate_lenders WHERE code = 'keystone'
`;
if (before.length === 0) {
  console.error('[fix-keystone] lender not found');
  process.exit(1);
}
console.log('[fix-keystone] before:', before[0]);

const current = Number(before[0].max_comp_cap_purchase);
if (current === 4595) {
  console.log('[fix-keystone] already correct at 4595 — no change');
  process.exit(0);
}

const updated = await sql`
  UPDATE rate_lenders
     SET max_comp_cap_purchase = 4595,
         updated_at = NOW()
   WHERE code = 'keystone'
     AND max_comp_cap_purchase != 4595
  RETURNING code, max_comp_cap_purchase, max_comp_cap_refi
`;
console.log('[fix-keystone] after:', updated[0]);
console.log('[fix-keystone] ✓ applied');
