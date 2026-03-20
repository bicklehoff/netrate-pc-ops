const { neon } = require('@neondatabase/serverless');
require('dotenv').config();
const sql = neon(process.env.DATABASE_URL);

async function main() {
  // Add missing image_url column to ticket_entries
  const exists = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.columns
      WHERE table_name = 'ticket_entries' AND column_name = 'image_url'
    ) as exists
  `;

  if (exists[0].exists) {
    console.log('image_url column already exists. Nothing to do.');
    return;
  }

  await sql`ALTER TABLE ticket_entries ADD COLUMN image_url TEXT`;
  console.log('Added image_url column to ticket_entries.');
}

main().catch(e => console.error(e.message));
