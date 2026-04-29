#!/usr/bin/env node
/**
 * Neon branch lifecycle helper — for migration rehearsals and ad-hoc branches.
 *
 * Reads NEON_API_KEY and NEON_PROJECT_ID from .env. Account is Vercel-managed,
 * so the API requires an org_id; that's resolved from the user's organizations
 * automatically (cached after first call).
 *
 * Usage:
 *   node scripts/_neon-branch.mjs create <name> [--db=netrate_pc] [--role=neondb_owner] [--pooled]
 *       Creates a branch from the project's default (production) parent. Prints
 *       the connection URI to stdout (suitable for piping into a runner via
 *       --connection-string). Errors go to stderr.
 *
 *   node scripts/_neon-branch.mjs list
 *       Lists all branches in the project with id, name, default flag, parent.
 *
 *   node scripts/_neon-branch.mjs delete <branch-id-or-name>
 *       Deletes a branch. Refuses to delete the default (main/production) branch.
 *
 *   node scripts/_neon-branch.mjs uri <branch-id-or-name> [--db=netrate_pc] [--role=neondb_owner]
 *       Gets the connection URI for an existing branch.
 *
 * Project & DB defaults: NEON_PROJECT_ID env var. The PC site project is
 *   `aged-dew-33863780` (neon-purple-xylophone, hosting the netrate_pc DB).
 *   Other projects in this org: delicate-cake-43404873 (netrate-tracker),
 *   aged-moon-72816287 (birdy device DB).
 *
 * Why this exists: rehearsal-on-Neon-branch is mandatory for data-touching
 * migrations per DEV-PLAYBOOK §3 + CODING-PRINCIPLES.md T3 rigor. This script
 * makes branch lifecycle one command instead of clicking through the dashboard.
 */

import 'dotenv/config';

const API_KEY = process.env.NEON_API_KEY;
const PROJECT_ID = process.env.NEON_PROJECT_ID;
if (!API_KEY) {
  console.error('NEON_API_KEY not set in .env');
  process.exit(1);
}

const [, , cmd, ...rest] = process.argv;
const flags = Object.fromEntries(
  rest.filter((a) => a.startsWith('--')).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);
const positionals = rest.filter((a) => !a.startsWith('--'));

const project = flags.project || PROJECT_ID;
if (!project && cmd !== 'list-projects') {
  console.error('NEON_PROJECT_ID not set in .env (or pass --project=<id>)');
  process.exit(1);
}
const db = flags.db || 'netrate_pc';
const role = flags.role || 'neondb_owner';
const pooled = flags.pooled !== false; // default true

async function api(path, init = {}) {
  const url = path.startsWith('http')
    ? path
    : `https://console.neon.tech/api/v2${path.startsWith('/') ? '' : '/'}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const body = await res.text();
  let json = null;
  try { json = JSON.parse(body); } catch { /* not JSON */ }
  if (!res.ok) {
    const msg = json?.message || body || res.statusText;
    throw new Error(`Neon API ${res.status}: ${msg}`);
  }
  return json;
}

async function getConnectionUri(branchId, endpointId) {
  const params = new URLSearchParams({
    branch_id: branchId,
    endpoint_id: endpointId,
    database_name: db,
    role_name: role,
    pooled: String(pooled),
  });
  const r = await api(`/projects/${project}/connection_uri?${params}`);
  return r.uri;
}

async function findBranch(idOrName) {
  const r = await api(`/projects/${project}/branches`);
  return r.branches.find((b) => b.id === idOrName || b.name === idOrName);
}

async function findEndpoint(branchId) {
  const r = await api(`/projects/${project}/endpoints`);
  return r.endpoints.find((e) => e.branch_id === branchId);
}

// ─── Commands ────────────────────────────────────────────────────────

async function cmdCreate(name) {
  if (!name) throw new Error('branch name required');

  const existing = await findBranch(name);
  if (existing) {
    console.error(`Branch '${name}' already exists (${existing.id}). Use uri command for its connection string.`);
    process.exit(1);
  }

  const r = await api(`/projects/${project}/branches`, {
    method: 'POST',
    body: JSON.stringify({
      branch: { name },
      endpoints: [{ type: 'read_write' }],
    }),
  });
  const branchId = r.branch.id;
  const endpointId = r.endpoints?.[0]?.id;
  if (!endpointId) throw new Error('branch created but no endpoint returned — investigate');

  const uri = await getConnectionUri(branchId, endpointId);

  // Stderr: human-readable summary. Stdout: just the URI (so callers can pipe).
  console.error(`Created branch ${branchId} (${name})`);
  console.error(`  Endpoint: ${endpointId}`);
  console.error(`  Database: ${db}`);
  console.error(`  Role:     ${role}`);
  console.error(`  Pooled:   ${pooled}`);
  console.error(`  Delete with: node scripts/_neon-branch.mjs delete ${branchId}`);
  console.log(uri);
}

async function cmdList() {
  const r = await api(`/projects/${project}/branches`);
  console.log(`Branches in ${project} (${r.branches.length}):`);
  for (const b of r.branches) {
    const flags = [b.default ? 'default' : '', b.protected ? 'protected' : ''].filter(Boolean).join(',');
    console.log(`  ${b.id.padEnd(28)} | ${(b.name || '').padEnd(40)} | ${flags || '—'}`);
  }
}

async function cmdDelete(idOrName) {
  if (!idOrName) throw new Error('branch id or name required');
  const branch = await findBranch(idOrName);
  if (!branch) throw new Error(`branch '${idOrName}' not found`);
  if (branch.default) throw new Error(`refusing to delete default branch '${branch.name}'`);
  if (branch.protected) throw new Error(`refusing to delete protected branch '${branch.name}'`);

  await api(`/projects/${project}/branches/${branch.id}`, { method: 'DELETE' });
  console.log(`Deleted branch ${branch.id} (${branch.name})`);
}

async function cmdUri(idOrName) {
  if (!idOrName) throw new Error('branch id or name required');
  const branch = await findBranch(idOrName);
  if (!branch) throw new Error(`branch '${idOrName}' not found`);
  const endpoint = await findEndpoint(branch.id);
  if (!endpoint) throw new Error(`branch '${branch.name}' has no endpoint — wake it up via dashboard or recreate`);
  const uri = await getConnectionUri(branch.id, endpoint.id);
  console.log(uri);
}

async function cmdListProjects() {
  // Need org_id for Vercel-managed accounts. Fetch first.
  const orgs = await api('/users/me/organizations');
  const orgId = orgs.organizations?.[0]?.id;
  if (!orgId) throw new Error('no organization found on account');
  const r = await api(`/projects?org_id=${orgId}`);
  console.log(`Org: ${orgId} (${orgs.organizations[0].name})`);
  console.log(`Projects (${r.projects.length}):`);
  for (const p of r.projects) {
    console.log(`  ${p.id.padEnd(28)} | ${(p.name || '').padEnd(30)} | ${p.region_id} | ${p.created_at}`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────

const COMMANDS = {
  create: () => cmdCreate(positionals[0]),
  list: () => cmdList(),
  delete: () => cmdDelete(positionals[0]),
  uri: () => cmdUri(positionals[0]),
  'list-projects': () => cmdListProjects(),
};

const handler = COMMANDS[cmd];
if (!handler) {
  console.error(`Unknown command: ${cmd || '(none)'}`);
  console.error(`Usage: node scripts/_neon-branch.mjs <create|list|delete|uri|list-projects> [args]`);
  process.exit(1);
}

handler().catch((e) => {
  console.error(`✗ ${e.message}`);
  process.exit(1);
});
