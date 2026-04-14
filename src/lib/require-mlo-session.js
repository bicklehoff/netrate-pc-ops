/**
 * Shared MLO session helper.
 * Centralizes auth + org scoping for all MLO API routes.
 *
 * Usage:
 *   import { requireMloSession } from '@/lib/require-mlo-session';
 *
 *   export async function GET(req) {
 *     const { session, orgId, mloId } = await requireMloSession();
 *     if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
 *     // orgId is guaranteed to be a valid UUID string
 *     const rows = await sql`SELECT * FROM loans WHERE organization_id = ${orgId} ...`;
 *   }
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { DEFAULT_ORG_ID } from '@/lib/constants/org';

/**
 * Get and validate an MLO session.
 * Returns { session, orgId, mloId } or { session: null } if unauthorized.
 *
 * @returns {{ session: object|null, orgId: string, mloId: string }}
 */
export async function requireMloSession() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.userType !== 'mlo') {
    return { session: null, orgId: null, mloId: null };
  }

  return {
    session,
    orgId: session.user.organizationId || DEFAULT_ORG_ID,
    mloId: session.user.id,
  };
}

/**
 * Convenience: return a 401 JSON response.
 * Use when requireMloSession returns null.
 */
export function unauthorizedResponse() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
