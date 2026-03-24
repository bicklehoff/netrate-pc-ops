#!/usr/bin/env node

/**
 * Rate Watch Commentary Ingestion Script
 *
 * Reads a markdown file or stdin content and inserts it into the
 * rate_watch_commentaries table via direct SQL.
 *
 * Usage:
 *   node scripts/ingest-rate-watch.mjs --file path/to/commentary.md
 *   echo "content" | node scripts/ingest-rate-watch.mjs
 *   node scripts/ingest-rate-watch.mjs --file commentary.md --date 2026-03-23 --sentiment neutral
 *
 * Options:
 *   --file <path>         Path to markdown file (or reads stdin if omitted)
 *   --date <YYYY-MM-DD>   Override date (default: today)
 *   --headline <text>     Override headline (default: first line of content)
 *   --sentiment <val>     bullish | bearish | neutral (default: neutral)
 *   --author <name>       Author name (default: "David Burson")
 *   --source <val>        Source tag (default: "manual")
 *   --treasury10yr <n>    10yr Treasury yield
 *   --treasury10yrChg <n> 10yr Treasury change
 *   --mbs6Coupon <str>    MBS 6.0 coupon price
 *   --mbs6Change <n>      MBS 6.0 change
 *   --dry-run             Show parsed data without writing to DB
 */

import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import fs from 'fs';
import { parseArgs } from 'util';

dotenv.config();

function parseContent(raw) {
  const lines = raw.trim().split('\n');

  // First non-empty line is the headline
  let headline = '';
  let bodyStartIdx = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line) {
      // Strip markdown heading prefix
      headline = line.replace(/^#+\s*/, '');
      bodyStartIdx = i + 1;
      break;
    }
  }

  // Skip any blank lines after headline, then rest is commentary
  while (bodyStartIdx < lines.length && !lines[bodyStartIdx].trim()) {
    bodyStartIdx++;
  }

  const commentary = lines.slice(bodyStartIdx).join('\n').trim();

  // Remove trailing author line if present (e.g. "— David Burson, NetRate Mortgage")
  const cleanedCommentary = commentary
    .replace(/\n+\s*[—–-]+\s*David Burson.*$/i, '')
    .trim();

  return { headline, commentary: cleanedCommentary };
}

function inferSentiment(text) {
  const lower = text.toLowerCase();
  const bullishSignals = ['rally', 'improved', 'dropped', 'fell', 'reprieve', 'ease', 'lower', 'decline'];
  const bearishSignals = ['surge', 'climbed', 'rose', 'higher', 'jumped', 'spike', 'pressure'];

  let bullish = 0;
  let bearish = 0;
  for (const s of bullishSignals) {
    if (lower.includes(s)) bullish++;
  }
  for (const s of bearishSignals) {
    if (lower.includes(s)) bearish++;
  }

  if (bullish > bearish + 1) return 'bullish';
  if (bearish > bullish + 1) return 'bearish';
  return 'neutral';
}

async function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      resolve(null);
      return;
    }
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    // Timeout after 2 seconds if no stdin
    setTimeout(() => resolve(data || null), 2000);
  });
}

async function main() {
  const { values } = parseArgs({
    options: {
      file: { type: 'string' },
      date: { type: 'string' },
      headline: { type: 'string' },
      sentiment: { type: 'string' },
      author: { type: 'string' },
      source: { type: 'string' },
      treasury10yr: { type: 'string' },
      treasury10yrChg: { type: 'string' },
      mbs6Coupon: { type: 'string' },
      mbs6Change: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    },
    strict: false,
  });

  // Read content from file or stdin
  let rawContent;
  if (values.file) {
    if (!fs.existsSync(values.file)) {
      console.error(`File not found: ${values.file}`);
      process.exit(1);
    }
    rawContent = fs.readFileSync(values.file, 'utf8');
  } else {
    rawContent = await readStdin();
    if (!rawContent) {
      console.error('No content provided. Use --file <path> or pipe content via stdin.');
      process.exit(1);
    }
  }

  // Parse content
  const { headline: parsedHeadline, commentary: parsedCommentary } = parseContent(rawContent);

  // Build record
  const today = new Date().toISOString().split('T')[0];
  const record = {
    date: values.date || today,
    headline: values.headline || parsedHeadline,
    commentary: parsedCommentary,
    sentiment: values.sentiment || inferSentiment(rawContent),
    author: values.author || 'David Burson',
    source: values.source || 'manual',
    treasury10yr: values.treasury10yr ? parseFloat(values.treasury10yr) : null,
    treasury10yrChg: values.treasury10yrChg ? parseFloat(values.treasury10yrChg) : null,
    mbs6Coupon: values.mbs6Coupon || null,
    mbs6Change: values.mbs6Change ? parseFloat(values.mbs6Change) : null,
  };

  if (!record.headline) {
    console.error('Could not parse headline from content. Use --headline to specify.');
    process.exit(1);
  }

  if (!record.commentary) {
    console.error('Could not parse commentary body from content.');
    process.exit(1);
  }

  console.log('\n--- Parsed Commentary ---');
  console.log(`Date:      ${record.date}`);
  console.log(`Headline:  ${record.headline}`);
  console.log(`Sentiment: ${record.sentiment}`);
  console.log(`Author:    ${record.author}`);
  console.log(`Source:    ${record.source}`);
  if (record.treasury10yr) console.log(`10yr:      ${record.treasury10yr}%`);
  if (record.mbs6Coupon) console.log(`MBS 6.0:   ${record.mbs6Coupon}`);
  console.log(`Body:      ${record.commentary.substring(0, 100)}...`);
  console.log('');

  if (values['dry-run']) {
    console.log('DRY RUN — no DB write.');
    process.exit(0);
  }

  // Insert into DB
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set. Check .env file.');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  const rows = await sql`
    INSERT INTO rate_watch_commentaries (
      date, headline, commentary, sentiment,
      treasury_10yr, treasury_10yr_chg, mbs_6_coupon, mbs_6_change,
      author, source, published_at, created_at
    ) VALUES (
      ${record.date}::date,
      ${record.headline},
      ${record.commentary},
      ${record.sentiment},
      ${record.treasury10yr},
      ${record.treasury10yrChg},
      ${record.mbs6Coupon},
      ${record.mbs6Change},
      ${record.author},
      ${record.source},
      NOW(), NOW()
    )
    ON CONFLICT (date) DO UPDATE SET
      headline = EXCLUDED.headline,
      commentary = EXCLUDED.commentary,
      sentiment = EXCLUDED.sentiment,
      treasury_10yr = EXCLUDED.treasury_10yr,
      treasury_10yr_chg = EXCLUDED.treasury_10yr_chg,
      mbs_6_coupon = EXCLUDED.mbs_6_coupon,
      mbs_6_change = EXCLUDED.mbs_6_change,
      author = EXCLUDED.author,
      source = EXCLUDED.source,
      published_at = NOW()
    RETURNING id, date
  `;

  console.log(`Saved commentary for ${rows[0].date} (id: ${rows[0].id})`);
}

main().catch((err) => {
  console.error('Ingestion failed:', err.message);
  process.exit(1);
});
