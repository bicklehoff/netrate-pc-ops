/**
 * Rate Sheet DB Writer — Unified Pipeline
 *
 * Takes parser output and writes to rate_products + rate_sheets + rate_prices.
 * Upserts products automatically — no separate populate-products step needed.
 *
 * Uses batch inserts (500 rows per INSERT) for performance over network DB.
 *
 * Usage:
 *   const { writeRatesToDB } = require('./db-writer');
 *   const result = await writeRatesToDB('everstream', programs, sheetDate, sourceFile);
 */

/* eslint-disable @typescript-eslint/no-require-imports */
try { require('dotenv').config(); } catch { /* dotenv optional in Next.js runtime */ }
const { Client } = require('pg');
const { validatePrograms } = require('./validate');

const DB_URL = process.env.PC_DATABASE_URL || process.env.DATABASE_URL;

/**
 * Build a lookup key for matching parsed programs to rate_products rows.
 */
function buildProductKey(program) {
  const range = program.loanAmountRange || {};
  const hasRange = (range.min > 0 || range.max);
  return program.name + (hasRange ? ' [' + (range.min || 0) + '-' + (range.max || '') + ']' : '');
}

/**
 * Build a human-readable display name from product name + loan amount range.
 */
function buildDisplayName(name, range) {
  if (!range || (!range.min && !range.max)) return name;
  const minK = range.min ? `$${Math.round(range.min / 1000)}K` : '$0';
  const maxK = range.max ? `$${Math.round(range.max / 1000)}K` : '+';
  return `${name} (${minK}-${maxK})`;
}

/**
 * Upsert rate_products for all unique programs.
 * Creates new products if they don't exist, updates if they do.
 * Returns a map of rawName → productId.
 */
async function upsertProducts(client, lenderId, programs) {
  // Deduplicate by product key
  const seen = new Set();
  const uniqueProducts = [];
  for (const prog of programs) {
    const key = buildProductKey(prog);
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueProducts.push({ ...prog, rawName: key });
  }

  let created = 0;
  let existing = 0;

  for (const prog of uniqueProducts) {
    const range = prog.loanAmountRange || {};
    const displayName = buildDisplayName(prog.name, range);

    const result = await client.query(`
      INSERT INTO rate_products (
        id, lender_id, raw_name, display_name, loan_type, agency, tier, term, product_type,
        occupancy, loan_amount_min, loan_amount_max, is_high_balance, is_streamline,
        is_buydown, is_interest_only, arm_structure, status, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15, $16, 'active', NOW(), NOW()
      )
      ON CONFLICT (lender_id, raw_name) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        loan_amount_min = EXCLUDED.loan_amount_min,
        loan_amount_max = EXCLUDED.loan_amount_max,
        updated_at = NOW()
      RETURNING id, (xmax = 0) AS is_new
    `, [
      lenderId, prog.rawName, displayName,
      prog.loanType || 'conventional',
      prog.investor || null,
      prog.tier || null,
      prog.term || 30,
      prog.productType || 'fixed',
      prog.occupancy || 'primary',
      range.min || null,
      range.max || null,
      prog.isHighBalance || false,
      prog.isStreamline || false,
      prog.isBuydown || false,
      prog.isInterestOnly || false,
      prog.armStructure || null,
    ]);

    if (result.rows[0]?.is_new) created++;
    else existing++;
  }

  // Reload the product map after upsert
  const productsResult = await client.query(
    'SELECT id, raw_name FROM rate_products WHERE lender_id = $1', [lenderId]
  );
  const productMap = {};
  for (const row of productsResult.rows) {
    productMap[row.raw_name] = row.id;
  }

  return { productMap, created, existing, total: uniqueProducts.length };
}

/**
 * Write parsed rate data to the database using batch inserts.
 */
async function writeRatesToDB(lenderCode, programs, sheetDate, sourceFile = null) {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  try {
    // Validate parser output before touching the DB
    const warnings = validatePrograms(programs);
    if (warnings.length > 0) {
      console.warn('Validation warnings:', warnings);
    }

    // Everything in a transaction — if anything fails, nothing changes
    await client.query('BEGIN');

    // Get lender ID
    const lenderResult = await client.query(
      'SELECT id FROM rate_lenders WHERE code = $1', [lenderCode]
    );
    if (lenderResult.rows.length === 0) {
      throw new Error(`Lender not found: ${lenderCode}`);
    }
    const lenderId = lenderResult.rows[0].id;

    // Deactivate ALL existing active sheets for this lender FIRST
    // One active sheet per lender at any time.
    await client.query(`
      UPDATE rate_sheets SET status = 'superseded'
      WHERE lender_id = $1 AND status = 'active'
    `, [lenderId]);

    // Delete rate_prices for superseded sheets (keep DB clean)
    await client.query(`
      DELETE FROM rate_prices WHERE rate_sheet_id IN (
        SELECT id FROM rate_sheets WHERE lender_id = $1 AND status = 'superseded'
      )
    `, [lenderId]);

    // Upsert rate_products — creates new products, updates existing ones
    const { productMap, created: productsCreated, existing: productsExisting } =
      await upsertProducts(client, lenderId, programs);

    // Create rate_sheet record
    const sheetResult = await client.query(`
      INSERT INTO rate_sheets (id, lender_id, effective_date, source_file, row_count, product_count, status, created_at)
      VALUES (gen_random_uuid(), $1, $2, $3, 0, $4, 'active', NOW())
      RETURNING id
    `, [lenderId, sheetDate, sourceFile, programs.length]);
    const sheetId = sheetResult.rows[0].id;

    // Collect all rate price rows for batch insert
    let productsMatched = 0;
    let productsUnmatched = 0;
    const unmatchedNames = [];
    const allRows = []; // { productId, rate, price, lockDays }

    for (const program of programs) {
      const key = buildProductKey(program);
      const productId = productMap[key];

      if (!productId) {
        productsUnmatched++;
        if (unmatchedNames.length < 20) unmatchedNames.push(key);
        continue;
      }

      productsMatched++;

      for (const ratePoint of program.rates) {
        allRows.push({
          productId,
          rate: ratePoint.rate,
          price: ratePoint.price,
          lockDays: ratePoint.lockDays,
        });
      }
    }

    // Deduplicate price rows — parser can emit same product+rate+lock multiple times
    // (e.g., DSCR products with overlapping loan amount ranges that map to same product key)
    // Keep the last occurrence (later programs in the sheet tend to be more specific)
    const priceKey = (r) => `${r.productId}|${r.rate}|${r.lockDays}`;
    const priceMap = new Map();
    for (const row of allRows) priceMap.set(priceKey(row), row);
    const dedupedRows = [...priceMap.values()];
    if (dedupedRows.length < allRows.length) {
      console.log(`  Deduped prices: ${allRows.length} → ${dedupedRows.length} (${allRows.length - dedupedRows.length} duplicates removed)`);
    }

    // Batch insert — 500 rows per INSERT
    const BATCH_SIZE = 500;
    let pricesInserted = 0;

    for (let i = 0; i < dedupedRows.length; i += BATCH_SIZE) {
      const batch = dedupedRows.slice(i, i + BATCH_SIZE);
      const values = [];
      const params = [];
      let paramIdx = 1;

      for (const row of batch) {
        values.push(`(gen_random_uuid(), $${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}, $${paramIdx + 4}, NOW())`);
        params.push(sheetId, row.productId, row.rate, row.price, row.lockDays);
        paramIdx += 5;
      }

      await client.query(`
        INSERT INTO rate_prices (id, rate_sheet_id, product_id, rate, price, lock_days, created_at)
        VALUES ${values.join(', ')}
      `, params);

      pricesInserted += batch.length;
    }

    // Update sheet with actual row count
    await client.query(
      'UPDATE rate_sheets SET row_count = $1 WHERE id = $2',
      [pricesInserted, sheetId]
    );

    // Commit the transaction — all or nothing
    await client.query('COMMIT');

    return {
      sheetId,
      lenderCode,
      sheetDate,
      pricesInserted,
      productsMatched,
      productsUnmatched,
      productsCreated,
      productsExisting,
      unmatchedNames,
    };
  } catch (err) {
    // Rollback on any error — DB stays unchanged
    try { await client.query('ROLLBACK'); } catch { /* ignore rollback errors */ }
    throw err;
  } finally {
    await client.end();
  }
}

module.exports = { writeRatesToDB, buildProductKey };
