const { neon } = require('@neondatabase/serverless');
require('dotenv').config();
const sql = neon(process.env.DATABASE_URL);

async function main() {
  const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'ticket_entries' ORDER BY ordinal_position`;
  console.log('ticket_entries columns:', cols.map(c => c.column_name).join(', '));

  // Also check indexes on tickets
  const indexes = await sql`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'tickets'`;
  console.log('\ntickets indexes:');
  indexes.forEach(i => console.log(`  ${i.indexname}`));
}
main().catch(e => console.error(e.message));
