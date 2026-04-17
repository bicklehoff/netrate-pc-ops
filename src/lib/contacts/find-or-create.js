/**
 * Contact find-or-create utility.
 *
 * Locates an existing contact by email (case-insensitive) within an
 * organization, or creates a new lead-tier contact if none exists.
 *
 * Used by:
 *   - Scenario creation (saved-scenario, MLO quotes) — identity from email
 *   - CoreCRM lead intake (inbound leads from ICanBuy etc.)
 *   - Future: any code path that needs "the contact behind this email."
 *
 * NOT a replacement for `upsertBorrowerFromImport` in the XML loan import —
 * that path carries SSN/DOB/role-upgrade semantics and stays specialized.
 */

import sql from '@/lib/db';

/**
 * @param {object} params
 * @param {string} params.email - Required. Normalized to lowercase.
 * @param {string} params.organizationId - Required. UUID for multi-tenant scope.
 * @param {string|null} [params.phone]
 * @param {string|null} [params.firstName]
 * @param {string|null} [params.lastName]
 * @param {string} [params.role='borrower']
 * @param {string} [params.marketingStage='lead']
 * @param {string|null} [params.source] - Provenance tag (e.g. 'rate-tool-save',
 *   'mlo-quote', 'scenario-backfill'). Preserved on the contact row.
 * @returns {Promise<{ contact: object, created: boolean }>}
 */
export async function findOrCreateContactByEmail({
  email,
  organizationId,
  phone = null,
  firstName = null,
  lastName = null,
  role = 'borrower',
  marketingStage = 'lead',
  source = null,
}) {
  if (!email || !organizationId) {
    throw new Error('findOrCreateContactByEmail: email and organizationId are required');
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('findOrCreateContactByEmail: email is empty after normalization');
  }

  // Prefer earliest-created on collision (deterministic, matches migration 006 behavior).
  const existing = await sql`
    SELECT * FROM contacts
    WHERE lower(email) = ${normalizedEmail}
      AND organization_id = ${organizationId}
    ORDER BY created_at ASC
    LIMIT 1
  `;

  if (existing.length > 0) {
    return { contact: existing[0], created: false };
  }

  const inserted = await sql`
    INSERT INTO contacts (
      id, organization_id, role, email, phone,
      first_name, last_name, marketing_stage, source,
      created_at, updated_at
    ) VALUES (
      gen_random_uuid(), ${organizationId}, ${role}, ${normalizedEmail}, ${phone},
      ${firstName || 'Unknown'}, ${lastName || 'Unknown'}, ${marketingStage}, ${source || 'manual'},
      NOW(), NOW()
    )
    RETURNING *
  `;

  return { contact: inserted[0], created: true };
}
