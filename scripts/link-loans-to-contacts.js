// One-time migration: Link existing loans to contacts
// For each Loan with a borrowerId, find or create a Contact, then set loan.contactId
//
// Run: node scripts/link-loans-to-contacts.js

const { neon } = require('@neondatabase/serverless');

async function main() {
  const sql = neon(process.env.PC_DATABASE_URL || process.env.DATABASE_URL);

  // Get all loans that don't have a contactId yet
  const loans = await sql`
    SELECT l.id, l.borrower_id, b.first_name, b.last_name, b.email, b.phone
    FROM loans l
    JOIN borrowers b ON l.borrower_id = b.id
    WHERE l.contact_id IS NULL AND l.borrower_id IS NOT NULL
  `;

  console.log(`Found ${loans.length} loans without contactId`);

  let created = 0;
  let linked = 0;
  let loanContactsCreated = 0;

  for (const loan of loans) {
    // Check if a Contact already exists for this borrower
    let contact = await sql`
      SELECT id FROM contacts WHERE borrower_id = ${loan.borrower_id} LIMIT 1
    `;

    if (contact.length === 0) {
      // Create Contact from Borrower data
      contact = await sql`
        INSERT INTO contacts (id, first_name, last_name, email, phone, borrower_id, source, status, created_at, updated_at)
        VALUES (gen_random_uuid(), ${loan.first_name}, ${loan.last_name}, ${loan.email}, ${loan.phone}, ${loan.borrower_id}, 'system-migration', 'past-client', NOW(), NOW())
        RETURNING id
      `;
      created++;
    }

    const contactId = contact[0].id;

    // Set contactId on the loan
    await sql`UPDATE loans SET contact_id = ${contactId} WHERE id = ${loan.id}`;
    linked++;

    // Create LoanContact if it doesn't exist
    const existing = await sql`
      SELECT id FROM loan_contacts WHERE loan_id = ${loan.id} AND contact_id = ${contactId} LIMIT 1
    `;
    if (existing.length === 0) {
      await sql`
        INSERT INTO loan_contacts (loan_id, contact_id, role, is_primary, name, email, phone, created_at, updated_at)
        VALUES (${loan.id}, ${contactId}, 'borrower', true, ${loan.first_name + ' ' + loan.last_name}, ${loan.email}, ${loan.phone}, NOW(), NOW())
      `;
      loanContactsCreated++;
    }
  }

  console.log(`Contacts created: ${created}`);
  console.log(`Loans linked: ${linked}`);
  console.log(`LoanContact records created: ${loanContactsCreated}`);

  // Verify
  const stats = await sql`
    SELECT
      COUNT(*) as total_loans,
      COUNT(contact_id) as with_contact,
      COUNT(*) - COUNT(contact_id) as without_contact
    FROM loans WHERE status != 'draft'
  `;
  console.log('\nVerification:', stats[0]);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
