// Test if Prisma can see tickets - simulates what the API does
const { neon } = require('@neondatabase/serverless');
require('dotenv').config();
const sql = neon(process.env.DATABASE_URL);

async function main() {
  // Raw SQL - what's actually in the table
  const raw = await sql`SELECT COUNT(*) as count FROM tickets`;
  console.log('Raw SQL ticket count:', raw[0].count);

  // Check if there's a column mismatch
  const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'tickets' ORDER BY ordinal_position`;
  console.log('Ticket columns:', cols.map(c => c.column_name).join(', '));

  // Check a sample ticket
  const sample = await sql`SELECT id, title, status, product, ticket_type, created_at FROM tickets LIMIT 1`;
  console.log('Sample ticket:', JSON.stringify(sample[0], null, 2));
}

main().catch(e => console.error(e.message));
