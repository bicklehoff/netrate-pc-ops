const { neon } = require('@neondatabase/serverless');
require('dotenv').config();
const sql = neon(process.env.DATABASE_URL);

sql`SELECT id, title, product, status, priority, ticket_type FROM tickets ORDER BY created_at DESC LIMIT 10`
  .then(rows => {
    console.log('Tickets in DB:', rows.length);
    rows.forEach(r => console.log(`  ${r.product} | ${r.priority} | ${r.status} | ${r.ticket_type} | ${r.title.substring(0, 60)}`));
  })
  .catch(e => console.error(e.message));
