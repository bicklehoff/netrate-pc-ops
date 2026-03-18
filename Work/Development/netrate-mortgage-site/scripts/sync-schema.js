#!/usr/bin/env node

/**
 * Sync PC's Prisma schema from governance master.
 *
 * Pulls all model definitions from netrate-governance/prisma/schema.prisma
 * and merges them into PC's schema, preserving PC's own generator and
 * datasource blocks (which use @prisma/adapter-neon for Vercel).
 *
 * Usage:
 *   node scripts/sync-schema.js           # Sync from local governance repo
 *   node scripts/sync-schema.js --diff    # Show what would change
 *
 * Run after governance schema changes:
 *   npm run prisma:sync
 */

const fs = require('fs');
const path = require('path');

const GOVERNANCE_SCHEMA = 'D:\\PROJECTS\\netrate-governance\\prisma\\schema.prisma';
const PC_SCHEMA = path.resolve(__dirname, '..', 'prisma', 'schema.prisma');

const diffOnly = process.argv.includes('--diff');

// ─── PC's generator + datasource (preserved verbatim) ─────

const PC_HEADER = `// NetRate Mortgage — Prisma Schema
// Database: Neon Postgres (via Vercel Marketplace)
// Synced from: netrate-governance/prisma/schema.prisma
// Run: npm run prisma:sync to update from governance master

generator client {
  provider   = "prisma-client"
  output     = "../src/generated/prisma"
  engineType = "client"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

`;

// ─── Extract everything after datasource block from governance ──

function extractModelsAndComments(schemaContent) {
  const lines = schemaContent.split('\n');
  let pastDatasource = false;
  let braceCount = 0;
  let inBlock = false;
  const result = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip until we're past the datasource block
    if (!pastDatasource) {
      if (line.match(/^datasource\s+/)) {
        inBlock = true;
      }
      if (inBlock) {
        if (line.includes('{')) braceCount++;
        if (line.includes('}')) braceCount--;
        if (braceCount === 0 && inBlock) {
          pastDatasource = true;
          inBlock = false;
        }
      }
      continue;
    }

    result.push(line);
  }

  return result.join('\n').trim();
}

// ─── Main ──────────────────────────────────────────────────

console.log('Syncing PC schema from governance master...\n');

if (!fs.existsSync(GOVERNANCE_SCHEMA)) {
  console.error(`Governance schema not found: ${GOVERNANCE_SCHEMA}`);
  console.error('Make sure netrate-governance is cloned at D:\\PROJECTS\\netrate-governance');
  process.exit(1);
}

const govContent = fs.readFileSync(GOVERNANCE_SCHEMA, 'utf-8');
const modelsAndComments = extractModelsAndComments(govContent);

const newSchema = PC_HEADER + modelsAndComments + '\n';

// Count models
const modelCount = (newSchema.match(/^model\s+\w+/gm) || []).length;
console.log(`  Models: ${modelCount}`);

if (diffOnly) {
  if (fs.existsSync(PC_SCHEMA)) {
    const current = fs.readFileSync(PC_SCHEMA, 'utf-8');
    const currentModels = (current.match(/^model\s+\w+/gm) || []).length;
    console.log(`  Current PC models: ${currentModels}`);
    console.log(`  After sync: ${modelCount}`);

    if (current === newSchema) {
      console.log('\n  Already in sync.');
    } else {
      console.log('\n  Changes detected. Run without --diff to apply.');
    }
  }
  return;
}

fs.writeFileSync(PC_SCHEMA, newSchema, 'utf-8');
console.log(`\n✓ Written to: ${PC_SCHEMA}`);
console.log('  Run: npx prisma generate');
