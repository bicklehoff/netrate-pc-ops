#!/usr/bin/env node

/**
 * Create rate_history table directly via SQL.
 *
 * We can't use prisma migrate/push because the shared Neon DB has
 * Mac's ops_* tables that Prisma wants to drop. This script creates
 * just the rate_history table without touching anything else.
 *
 * Usage: node scripts/create-rate-history-table.js
 *
 * Requires DATABASE_URL in .env or environment.
 */

const { neon } = require('@neondatabase/serverless');

// Load .env
require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not found in environment');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function main() {
  console.log('Creating rate_history table...\n');

  // Check if table already exists
  const exists = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'rate_history'
    ) as exists
  `;

  if (exists[0].exists) {
    console.log('Table rate_history already exists. Skipping creation.');
    return;
  }

  // Create the table
  await sql`
    CREATE TABLE rate_history (
      id SERIAL PRIMARY KEY,
      date DATE NOT NULL,
      loan_type VARCHAR(20) NOT NULL,
      term INTEGER NOT NULL,
      credit_score_tier VARCHAR(10) NOT NULL,
      rate DECIMAL(5,3) NOT NULL,
      apr DECIMAL(5,3),
      points DECIMAL(4,3),
      loan_amount INTEGER,
      ltv INTEGER,
      lender VARCHAR(100),
      loan_purpose VARCHAR(20),
      property_type VARCHAR(20),
      created_at TIMESTAMP(3) DEFAULT NOW()
    )
  `;

  console.log('✓ Table created.');

  // Create the composite index for common queries
  await sql`
    CREATE INDEX idx_rate_history_lookup
    ON rate_history(date, loan_type, credit_score_tier)
  `;

  console.log('✓ Index idx_rate_history_lookup created.');
  console.log('\nDone! rate_history table is ready.');
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
