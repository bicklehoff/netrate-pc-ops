/**
 * Create rate_alerts table via raw SQL.
 * Bypasses Prisma migrate (shared Neon DB has Mac's migrations that cause drift).
 * Same pattern as rate_history table creation.
 *
 * Run: node scripts/create-rate-alerts-table.mjs
 */

import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const sql = neon(process.env.DATABASE_URL);

async function createTable() {
  console.log('Creating rate_alerts table...');

  await sql`
    CREATE TABLE IF NOT EXISTS rate_alerts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) NOT NULL,
      type VARCHAR(20) NOT NULL DEFAULT 'strike',
      loan_type VARCHAR(30),
      target_rate DECIMAL(5, 3),
      loan_amount DECIMAL(12, 2),
      state VARCHAR(2),
      term INTEGER NOT NULL DEFAULT 30,
      rate_alerts BOOLEAN NOT NULL DEFAULT true,
      newsletter BOOLEAN NOT NULL DEFAULT true,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      confirmed_at TIMESTAMPTZ,
      confirm_token VARCHAR(64) UNIQUE,
      last_checked_at TIMESTAMPTZ,
      last_notified_at TIMESTAMPTZ,
      notify_count INTEGER NOT NULL DEFAULT 0,
      triggered_at TIMESTAMPTZ,
      triggered_rate DECIMAL(5, 3),
      contact_id UUID,
      source VARCHAR(50),
      ga_client_id VARCHAR(100),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_rate_alerts_email ON rate_alerts (email)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_rate_alerts_status_type ON rate_alerts (status, type)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_rate_alerts_type_status_loan ON rate_alerts (type, status, loan_type)`;

  console.log('rate_alerts table created successfully.');

  // Verify
  const result = await sql`SELECT count(*) FROM rate_alerts`;
  console.log('Row count:', result[0].count);
}

createTable().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
