const { neon } = require('@neondatabase/serverless');
require('dotenv').config();
const sql = neon(process.env.DATABASE_URL);

sql`UPDATE tickets SET status = 'closed', closed_at = NOW(), updated_at = NOW() WHERE title ILIKE '%floating navigation%' RETURNING title`
  .then(r => console.log('Closed:', r[0]?.title || 'not found'))
  .catch(e => console.error(e.message));
