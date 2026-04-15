/**
 * Non-QM rate sheet ingestion.
 *
 * Takes parsed output from the Everstream parsers and writes it to the
 * nonqm_rate_sheets / nonqm_rate_products / nonqm_adjustment_rules tables.
 *
 * Safe to re-run: if a rate sheet with the same (lender_code, effective_at)
 * already exists, we update it in place (delete children, reinsert).
 *
 * This is the DB-writer half of PR 15b — the parsers produce plain JS objects,
 * this module is the only piece that touches Postgres. Keeps parsers testable
 * without a live database.
 */

/**
 * Ingest a parsed Everstream rate sheet into the DB.
 *
 * @param {object} sql       neon tagged-template sql client
 * @param {object} args
 * @param {object} args.rates  output of parseEverstreamRatesCsv()
 * @param {object} args.llpas  output of parseEverstreamLlpasXlsx()
 * @param {string[]} args.sourceFiles filenames (for audit)
 * @param {boolean} [args.activate=true]  mark this sheet active (deactivates prior)
 * @returns {Promise<{ rateSheetId, productCount, llpaCount, replaced }>}
 */
export async function ingestEverstreamSheet(sql, { rates, llpas, sourceFiles, activate = true }) {
  if (!rates || !rates.products?.length) {
    throw new Error('No rate products to ingest');
  }
  if (!rates.effective_at) {
    throw new Error('No effective_at parsed from rate CSV');
  }

  const lender_code = rates.lender_code;
  const effective_at = rates.effective_at;

  // 1. Upsert rate sheet header ─────────────────────────────────────
  const existing = await sql`
    SELECT id FROM nonqm_rate_sheets
     WHERE lender_code = ${lender_code} AND effective_at = ${effective_at}
  `;
  let rateSheetId;
  let replaced = false;

  if (existing.length > 0) {
    rateSheetId = existing[0].id;
    replaced = true;
    // Wipe children — children have ON DELETE CASCADE on rate_sheet_id, but
    // we're keeping the parent row so delete explicitly.
    await sql`DELETE FROM nonqm_rate_products    WHERE rate_sheet_id = ${rateSheetId}`;
    await sql`DELETE FROM nonqm_adjustment_rules WHERE rate_sheet_id = ${rateSheetId}`;
    await sql`
      UPDATE nonqm_rate_sheets
         SET source_files = ${sourceFiles},
             product_count = ${rates.products.length},
             llpa_count = ${llpas?.rules?.length ?? 0}
       WHERE id = ${rateSheetId}
    `;
  } else {
    const inserted = await sql`
      INSERT INTO nonqm_rate_sheets
        (lender_code, effective_at, source_files, product_count, llpa_count, is_active)
      VALUES
        (${lender_code}, ${effective_at}, ${sourceFiles},
         ${rates.products.length}, ${llpas?.rules?.length ?? 0}, false)
      RETURNING id
    `;
    rateSheetId = inserted[0].id;
  }

  // 2. Insert products in batches ───────────────────────────────────
  await batchInsert(sql, 'nonqm_rate_products', [
    'rate_sheet_id', 'lender_code', 'loan_type', 'tier', 'product_type',
    'term', 'arm_fixed_period', 'arm_adj_period', 'lock_days',
    'note_rate', 'final_base_price', 'raw_product_name',
  ], rates.products.map(p => [
    rateSheetId, p.lender_code, p.loan_type, p.tier, p.product_type,
    p.term, p.arm_fixed_period, p.arm_adj_period, p.lock_days,
    p.note_rate, p.final_base_price, p.raw_product_name,
  ]));

  // 3. Insert LLPA rules in batches ──────────────────────────────────
  if (llpas?.rules?.length) {
    await batchInsert(sql, 'nonqm_adjustment_rules', [
      'rate_sheet_id', 'lender_code', 'tier', 'product_type', 'rule_type',
      'occupancy', 'loan_purpose', 'fico_min', 'fico_max',
      'cltv_min', 'cltv_max', 'property_type',
      'loan_size_min', 'loan_size_max', 'dscr_ratio_min', 'dscr_ratio_max',
      'prepay_years', 'state', 'doc_type', 'feature',
      'llpa_points', 'price_cap', 'not_offered', 'raw_label',
    ], llpas.rules.map(r => [
      rateSheetId, r.lender_code, r.tier, r.product_type ?? null, r.rule_type,
      r.occupancy ?? null, r.loan_purpose ?? null, r.fico_min ?? null, r.fico_max ?? null,
      r.cltv_min ?? null, r.cltv_max ?? null, r.property_type ?? null,
      r.loan_size_min ?? null, r.loan_size_max ?? null, r.dscr_ratio_min ?? null, r.dscr_ratio_max ?? null,
      r.prepay_years ?? null, r.state ?? null, r.doc_type ?? null, r.feature ?? null,
      r.llpa_points ?? null, r.price_cap ?? null, r.not_offered ?? false, r.raw_label ?? null,
    ]));
  }

  // 4. Optionally activate — deactivate prior sheets, activate this one ─
  if (activate) {
    await sql`UPDATE nonqm_rate_sheets SET is_active = FALSE WHERE lender_code = ${lender_code}`;
    await sql`UPDATE nonqm_rate_sheets SET is_active = TRUE  WHERE id = ${rateSheetId}`;
  }

  return {
    rateSheetId,
    productCount: rates.products.length,
    llpaCount: llpas?.rules?.length ?? 0,
    replaced,
  };
}

/**
 * Chunked INSERT with parameterized multi-row VALUES.
 * Neon's HTTP endpoint has a parameter limit (~65k); batch to stay safe.
 */
async function batchInsert(sql, table, cols, rows, chunkSize = 500) {
  if (!rows.length) return;
  const colList = cols.join(', ');

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const placeholders = [];
    const params = [];
    let p = 1;
    for (const row of chunk) {
      const slots = row.map(() => `$${p++}`);
      placeholders.push(`(${slots.join(', ')})`);
      params.push(...row);
    }
    const text = `INSERT INTO ${table} (${colList}) VALUES ${placeholders.join(', ')}`;
    await sql.query(text, params);
  }
}
