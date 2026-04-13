/**
 * Create content_pages table for the Content Publishing API.
 * Run once: node scripts/create-content-pages.mjs
 */

import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

const sql = neon(process.env.PC_DATABASE_URL || process.env.DATABASE_URL);

async function main() {
  console.log('Creating content_pages table...');

  await sql`
    CREATE TABLE IF NOT EXISTS content_pages (
      slug              TEXT PRIMARY KEY,
      title             TEXT NOT NULL,
      meta_title        TEXT,
      meta_description  TEXT NOT NULL,
      body              TEXT NOT NULL,
      category          TEXT,
      status            TEXT NOT NULL DEFAULT 'published',
      author            TEXT NOT NULL DEFAULT 'NetRate Mortgage',
      published_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_content_pages_status ON content_pages(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_content_pages_category ON content_pages(category)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_content_pages_published ON content_pages(published_at DESC)`;

  console.log('Done — content_pages table ready.');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
