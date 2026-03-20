#!/usr/bin/env node
/**
 * Quick backlog viewer — shows open tickets from the database.
 *
 * Usage:
 *   node scripts/backlog.js            # all open tickets
 *   node scripts/backlog.js all        # all tickets (including closed)
 *   node scripts/backlog.js portal     # filter by product
 */

require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DIRECT_URL);

async function main() {
  const arg = process.argv[2];

  let where = "WHERE t.status NOT IN ('closed', 'resolved')";
  if (arg === 'all') {
    where = '';
  } else if (['website', 'portal', 'corebot'].includes(arg)) {
    where = `WHERE t.product = '${arg}'`;
  }

  const tickets = await sql`SELECT t.id, t.title, t.product, t.ticket_type, t.priority, t.status, t.created_by, t.created_at,
    (SELECT COUNT(*) FROM ticket_entries te WHERE te.ticket_id = t.id) as comments
    FROM tickets t ${sql.unsafe(where)} ORDER BY
      CASE t.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
      t.created_at DESC`;

  if (tickets.length === 0) {
    console.log('No tickets found.');
    return;
  }

  console.log(`\n  BACKLOG (${tickets.length} ticket${tickets.length !== 1 ? 's' : ''})\n`);
  console.log('  ' + '-'.repeat(90));

  for (const t of tickets) {
    const pri = t.priority === 'critical' ? '!!! ' : t.priority === 'high' ? '!!  ' : '    ';
    const date = new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const comments = t.comments > 0 ? ` [${t.comments} comment${t.comments > 1 ? 's' : ''}]` : '';
    console.log(`  ${pri}${t.status.padEnd(12)} ${t.product.padEnd(8)} ${t.ticket_type.padEnd(12)} ${t.title}${comments}`);
    console.log(`  ${''.padEnd(4)}${date}  ${t.id.substring(0, 8)}`);
  }

  console.log('  ' + '-'.repeat(90));
  console.log();
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
