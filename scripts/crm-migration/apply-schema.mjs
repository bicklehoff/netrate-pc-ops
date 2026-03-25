// CRM Schema Migration — applies new columns via raw SQL
// Run: node --env-file=.env scripts/crm-migration/apply-schema.mjs

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function run() {
  console.log('Adding columns to contacts table...');

  // Lifecycle
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'subscriber'`;
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS contact_type TEXT`;

  // Marketing
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS newsletter_opt_in BOOLEAN DEFAULT false`;
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS strike_rate_opt_in BOOLEAN DEFAULT false`;
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS email_opt_out BOOLEAN DEFAULT false`;
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS sms_opt_out BOOLEAN DEFAULT false`;
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_campaign TEXT`;
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_campaign_date TIMESTAMPTZ`;

  // Pipeline / CRM
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_score INTEGER`;
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ`;
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS next_follow_up TIMESTAMPTZ`;
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS assigned_mlo_id UUID`;

  // Property
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS property_address TEXT`;
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS current_loan_amount DECIMAL(12,2)`;
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS current_rate DECIMAL(5,3)`;
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS current_loan_term INTEGER`;
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS current_loan_date TIMESTAMPTZ`;
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS home_value DECIMAL(12,2)`;

  // Post-close
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS funded_date TIMESTAMPTZ`;
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS survey_sent_at TIMESTAMPTZ`;
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS review_requested BOOLEAN DEFAULT false`;
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS anniversary_date TIMESTAMPTZ`;

  // Co-borrower
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS co_borrower_name TEXT`;
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS co_borrower_email TEXT`;
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS co_borrower_phone TEXT`;
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS linked_contact_id UUID`;

  // Personal / Address
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS date_of_birth TIMESTAMPTZ`;
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS mailing_address TEXT`;
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS city TEXT`;
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS state TEXT`;
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS zip_code TEXT`;

  // Import tracking
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS zoho_contact_id TEXT`;
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS zoho_account_id TEXT`;
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS homeiq_imported BOOLEAN DEFAULT false`;
  await sql`ALTER TABLE contacts ADD COLUMN IF NOT EXISTS original_source TEXT`;

  console.log('Adding indexes...');
  await sql`CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts (status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_contacts_contact_type ON contacts (contact_type)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_contacts_assigned_mlo ON contacts (assigned_mlo_id)`;

  console.log('Creating contact_notes table...');
  await sql`
    CREATE TABLE IF NOT EXISTS contact_notes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      title TEXT,
      author_type TEXT NOT NULL,
      author_id UUID,
      source TEXT,
      zoho_note_id TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_contact_notes_contact_id ON contact_notes (contact_id)`;

  console.log('Adding lead -> contact FK...');
  // Check if FK already exists before adding
  const existingLeadFK = await sql`
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'leads_contact_id_fkey' AND table_name = 'leads'
  `;
  if (existingLeadFK.length === 0) {
    await sql`ALTER TABLE leads ADD CONSTRAINT leads_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id)`;
  } else {
    console.log('  (already exists)');
  }

  console.log('Adding contact -> mlo FK...');
  const existingMloFK = await sql`
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'contacts_assigned_mlo_id_fkey' AND table_name = 'contacts'
  `;
  if (existingMloFK.length === 0) {
    await sql`ALTER TABLE contacts ADD CONSTRAINT contacts_assigned_mlo_id_fkey FOREIGN KEY (assigned_mlo_id) REFERENCES mlos(id)`;
  } else {
    console.log('  (already exists)');
  }

  // Verify
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'contacts' ORDER BY ordinal_position
  `;
  console.log(`\nContacts table now has ${cols.length} columns`);

  const notesCols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'contact_notes'
  `;
  console.log(`contact_notes table has ${notesCols.length} columns`);

  const contactCount = await sql`SELECT COUNT(*) as c FROM contacts`;
  console.log(`Existing contacts preserved: ${contactCount[0].c}`);

  console.log('\nSchema migration complete!');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
