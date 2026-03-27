/**
 * Rate Sheet DB Writer
 *
 * Takes parser output and writes to rate_sheets + rate_prices tables,
 * matching each program to its rate_products row.
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

const DB_URL = process.env.PC_DATABASE_URL || process.env.DATABASE_URL;

/**
 * Build a lookup key for matching parsed programs to rate_products rows.
 * Must match the rawName format used in populate-products.js.
 */
function buildProductKey(program) {
  const range = program.loanAmountRange || {};
  const hasRange = (range.min > 0 || range.max);
  return program.name + (hasRange ? ' [' + (range.min || 0) + '-' + (range.max || '') + ']' : '');
}

/**
 * Write parsed rate data to the database using batch inserts.
 */
async function writeRatesToDB(lenderCode, programs, sheetDate, sourceFile = null) {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  try {
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

    // Load all rate_products for this lender (keyed by raw_name)
    const productsResult = await client.query(
      'SELECT id, raw_name FROM rate_products WHERE lender_id = $1', [lenderId]
    );
    const productMap = {};
    for (const row of productsResult.rows) {
      productMap[row.raw_name] = row.id;
    }

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

    // Batch insert — 500 rows per INSERT
    const BATCH_SIZE = 500;
    let pricesInserted = 0;

    for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
      const batch = allRows.slice(i, i + BATCH_SIZE);
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
