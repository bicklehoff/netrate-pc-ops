/**
 * Scenario Data Access Layer
 *
 * CRUD operations for the unified scenarios / scenario_rates / scenario_fee_items tables.
 * Used by MLO quote APIs, saved-scenario APIs, and rate alert cron.
 *
 * Post-Layer-1c (migration 009, PR ~92):
 *   - DAL no longer writes the denormalized `borrower_name/email/phone`
 *     columns. Identity on new rows comes from `contact_id` (known
 *     post-conversion) or `lead_id` (pre-conversion). Writers pass
 *     whichever they have; the DAL does NOT auto-create contacts.
 *   - Read paths LEFT JOIN both `contacts` and `leads`, exposing
 *     `_c_*` / `_l_*` alias sets. `transform.js::deriveIdentity`
 *     COALESCEs contact → lead → legacy denorm columns for display.
 *   - The legacy `borrower_name/email/phone` columns remain nullable
 *     for soak-period backward compat. PR 2 drops them.
 *
 * All functions accept orgId for multi-tenant scoping.
 */

import sql from '@/lib/db';

// ─── CREATE ────────────────────────────────────────────────────────

/**
 * Create a new scenario with optional rates and fee items.
 *
 * @param {object} data - Scenario fields. `contact_id` and/or `lead_id`
 *   are the identity bridge. `borrower_name/email/phone` are ignored
 *   even if passed — the DAL no longer writes them.
 * @param {object[]} [rates] - Array of rate objects to insert into scenario_rates.
 * @param {object} [feeBreakdown] - Fee breakdown object (sections A-I) to flatten into scenario_fee_items.
 * @returns {object} The created scenario with rates[], feeItems[], and
 *   JOIN-merged identity aliases (same shape as getScenarioById).
 */
export async function createScenario(data, rates = [], feeBreakdown = null) {
  // Allowed columns — borrower_name/email/phone intentionally omitted.
  // DAL no longer writes to denormalized identity fields (Layer-1c).
  const allowedCols = new Set([
    'organization_id', 'owner_type', 'source', 'visibility', 'status',
    'mlo_id', 'contact_id', 'lead_id', 'loan_id',
    'loan_purpose', 'loan_type', 'property_value', 'loan_amount', 'ltv', 'fico',
    'state', 'county', 'property_type', 'occupancy', 'term',
    'product_type', 'lock_days', 'first_time_buyer', 'borrower_paid', 'escrows_waived',
    'current_rate', 'current_balance', 'current_payment', 'current_lender', 'closing_date',
    'dscr_ratio', 'monthly_rent', 'unit_count',
    'monthly_payment', 'monthly_savings', 'cash_to_close',
    'annual_taxes', 'annual_insurance', 'pmi_rate', 'monthly_pmi',
    'first_payment_date', 'payback_months',
    'fee_total_d', 'fee_total_i', 'fee_total_closing',
    'monthly_tax', 'monthly_insurance', 'monthly_mip',
    'alert_frequency', 'alert_days', 'alert_status',
    'last_priced_at', 'last_sent_at', 'send_count', 'unsub_token',
    'sent_at', 'viewed_at', 'expires_at', 'pdf_url', 'pdf_generated_at',
    'version', 'parent_scenario_id',
    'effective_date', 'loan_classification', 'pricing_result_count', 'config_warnings',
  ]);

  const cols = ['id'];
  const vals = ['gen_random_uuid()'];
  const params = [];
  let paramIdx = 1;

  for (const [key, value] of Object.entries(data)) {
    if (!allowedCols.has(key) || value === undefined) continue;
    cols.push(key);
    params.push(value);

    // Handle special types
    if (key === 'alert_days' || key === 'config_warnings') {
      vals.push(`$${paramIdx}::text[]`);
    } else if (key === 'closing_date' || key === 'first_payment_date') {
      vals.push(`$${paramIdx}::date`);
    } else {
      vals.push(`$${paramIdx}`);
    }
    paramIdx++;
  }

  // Always add timestamps
  cols.push('created_at', 'updated_at');
  vals.push('NOW()', 'NOW()');

  const query = `INSERT INTO scenarios (${cols.join(', ')}) VALUES (${vals.join(', ')}) RETURNING id, organization_id`;
  const result = await sql.query(query, params);
  const inserted = result.rows[0];

  // Insert rates
  let insertedRates = [];
  if (rates.length > 0) {
    insertedRates = await createScenarioRates(inserted.id, rates);
  }

  // Insert fee items
  let insertedFees = [];
  if (feeBreakdown) {
    insertedFees = await createScenarioFeeItems(inserted.id, feeBreakdown);
  }

  // Re-fetch through the JOIN so the returned shape matches read paths.
  const full = await getScenarioById(inserted.id, inserted.organization_id);
  // Prefer the just-inserted rates/feeItems since they may not yet be
  // re-serialized by the subquery in identical form (caller convenience).
  return {
    ...full,
    rates: insertedRates.length > 0 ? insertedRates : (full?.rates || []),
    feeItems: insertedFees.length > 0 ? insertedFees : (full?.feeItems || []),
  };
}

/**
 * Insert rate options for a scenario.
 * @param {string} scenarioId
 * @param {object[]} rates - Array of { rate, finalPrice, lender, lenderCode, program, ... }
 * @returns {object[]} Inserted rate rows
 */
export async function createScenarioRates(scenarioId, rates) {
  const inserted = [];

  for (let i = 0; i < rates.length; i++) {
    const r = rates[i];
    const row = await sql`
      INSERT INTO scenario_rates (
        scenario_id, rate, final_price, apr, monthly_pi,
        lender, lender_code, program, investor, tier, lock_days,
        rebate_dollars, discount_dollars, comp_dollars, lender_fee,
        ufmip, effective_loan_amount,
        is_selected, display_order, breakdown
      ) VALUES (
        ${scenarioId},
        ${r.rate}, ${r.finalPrice ?? r.price ?? null}, ${r.apr ?? null}, ${r.monthlyPI ?? r.monthly_pi ?? null},
        ${r.lender || 'Unknown'}, ${r.lenderCode ?? r.lender_code ?? null},
        ${r.program ?? null}, ${r.investor ?? null}, ${r.tier ?? null},
        ${r.lockDays ?? r.lock_days ?? 30},
        ${r.rebateDollars ?? r.rebate_dollars ?? 0},
        ${r.discountDollars ?? r.discount_dollars ?? 0},
        ${r.compDollars ?? r.comp_dollars ?? 0},
        ${r.lenderFee ?? r.lender_fee ?? 0},
        ${r.ufmip ?? 0}, ${r.effectiveLoanAmount ?? r.effective_loan_amount ?? null},
        ${r.isSelected ?? r.is_selected ?? true}, ${i},
        ${r.breakdown ? JSON.stringify(r.breakdown) : null}::jsonb
      )
      RETURNING *
    `;
    inserted.push(row[0]);
  }

  return inserted;
}

/**
 * Insert fee items from a fee breakdown object (sections A-I with items arrays).
 * @param {string} scenarioId
 * @param {object} feeBreakdown - { sectionA: { items: [...] }, sectionB: { items: [...] }, ... }
 * @returns {object[]} Inserted fee item rows
 */
export async function createScenarioFeeItems(scenarioId, feeBreakdown) {
  const SECTION_MAP = {
    sectionA: 'A', sectionB: 'B', sectionC: 'C', sectionD: 'D',
    sectionE: 'E', sectionF: 'F', sectionG: 'G', sectionH: 'H', sectionI: 'I',
  };

  const inserted = [];

  for (const [sectionKey, sectionCode] of Object.entries(SECTION_MAP)) {
    const section = feeBreakdown[sectionKey];
    if (!section?.items || !Array.isArray(section.items)) continue;

    for (let i = 0; i < section.items.length; i++) {
      const item = section.items[i];
      const row = await sql`
        INSERT INTO scenario_fee_items (
          scenario_id, section, fee_name, fee_amount, poc, hud_line, note, display_order
        ) VALUES (
          ${scenarioId}, ${sectionCode},
          ${item.label || item.name || 'Unknown'}, ${item.amount || 0},
          ${item.poc || false}, ${item.hudLine || null}, ${item.note || null}, ${i}
        )
        RETURNING *
      `;
      inserted.push(row[0]);
    }
  }

  return inserted;
}

// ─── READ ──────────────────────────────────────────────────────────

// Alias columns (_c_* / _l_*) feed transform.js::deriveIdentity, which
// COALESCEs contact → lead → legacy borrower_name/email/phone.

/**
 * Get a scenario by ID with its rates and fee items.
 * @param {string} id - Scenario UUID
 * @param {string} orgId - Organization UUID for scoping
 * @returns {object|null} Scenario with rates[] and feeItems[], or null if not found
 */
export async function getScenarioById(id, orgId) {
  const rows = await sql`
    SELECT s.*,
      c.first_name AS _c_first_name,
      c.last_name  AS _c_last_name,
      c.email      AS _c_email,
      c.phone      AS _c_phone,
      l.name       AS _l_name,
      l.first_name AS _l_first_name,
      l.last_name  AS _l_last_name,
      l.email      AS _l_email,
      l.phone      AS _l_phone
    FROM scenarios s
    LEFT JOIN contacts c ON c.id = s.contact_id
    LEFT JOIN leads    l ON l.id = s.lead_id
    WHERE s.id = ${id} AND s.organization_id = ${orgId}
  `;
  if (!rows[0]) return null;

  const scenario = rows[0];

  const rates = await sql`
    SELECT * FROM scenario_rates WHERE scenario_id = ${id} ORDER BY display_order
  `;

  const feeItems = await sql`
    SELECT * FROM scenario_fee_items WHERE scenario_id = ${id} ORDER BY section, display_order
  `;

  return { ...scenario, rates, feeItems };
}

/**
 * List scenarios with filtering and pagination.
 *
 * Search checks JOINed contact first, then the lead, then the legacy
 * denorm column (soak fallback for rows from before migration 009).
 *
 * @param {object} filters - { orgId, ownerType, mloId, status, leadId, contactId, limit, offset }
 * @returns {{ scenarios: object[], total: number }}
 */
export async function listScenarios({
  orgId, ownerType, mloId, status, leadId, contactId, loanId, search,
  limit = 50, offset = 0,
}) {
  const searchPattern = search ? `%${search}%` : null;

  const scenarios = await sql`
    SELECT s.*,
      c.first_name AS _c_first_name,
      c.last_name  AS _c_last_name,
      c.email      AS _c_email,
      c.phone      AS _c_phone,
      l.name       AS _l_name,
      l.first_name AS _l_first_name,
      l.last_name  AS _l_last_name,
      l.email      AS _l_email,
      l.phone      AS _l_phone,
      (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', sr.id, 'rate', sr.rate, 'finalPrice', sr.final_price,
        'monthlyPI', sr.monthly_pi, 'lender', sr.lender, 'lenderCode', sr.lender_code,
        'program', sr.program, 'investor', sr.investor, 'tier', sr.tier,
        'lockDays', sr.lock_days, 'rebateDollars', sr.rebate_dollars,
        'discountDollars', sr.discount_dollars, 'compDollars', sr.comp_dollars,
        'lenderFee', sr.lender_fee, 'isSelected', sr.is_selected
      ) ORDER BY sr.display_order), '[]'::jsonb)
      FROM scenario_rates sr WHERE sr.scenario_id = s.id
    ) AS rates
    FROM scenarios s
    LEFT JOIN contacts c ON c.id = s.contact_id
    LEFT JOIN leads    l ON l.id = s.lead_id
    WHERE s.organization_id = ${orgId}
      AND (${ownerType}::text IS NULL OR s.owner_type = ${ownerType})
      AND (${mloId}::uuid IS NULL OR s.mlo_id = ${mloId})
      AND (${status}::text IS NULL OR s.status = ${status})
      AND (${leadId}::uuid IS NULL OR s.lead_id = ${leadId})
      AND (${contactId}::uuid IS NULL OR s.contact_id = ${contactId})
      AND (${loanId}::uuid IS NULL OR s.loan_id = ${loanId})
      AND (${searchPattern}::text IS NULL OR
           (c.first_name || ' ' || c.last_name) ILIKE ${searchPattern} OR
           c.email ILIKE ${searchPattern} OR
           l.name ILIKE ${searchPattern} OR
           l.email ILIKE ${searchPattern} OR
           s.borrower_name ILIKE ${searchPattern})
    ORDER BY s.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const countRows = await sql`
    SELECT COUNT(*)::int AS total FROM scenarios s
    LEFT JOIN contacts c ON c.id = s.contact_id
    LEFT JOIN leads    l ON l.id = s.lead_id
    WHERE s.organization_id = ${orgId}
      AND (${ownerType}::text IS NULL OR s.owner_type = ${ownerType})
      AND (${mloId}::uuid IS NULL OR s.mlo_id = ${mloId})
      AND (${status}::text IS NULL OR s.status = ${status})
      AND (${leadId}::uuid IS NULL OR s.lead_id = ${leadId})
      AND (${contactId}::uuid IS NULL OR s.contact_id = ${contactId})
      AND (${loanId}::uuid IS NULL OR s.loan_id = ${loanId})
      AND (${searchPattern}::text IS NULL OR
           (c.first_name || ' ' || c.last_name) ILIKE ${searchPattern} OR
           c.email ILIKE ${searchPattern} OR
           l.name ILIKE ${searchPattern} OR
           l.email ILIKE ${searchPattern} OR
           s.borrower_name ILIKE ${searchPattern})
  `;

  return { scenarios, total: countRows[0]?.total || 0 };
}

// ─── UPDATE ────────────────────────────────────────────────────────

/**
 * Update scenario fields by ID.
 *
 * `borrower_name/email/phone` are NOT in allowedCols — identity edits
 * happen on the Contact row (or the Lead row, pre-conversion).
 *
 * @param {string} id - Scenario UUID
 * @param {string} orgId - Organization UUID for scoping
 * @param {object} fields - Partial update fields
 * @returns {object|null} Updated scenario or null if not found
 */
export async function updateScenario(id, orgId, fields) {
  const allowedCols = new Set([
    'status', 'visibility',
    'loan_purpose', 'loan_type', 'property_value', 'loan_amount', 'ltv', 'fico',
    'state', 'county', 'property_type', 'occupancy', 'term',
    'product_type', 'lock_days', 'first_time_buyer', 'borrower_paid', 'escrows_waived',
    'current_rate', 'current_balance', 'current_payment', 'current_lender', 'closing_date',
    'dscr_ratio', 'monthly_rent', 'unit_count',
    'monthly_payment', 'monthly_savings', 'cash_to_close',
    'annual_taxes', 'annual_insurance', 'pmi_rate', 'monthly_pmi',
    'first_payment_date', 'payback_months',
    'fee_total_d', 'fee_total_i', 'fee_total_closing',
    'monthly_tax', 'monthly_insurance', 'monthly_mip',
    'alert_frequency', 'alert_days', 'alert_status',
    'last_priced_at', 'last_sent_at', 'send_count',
    'sent_at', 'viewed_at', 'expires_at', 'pdf_url', 'pdf_generated_at',
    'version', 'contact_id', 'lead_id', 'loan_id',
    'effective_date', 'loan_classification', 'pricing_result_count',
  ]);

  const setClauses = [];
  const params = [id, orgId]; // $1 = id, $2 = orgId
  let paramIdx = 3;

  for (const [key, value] of Object.entries(fields)) {
    if (!allowedCols.has(key) || value === undefined) continue;
    setClauses.push(`${key} = $${paramIdx}`);
    params.push(value);
    paramIdx++;
  }

  if (setClauses.length === 0) return null;

  setClauses.push('updated_at = NOW()');

  const query = `UPDATE scenarios SET ${setClauses.join(', ')} WHERE id = $1 AND organization_id = $2 RETURNING *`;
  const result = await sql.query(query, params);
  return result.rows[0] || null;
}

/**
 * Replace all rates for a scenario (used when re-pricing).
 * Deletes existing rates, inserts new ones.
 * @param {string} scenarioId
 * @param {object[]} rates - New rate objects
 * @returns {object[]} Inserted rate rows
 */
export async function replaceScenarioRates(scenarioId, rates) {
  await sql`DELETE FROM scenario_rates WHERE scenario_id = ${scenarioId}`;
  return createScenarioRates(scenarioId, rates);
}

/**
 * Replace all fee items for a scenario.
 * @param {string} scenarioId
 * @param {object} feeBreakdown - Fee breakdown object
 * @returns {object[]} Inserted fee item rows
 */
export async function replaceScenarioFeeItems(scenarioId, feeBreakdown) {
  await sql`DELETE FROM scenario_fee_items WHERE scenario_id = ${scenarioId}`;
  return createScenarioFeeItems(scenarioId, feeBreakdown);
}

// ─── DELETE ────────────────────────────────────────────────────────

/**
 * Delete a scenario and all its rates/fee items (cascading).
 * @param {string} id
 * @param {string} orgId
 * @returns {boolean} true if deleted, false if not found
 */
export async function deleteScenario(id, orgId) {
  const result = await sql`
    DELETE FROM scenarios WHERE id = ${id} AND organization_id = ${orgId} RETURNING id
  `;
  return result.length > 0;
}
