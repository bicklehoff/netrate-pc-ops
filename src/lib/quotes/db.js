/**
 * Quotes slice — DAL.
 *
 * MLO deliverables table created by migration 053 per UAD AD-10a +
 * AD-12a. A `quote` row references a `scenarios` row (the immutable
 * pricing snapshot the quote was built from) and carries its own
 * lifecycle: draft → sent → viewed → accepted/declined/expired.
 *
 * Per AD-12a: quotes are SNAPSHOT-ON-SEND immutable. Once status = 'sent',
 * the quote row may only be updated for engagement tracking (viewed_at,
 * pdf_url, pdf_generated_at) and status transitions. Re-pricing or
 * re-attaching modules creates a NEW quote row with a parent_quote_id
 * pointer to the previous one.
 *
 * Slice ownership rule (per Phase 2 spec §3): if a function reads or
 * writes the `quotes` table, it lives here. Functions that produce a
 * quote shape from a scenario row also live in this slice (transform.js).
 *
 * Phase 2 invariant: this file's helpers exist but no live consumer
 * calls them yet. Phase 3 sub-PR 3b wires them in.
 */

import sql from '@/lib/db';
import crypto from 'node:crypto';

// ─── CREATE ────────────────────────────────────────────────────────

/**
 * Create a draft quote on an existing scenario.
 *
 * Status starts at 'draft'. The MLO can edit attached_modules and other
 * fields freely while in draft. Calling sendQuote() transitions status
 * to 'sent' and freezes the row per AD-12a.
 *
 * @param {object} data
 * @param {string} data.scenarioId - REQUIRED. FK to scenarios.id.
 * @param {string} data.organizationId - REQUIRED.
 * @param {string} data.mloId - REQUIRED. The MLO building the quote.
 * @param {string|null} [data.contactId]
 * @param {string|null} [data.dealId] - Reserved for AD-7 (deals table).
 *   FK constraint deferred per Phase 1 spec §3.6.
 * @param {Array<{moduleId: string, version: number, config?: object}>} [data.attachedModules]
 *   Calculator modules attached to the quote (AD-11a registry shape).
 *   Phase 2 ships the column empty; AD-11a populates it later.
 * @returns {Promise<object>} The created quote row.
 */
export async function createQuote({
  scenarioId,
  organizationId,
  mloId,
  contactId = null,
  dealId = null,
  attachedModules = [],
}) {
  if (!scenarioId) throw new Error('createQuote: scenarioId is required');
  if (!organizationId) throw new Error('createQuote: organizationId is required');
  if (!mloId) throw new Error('createQuote: mloId is required');

  const result = await sql.query(
    `INSERT INTO quotes (
      id, organization_id, scenario_id, mlo_id, contact_id, deal_id,
      status, attached_modules, version,
      created_at, updated_at
    ) VALUES (
      gen_random_uuid(), $1, $2, $3, $4, $5,
      'draft', $6::jsonb, 1,
      NOW(), NOW()
    ) RETURNING *`,
    [
      organizationId,
      scenarioId,
      mloId,
      contactId,
      dealId,
      JSON.stringify(attachedModules),
    ],
  );
  return result.rows[0];
}

// ─── READ ──────────────────────────────────────────────────────────

/**
 * Get a quote by primary key, scoped to an organization.
 * @param {string} id
 * @param {string} orgId
 * @returns {Promise<object|null>}
 */
export async function getQuoteById(id, orgId) {
  const rows = await sql`
    SELECT * FROM quotes
    WHERE id = ${id} AND organization_id = ${orgId}
    LIMIT 1
  `;
  return rows[0] || null;
}

/**
 * Get the latest quote for a scenario_id (or null if none exists).
 *
 * Per AD-12a, supersede semantics allow more than one quote per scenario
 * over time (the wrong-quote flow creates a new quote with parent_quote_id
 * pointing at the old). For Phase 3 transition, callers want "the current
 * quote" — defined as the most recently created.
 *
 * @param {string} scenarioId
 * @param {string} orgId
 * @returns {Promise<object|null>}
 */
export async function getQuoteByScenarioId(scenarioId, orgId) {
  const rows = await sql`
    SELECT * FROM quotes
    WHERE scenario_id = ${scenarioId} AND organization_id = ${orgId}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return rows[0] || null;
}

/**
 * Get a quote by its share token. Org-unscoped because the token is the
 * auth (used by /portal/quote/[token] borrower magic-link entry).
 *
 * @param {string} token
 * @returns {Promise<object|null>}
 */
export async function getQuoteByShareToken(token) {
  if (!token) return null;
  const rows = await sql`
    SELECT * FROM quotes
    WHERE share_token = ${token}
    LIMIT 1
  `;
  return rows[0] || null;
}

/**
 * List quotes with optional filters. Returns plain quote rows.
 *
 * @param {object} [filters]
 * @param {string} filters.orgId - REQUIRED.
 * @param {string} [filters.mloId]
 * @param {string} [filters.contactId]
 * @param {string} [filters.status]
 * @returns {Promise<object[]>}
 */
export async function listQuotes({ orgId, mloId = null, contactId = null, status = null } = {}) {
  if (!orgId) throw new Error('listQuotes: orgId is required');

  const where = [`organization_id = $1`];
  const params = [orgId];
  let p = 2;

  if (mloId) {
    where.push(`mlo_id = $${p++}`);
    params.push(mloId);
  }
  if (contactId) {
    where.push(`contact_id = $${p++}`);
    params.push(contactId);
  }
  if (status) {
    where.push(`status = $${p++}`);
    params.push(status);
  }

  const result = await sql.query(
    `SELECT * FROM quotes WHERE ${where.join(' AND ')} ORDER BY updated_at DESC`,
    params,
  );
  return result.rows;
}

// ─── UPDATE ────────────────────────────────────────────────────────

/**
 * Update mutable fields on a quote. Per AD-12a, mutability depends on
 * status:
 *
 *   - status='draft':  attached_modules, contact_id, deal_id, status (→ sent)
 *   - status='sent':   viewed_at, pdf_url, pdf_generated_at, status (→ viewed,
 *                      accepted, declined, expired)
 *   - status='viewed': same as 'sent', plus status (→ accepted, declined,
 *                      expired)
 *   - any other:       only status transitions to 'expired'
 *
 * Throws on disallowed keys for the current status. Use sendQuote() for
 * the draft → sent transition (it does the snapshot + share_token
 * generation atomically; clients shouldn't construct that themselves).
 *
 * @param {string} id
 * @param {string} orgId
 * @param {object} fields
 * @returns {Promise<object|null>}
 */
export async function updateQuote(id, orgId, fields) {
  // Read current to determine allowed fields per status.
  const current = await getQuoteById(id, orgId);
  if (!current) return null;

  const STATUS_TRANSITIONS = {
    draft: new Set(['sent', 'expired']),
    sent: new Set(['viewed', 'accepted', 'declined', 'expired']),
    viewed: new Set(['accepted', 'declined', 'expired']),
    accepted: new Set(['expired']),
    declined: new Set(['expired']),
    expired: new Set(),
  };

  const DRAFT_ONLY_FIELDS = new Set(['attached_modules', 'contact_id', 'deal_id']);
  const POST_SEND_FIELDS = new Set(['viewed_at', 'pdf_url', 'pdf_generated_at']);

  const setClauses = [];
  const params = [id, orgId];
  let paramIdx = 3;

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;

    // Status transition gate.
    if (key === 'status') {
      const allowed = STATUS_TRANSITIONS[current.status] || new Set();
      if (!allowed.has(value)) {
        throw new Error(
          `updateQuote: invalid status transition ${current.status} → ${value}. ` +
          `Use sendQuote() for draft → sent.`,
        );
      }
      setClauses.push(`status = $${paramIdx}`);
      params.push(value);
      paramIdx++;
      continue;
    }

    // Draft-only fields.
    if (DRAFT_ONLY_FIELDS.has(key)) {
      if (current.status !== 'draft') {
        throw new Error(
          `updateQuote: field "${key}" cannot be updated once status leaves draft (current: ${current.status})`,
        );
      }
      if (key === 'attached_modules') {
        setClauses.push(`${key} = $${paramIdx}::jsonb`);
        params.push(JSON.stringify(value));
      } else {
        setClauses.push(`${key} = $${paramIdx}`);
        params.push(value);
      }
      paramIdx++;
      continue;
    }

    // Post-send fields (engagement tracking).
    if (POST_SEND_FIELDS.has(key)) {
      if (current.status === 'draft') {
        throw new Error(
          `updateQuote: field "${key}" requires status >= 'sent' (current: draft). Call sendQuote() first.`,
        );
      }
      setClauses.push(`${key} = $${paramIdx}`);
      params.push(value);
      paramIdx++;
      continue;
    }

    throw new Error(
      `updateQuote: disallowed field "${key}". Allowed varies by status; see JSDoc.`,
    );
  }

  if (setClauses.length === 0) return current;

  setClauses.push('updated_at = NOW()');

  const query = `
    UPDATE quotes SET ${setClauses.join(', ')}
    WHERE id = $1 AND organization_id = $2
    RETURNING *
  `;
  const result = await sql.query(query, params);
  return result.rows[0] || null;
}

// ─── SEND (the AD-12a snapshot operation) ──────────────────────────

/**
 * Transition a quote from 'draft' to 'sent', generating a share_token
 * and recording sent_at. This is the AD-12a snapshot-on-send moment:
 * the quote becomes immutable for the data fields it carries, and any
 * subsequent re-price or re-send must create a NEW quotes row with a
 * `parent_quote_id` pointer to this one.
 *
 * The scenario the quote points at is itself immutable (per AD-10a),
 * so the snapshot is automatic — the quote's `scenario_id` is the
 * stable handle. When AD-11a lands and `attached_modules` is populated,
 * its `{moduleId, version}` shape gives the same immutability there.
 *
 * Throws if status is not 'draft'.
 *
 * @param {string} id - Quote id.
 * @param {string} orgId
 * @param {object} [opts]
 * @param {Date|string|null} [opts.expiresAt] - Optional expiration date.
 *   Borrowers see "Quote expires <date>" if set.
 * @param {Array<{moduleId: string, version: number, config?: object}>} [opts.attachedModules]
 *   Final list of modules to freeze with the send. If omitted, current
 *   draft's attached_modules is used.
 * @returns {Promise<object>} The sent quote row (now status='sent').
 */
export async function sendQuote(id, orgId, { expiresAt = null, attachedModules = null } = {}) {
  const current = await getQuoteById(id, orgId);
  if (!current) throw new Error(`sendQuote: quote ${id} not found in org ${orgId}`);
  if (current.status !== 'draft') {
    throw new Error(
      `sendQuote: quote ${id} status is "${current.status}", expected "draft". ` +
      `Use createQuote() to make a new quote pointing at the same scenario instead.`,
    );
  }

  // Generate the share token. 32 bytes of randomness, hex-encoded → 64 chars.
  const shareToken = crypto.randomBytes(32).toString('hex');

  const finalModules = attachedModules !== null ? attachedModules : current.attached_modules;

  const result = await sql.query(
    `UPDATE quotes
     SET status = 'sent',
         sent_at = NOW(),
         share_token = $3,
         expires_at = $4,
         attached_modules = $5::jsonb,
         updated_at = NOW()
     WHERE id = $1 AND organization_id = $2 AND status = 'draft'
     RETURNING *`,
    [id, orgId, shareToken, expiresAt, JSON.stringify(finalModules)],
  );

  if (result.rows.length === 0) {
    // Race: status changed between our read and our update. Re-throw clearly.
    throw new Error(`sendQuote: quote ${id} status changed during send (concurrent modification)`);
  }

  return result.rows[0];
}
