// Schema Migration 2: Account + AccountContact tables + mlo_id on leads
// Run: node --env-file=.env scripts/crm-migration/apply-schema-2.mjs

import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);

console.log('Creating accounts table...');
await sql`
  CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    website TEXT,
    industry TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    notes TEXT,
    zoho_account_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  )
`;
await sql`CREATE INDEX IF NOT EXISTS idx_accounts_industry ON accounts (industry)`;

console.log('Creating account_contacts table...');
await sql`
  CREATE TABLE IF NOT EXISTS account_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    role TEXT,
    title TEXT,
    is_primary BOOLEAN DEFAULT false,
    notes TEXT,
    zoho_contact_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  )
`;
await sql`CREATE INDEX IF NOT EXISTS idx_account_contacts_account ON account_contacts (account_id)`;
await sql`CREATE INDEX IF NOT EXISTS idx_account_contacts_email ON account_contacts (email)`;

console.log('Adding mlo_id to leads...');
await sql`ALTER TABLE leads ADD COLUMN IF NOT EXISTS mlo_id UUID`;
await sql`CREATE INDEX IF NOT EXISTS idx_leads_mlo_id ON leads (mlo_id)`;

// Verify
const accts = await sql`SELECT COUNT(*) as c FROM information_schema.columns WHERE table_name = 'accounts'`;
const acctContacts = await sql`SELECT COUNT(*) as c FROM information_schema.columns WHERE table_name = 'account_contacts'`;
console.log(`\naccounts table: ${accts[0].c} columns`);
console.log(`account_contacts table: ${acctContacts[0].c} columns`);
console.log('Done!');
