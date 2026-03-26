#!/usr/bin/env node
/**
 * Data Migration: neondb → netrate_pc
 *
 * Copies all PC-side data from the shared neondb to the new standalone netrate_pc database.
 * Run with: node scripts/migrate-to-pc-db.js
 *
 * Prerequisites:
 * - OLD_DATABASE_URL in .env pointing to neondb (direct, not pooled)
 * - DATABASE_URL in .env pointing to netrate_pc (direct, not pooled)
 * - Schema already applied to netrate_pc (prisma db push)
 */

require('dotenv').config();
const { Client } = require('pg');

const OLD_DB = process.env.OLD_DATABASE_URL.replace('-pooler', '');
const NEW_DB = process.env.DATABASE_URL.replace('-pooler', '');

// Tables to migrate in dependency order (parents before children)
const TABLES = [
  // Auth & Identity (no FK deps)
  { name: 'borrowers', pk: 'id' },
  { name: 'mlos', pk: 'id' },

  // Loans (depends on borrowers, mlos)
  { name: 'loans', pk: 'id' },
  { name: 'loan_borrowers', pk: 'id' },
  { name: 'loan_dates', pk: 'id' },
  { name: 'loan_events', pk: 'id' },
  { name: 'loan_notes', pk: 'id' },
  { name: 'loan_tasks', pk: 'id' },
  { name: 'documents', pk: 'id' },
  { name: 'conditions', pk: 'id' },
  { name: 'loan_contacts', pk: 'id' },

  // CRM (contacts depends on borrowers, mlos)
  { name: 'contacts', pk: 'id' },
  { name: 'contact_notes', pk: 'id' },
  { name: 'accounts', pk: 'id' },
  { name: 'account_contacts', pk: 'id' },

  // Communications
  { name: 'call_logs', pk: 'id' },
  { name: 'call_notes', pk: 'id' },
  { name: 'sms_messages', pk: 'id' },

  // Leads
  { name: 'leads', pk: 'id' },
  { name: 'lead_quotes', pk: 'id' },

  // Market & Rates
  { name: 'rate_history', pk: 'id' },
  { name: 'rate_alerts', pk: 'id' },
  { name: 'market_summaries', pk: 'id' },
  { name: 'rate_watch_commentaries', pk: 'id' },

  // Scenarios
  { name: 'hecm_scenarios', pk: 'id' },

  // Tickets
  { name: 'tickets', pk: 'id' },
  { name: 'ticket_entries', pk: 'id' },
];

async function migrateTable(oldClient, newClient, table) {
  const { name } = table;

  // Get row count from old DB
  const countResult = await oldClient.query(`SELECT COUNT(*) FROM ${name}`);
  const oldCount = parseInt(countResult.rows[0].count);

  if (oldCount === 0) {
    console.log(`  ${name}: 0 rows (skipping)`);
    return { name, oldCount: 0, newCount: 0, status: 'skipped' };
  }

  // Get all rows from old DB
  const rows = await oldClient.query(`SELECT * FROM ${name}`);

  if (rows.rows.length === 0) {
    console.log(`  ${name}: 0 rows (skipping)`);
    return { name, oldCount: 0, newCount: 0, status: 'skipped' };
  }

  // Get column names from first row
  const columns = Object.keys(rows.rows[0]);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const columnList = columns.map(c => `"${c}"`).join(', ');

  // Insert into new DB in batches
  const BATCH_SIZE = 100;
  let inserted = 0;

  for (let i = 0; i < rows.rows.length; i += BATCH_SIZE) {
    const batch = rows.rows.slice(i, i + BATCH_SIZE);

    for (const row of batch) {
      const values = columns.map(c => row[c]);
      try {
        await newClient.query(
          `INSERT INTO ${name} (${columnList}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
          values
        );
        inserted++;
      } catch (err) {
        console.error(`  ERROR inserting into ${name}: ${err.message}`);
        console.error(`  Row: ${JSON.stringify(row).slice(0, 200)}`);
      }
    }
  }

  // Verify count in new DB
  const newCountResult = await newClient.query(`SELECT COUNT(*) FROM ${name}`);
  const newCount = parseInt(newCountResult.rows[0].count);

  const match = newCount === oldCount ? '✓' : `✗ (expected ${oldCount})`;
  console.log(`  ${name}: ${oldCount} → ${newCount} ${match}`);

  // Fix auto-increment sequences for integer PK tables
  if (table.pk === 'id') {
    try {
      await newClient.query(`
        SELECT setval(pg_get_serial_sequence('${name}', 'id'), COALESCE((SELECT MAX(id) FROM ${name}), 0) + 1, false)
      `);
    } catch (_) {
      // Not an auto-increment table, that's fine
    }
  }

  return { name, oldCount, newCount, status: newCount === oldCount ? 'ok' : 'mismatch' };
}

async function seedBrokerConfig(newClient) {
  console.log('\n--- Seeding BrokerConfig ---');

  await newClient.query(`
    INSERT INTO broker_config (id, comp_rate, comp_cap_purchase, comp_cap_refi, business_name, business_address, phone, email, website, nmls, company_nmls, licensed_states, default_state, third_party_cost_defaults, created_at, updated_at)
    VALUES (
      'default',
      0.02,
      4595.00,
      3595.00,
      'NetRate Mortgage',
      '357 S McCaslin Blvd #200, Louisville, CO 80027',
      '303-444-5251',
      'david@netratemortgage.com',
      'https://www.netratemortgage.com',
      '641790',
      '1111861',
      ARRAY['CO', 'TX', 'OR', 'CA'],
      'CO',
      '{"CO": 2800, "TX": 3200, "OR": 2600, "CA": 3500}',
      NOW(),
      NOW()
    )
    ON CONFLICT (id) DO NOTHING
  `);
  console.log('  broker_config: seeded ✓');
}

async function seedRateLenders(newClient) {
  console.log('\n--- Seeding RateLenders ---');

  const lenders = [
    { code: 'everstream', name: 'EverStream Lending', uwFee: 999, priceFormat: '100-based', llpaMode: 'separate', maxCompPurchase: 4595, maxCompRefi: 3595 },
    { code: 'keystone', name: 'Keystone Funding', uwFee: 1125, priceFormat: '100-based', llpaMode: 'separate', maxCompPurchase: 3595, maxCompRefi: 3595 },
    { code: 'amwest', name: 'AmWest Funding', uwFee: 1295, priceFormat: 'discount', llpaMode: 'separate', maxCompPurchase: 4595, maxCompRefi: 3595 },
    { code: 'windsor', name: 'Windsor Mortgage Solutions', uwFee: 1295, priceFormat: '100-based', llpaMode: 'separate', maxCompPurchase: 4595, maxCompRefi: 3595 },
    { code: 'swmc', name: 'Sun West Mortgage Company', uwFee: 1195, priceFormat: 'discount', llpaMode: 'baked', maxCompPurchase: 4595, maxCompRefi: 3595 },
    { code: 'tls', name: 'The Loan Store', uwFee: 1281, priceFormat: 'discount', llpaMode: 'separate', maxCompPurchase: 4595, maxCompRefi: 3595 },
  ];

  for (const l of lenders) {
    await newClient.query(`
      INSERT INTO rate_lenders (id, code, name, uw_fee, price_format, llpa_mode, max_comp_cap_purchase, max_comp_cap_refi, status, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, 'active', NOW(), NOW())
      ON CONFLICT (code) DO NOTHING
    `, [l.code, l.name, l.uwFee, l.priceFormat, l.llpaMode, l.maxCompPurchase, l.maxCompRefi]);
    console.log(`  ${l.code}: seeded ✓`);
  }
}

async function seedFeeTemplates(newClient) {
  console.log('\n--- Seeding FeeTemplates ---');

  const templates = [
    {
      state: 'CO', purpose: 'purchase', label: 'Colorado Purchase Default',
      appraisal: 750, creditReport: 97, mersFee: 25, floodCert: 17, taxService: 57,
      titleLendersPolicy: 950, closingProtectionLetter: 25, settlementAgentFee: 200,
      recordingFees: 5, countyRecordingFee: 196,
      homeInsuranceAtClose: 2400, escrowInsuranceMonths: 2, escrowTaxMonths: 6
    },
    {
      state: 'CO', purpose: 'refinance', label: 'Colorado Refinance Default',
      appraisal: 750, creditReport: 97, mersFee: 25, floodCert: 17, taxService: 57,
      titleLendersPolicy: 550, closingProtectionLetter: 25, settlementAgentFee: 200,
      recordingFees: 5, countyRecordingFee: 196,
      homeInsuranceAtClose: 0, escrowInsuranceMonths: 7, escrowTaxMonths: 6
    },
    {
      state: 'TX', purpose: 'purchase', label: 'Texas Purchase Default',
      appraisal: 750, creditReport: 97, mersFee: 25, floodCert: 17, taxService: 57,
      titleLendersPolicy: 1100, closingProtectionLetter: 25, settlementAgentFee: 250,
      recordingFees: 10, countyRecordingFee: 250,
      homeInsuranceAtClose: 2800, escrowInsuranceMonths: 2, escrowTaxMonths: 6
    },
    {
      state: 'TX', purpose: 'refinance', label: 'Texas Refinance Default',
      appraisal: 750, creditReport: 97, mersFee: 25, floodCert: 17, taxService: 57,
      titleLendersPolicy: 650, closingProtectionLetter: 25, settlementAgentFee: 250,
      recordingFees: 10, countyRecordingFee: 250,
      homeInsuranceAtClose: 0, escrowInsuranceMonths: 7, escrowTaxMonths: 6
    },
  ];

  for (const t of templates) {
    await newClient.query(`
      INSERT INTO fee_templates (id, state, purpose, label, appraisal, credit_report, mers_fee, flood_cert, tax_service,
        title_lenders_policy, closing_protection_letter, settlement_agent_fee, recording_fees, county_recording_fee,
        home_insurance_at_close, escrow_insurance_months, escrow_tax_months, status, created_at, updated_at)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'active', NOW(), NOW())
      ON CONFLICT (state, county, purpose) DO NOTHING
    `, [t.state, t.purpose, t.label, t.appraisal, t.creditReport, t.mersFee, t.floodCert, t.taxService,
        t.titleLendersPolicy, t.closingProtectionLetter, t.settlementAgentFee, t.recordingFees, t.countyRecordingFee,
        t.homeInsuranceAtClose, t.escrowInsuranceMonths, t.escrowTaxMonths]);
    console.log(`  ${t.state} ${t.purpose}: seeded ✓`);
  }
}

async function main() {
  console.log('=== NetRate PC Database Migration ===');
  console.log(`Old DB: neondb`);
  console.log(`New DB: netrate_pc`);
  console.log('');

  const oldClient = new Client({ connectionString: OLD_DB });
  const newClient = new Client({ connectionString: NEW_DB });

  await oldClient.connect();
  await newClient.connect();

  console.log('--- Migrating Tables ---');
  const results = [];

  for (const table of TABLES) {
    try {
      const result = await migrateTable(oldClient, newClient, table);
      results.push(result);
    } catch (err) {
      console.error(`  FAILED ${table.name}: ${err.message}`);
      results.push({ name: table.name, oldCount: '?', newCount: '?', status: 'failed' });
    }
  }

  // Seed new tables
  await seedBrokerConfig(newClient);
  await seedRateLenders(newClient);
  await seedFeeTemplates(newClient);

  // Summary
  console.log('\n=== Migration Summary ===');
  const migrated = results.filter(r => r.status === 'ok');
  const skipped = results.filter(r => r.status === 'skipped');
  const failed = results.filter(r => r.status === 'failed' || r.status === 'mismatch');

  console.log(`Migrated: ${migrated.length} tables`);
  console.log(`Skipped (empty): ${skipped.length} tables`);
  if (failed.length > 0) {
    console.log(`FAILED: ${failed.length} tables`);
    failed.forEach(f => console.log(`  - ${f.name}: ${f.oldCount} → ${f.newCount}`));
  }

  const totalRows = results.reduce((sum, r) => sum + (r.newCount || 0), 0);
  console.log(`Total rows migrated: ${totalRows}`);

  await oldClient.end();
  await newClient.end();

  if (failed.length > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
