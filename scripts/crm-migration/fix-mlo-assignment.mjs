// Fix MLO assignment — populate NMLS on MLOs, then assign contacts/leads
// Run: node --env-file=.env scripts/crm-migration/fix-mlo-assignment.mjs

import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);

// Check current MLO records
const mlos = await sql`SELECT id, email, first_name, last_name, nmls FROM mlos`;
console.log('MLOs in DB:');
mlos.forEach(m => console.log(`  ${m.id} | ${m.first_name} ${m.last_name} | ${m.email} | nmls: ${m.nmls}`));

// Update NMLS if missing
for (const m of mlos) {
  if (m.first_name === 'Jamie' && !m.nmls) {
    await sql`UPDATE mlos SET nmls = '180707' WHERE id = ${m.id}`;
    console.log(`  Updated Jamie NMLS → 180707`);
  }
  if (m.first_name === 'David' && !m.nmls) {
    await sql`UPDATE mlos SET nmls = '641790' WHERE id = ${m.id}`;
    console.log(`  Updated David NMLS → 641790`);
  }
}

// Get fresh MLO IDs
const refreshed = await sql`SELECT id, nmls, first_name FROM mlos WHERE nmls IS NOT NULL`;
console.log('\nRefreshed MLOs:');
refreshed.forEach(m => console.log(`  ${m.first_name}: ${m.id} (${m.nmls})`));

if (refreshed.length === 0) {
  console.log('No MLOs with NMLS found. Cannot assign.');
  process.exit(1);
}

const davidId = refreshed.find(m => m.nmls === '641790')?.id;
const jamieId = refreshed.find(m => m.nmls === '180707')?.id;

console.log(`\nDavid ID: ${davidId}`);
console.log(`Jamie ID: ${jamieId}`);

// The original_source field contains the Zoho Loan Officer name
// But we didn't store MLO name directly. We need to use the Zoho data mapping.
// Since all contacts either had Jamie or David as MLO (after reassignment),
// and we know the ratio, let's use the zoho data to assign.

// Strategy: contacts with original_source containing Cusick/Pearl/Jay → David (reassigned)
// For the rest, we need the Zoho data. Simpler approach:
// Re-read the Zoho contacts and build email → MLO map, then update.

import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

function loadCSV(path) {
  const content = readFileSync(path, 'utf-8');
  return parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true });
}

const MLO_NAME_MAP = {
  'jamie cunningham': jamieId,
  'david burson': davidId, 'david s burson': davidId,
  'jerry cusick': davidId, 'gerald cusick': davidId,
  'michael cusick': davidId, 'mike cusick': davidId,
  'pearl francisco': davidId, 'jay norvell': davidId, 'jay norwood': davidId,
};

const NMLS_TO_ID = { '180707': jamieId, '641790': davidId, '649445': davidId };

// Build email → mloId from loan data (most reliable, has NMLS)
const loanMloByEmail = new Map();
const BASE = 'Work/Dev/crm-migration/zoho-backup/Data';
const loans = loadCSV(`${BASE}/Loans_001.csv`);
for (const row of loans) {
  const email = (row['Email'] || '').trim().toLowerCase();
  if (!email) continue;
  const nmls = (row['LO NMLS'] || '').trim();
  const lo = (row['Loan Officer'] || '').trim().toLowerCase();
  const mloId = (nmls && NMLS_TO_ID[nmls]) || MLO_NAME_MAP[lo] || null;
  if (mloId) loanMloByEmail.set(email, mloId);
}

// Build email → mloId from contacts data
const contactMloByEmail = new Map();
const contacts = loadCSV(`${BASE}/Contacts_001.csv`);
for (const row of contacts) {
  const email = (row['Email'] || '').trim().toLowerCase();
  if (!email) continue;
  const lo = (row['Loan Officer'] || '').trim().toLowerCase();
  const mloId = MLO_NAME_MAP[lo] || null;
  if (mloId) contactMloByEmail.set(email, mloId);
}

// Build email → mloId from leads data
const leadMloByEmail = new Map();
const leads = loadCSV(`${BASE}/Leads_001.csv`);
for (const row of leads) {
  const email = (row['Email'] || '').trim().toLowerCase();
  if (!email) continue;
  const lo = (row['Loan Officer'] || '').trim().toLowerCase();
  const mloId = MLO_NAME_MAP[lo] || null;
  if (mloId) leadMloByEmail.set(email, mloId);
}

console.log(`\nMLO maps: loans=${loanMloByEmail.size}, contacts=${contactMloByEmail.size}, leads=${leadMloByEmail.size}`);

// Update contacts
console.log('\nUpdating contact MLO assignments...');
const dbContacts = await sql`SELECT id, email FROM contacts WHERE email IS NOT NULL AND assigned_mlo_id IS NULL`;
let contactsUpdated = 0;
for (const c of dbContacts) {
  const email = c.email.toLowerCase().trim();
  const mloId = contactMloByEmail.get(email) || loanMloByEmail.get(email) || davidId; // default to David
  await sql`UPDATE contacts SET assigned_mlo_id = ${mloId} WHERE id = ${c.id}`;
  contactsUpdated++;
}
// Also update any without email
const noEmailContacts = await sql`SELECT id FROM contacts WHERE assigned_mlo_id IS NULL`;
for (const c of noEmailContacts) {
  await sql`UPDATE contacts SET assigned_mlo_id = ${davidId} WHERE id = ${c.id}`;
  contactsUpdated++;
}
console.log(`  Contacts updated: ${contactsUpdated}`);

// Update leads
console.log('Updating lead MLO assignments...');
const dbLeads = await sql`SELECT id, email FROM leads WHERE email IS NOT NULL AND mlo_id IS NULL`;
let leadsUpdated = 0;
for (const l of dbLeads) {
  const email = l.email.toLowerCase().trim();
  const mloId = leadMloByEmail.get(email) || loanMloByEmail.get(email) || contactMloByEmail.get(email) || davidId;
  await sql`UPDATE leads SET mlo_id = ${mloId} WHERE id = ${l.id}`;
  leadsUpdated++;
}
console.log(`  Leads updated: ${leadsUpdated}`);

// Verify
const contactsWithMlo = await sql`SELECT COUNT(*) as c FROM contacts WHERE assigned_mlo_id IS NOT NULL`;
const contactsTotal = await sql`SELECT COUNT(*) as c FROM contacts`;
const leadsWithMlo = await sql`SELECT COUNT(*) as c FROM leads WHERE mlo_id IS NOT NULL`;
const leadsTotal = await sql`SELECT COUNT(*) as c FROM leads`;

console.log(`\nVerification:`);
console.log(`  Contacts with MLO: ${contactsWithMlo[0].c}/${contactsTotal[0].c}`);
console.log(`  Leads with MLO: ${leadsWithMlo[0].c}/${leadsTotal[0].c}`);

// Show breakdown by MLO
const byMlo = await sql`
  SELECT m.first_name, m.last_name, COUNT(c.id) as contacts
  FROM mlos m LEFT JOIN contacts c ON c.assigned_mlo_id = m.id
  GROUP BY m.id, m.first_name, m.last_name
`;
console.log('\nContacts by MLO:');
byMlo.forEach(r => console.log(`  ${r.first_name} ${r.last_name}: ${r.contacts}`));

const leadsByMlo = await sql`
  SELECT m.first_name, m.last_name, COUNT(l.id) as leads
  FROM mlos m LEFT JOIN leads l ON l.mlo_id = m.id
  GROUP BY m.id, m.first_name, m.last_name
`;
console.log('Leads by MLO:');
leadsByMlo.forEach(r => console.log(`  ${r.first_name} ${r.last_name}: ${r.leads}`));

console.log('\nDone!');
