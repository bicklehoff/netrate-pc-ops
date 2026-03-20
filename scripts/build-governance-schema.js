#!/usr/bin/env node

/**
 * Build merged governance Prisma schema.
 *
 * Combines:
 *   - PC's current LOANS + RATES models (PC is authority)
 *   - Governance's KNOWLEDGE + OPS + PAYROLL + COMPLIANCE models
 *
 * Output: writes to governance/prisma/schema.prisma
 *
 * Usage: node scripts/build-governance-schema.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

const GOVERNANCE_SCHEMA = 'D:\\PROJECTS\\netrate-governance\\prisma\\schema.prisma';
const PC_SCHEMA = path.resolve(__dirname, '..', 'prisma', 'schema.prisma');

const dryRun = process.argv.includes('--dry-run');

// ─── Helpers ──────────────────────────────────────────────

function extractModels(schemaContent) {
  const models = [];
  const lines = schemaContent.split('\n');
  let i = 0;

  while (i < lines.length) {
    if (lines[i].match(/^model\s+\w+/)) {
      const modelStart = i;
      // Find closing brace
      let braceCount = 0;
      while (i < lines.length) {
        if (lines[i].includes('{')) braceCount++;
        if (lines[i].includes('}')) braceCount--;
        if (braceCount === 0) break;
        i++;
      }
      const modelBlock = lines.slice(modelStart, i + 1).join('\n');
      const name = lines[modelStart].match(/^model\s+(\w+)/)[1];
      models.push({ name, block: modelBlock });
    }
    i++;
  }
  return models;
}

// ─── Read both schemas ──────────────────────────────────

console.log('Reading schemas...');
const pcContent = fs.readFileSync(PC_SCHEMA, 'utf-8');
const govContent = fs.readFileSync(GOVERNANCE_SCHEMA, 'utf-8');

const pcModels = extractModels(pcContent);
const govModels = extractModels(govContent);

console.log(`  PC: ${pcModels.length} models`);
console.log(`  Governance: ${govModels.length} models`);

// ─── Categorize PC models ──────────────────────────────

const PC_LOANS_MODELS = [
  'Borrower', 'Mlo', 'Loan', 'LoanBorrower', 'LoanEvent',
  'Document', 'Contact', 'CallLog', 'CallNote', 'SmsMessage',
  'LoanDates', 'Condition', 'LoanNote', 'LoanTask', 'LoanContact',
];

const PC_RATES_MODELS = [
  'RateHistory', 'Lender', 'RateSheet', 'RateRow',
];

const PC_EXTRAS_MODELS = [
  'HecmScenario', 'Ticket', 'TicketEntry', 'Lead',
];

// ─── Categorize governance-only models ────────────────

const GOV_KNOWLEDGE_MODELS = ['Thought', 'Session', 'Decision', 'Relay'];
const GOV_OPS_MODELS = govModels
  .filter(m => m.name.startsWith('Ops') && m.name !== 'OpsComplianceRule')
  .map(m => m.name);
const GOV_PAYROLL_MODELS = govModels
  .filter(m => m.name.startsWith('Pay'))
  .map(m => m.name);

// ─── Build merged schema ────────────────────────────────

const pcModelMap = Object.fromEntries(pcModels.map(m => [m.name, m]));
const govModelMap = Object.fromEntries(govModels.map(m => [m.name, m]));

let output = `// ═══════════════════════════════════════════════════════════════
// NetRate Shared Prisma Schema
// Database: Neon Postgres (PC's existing project)
// Repo: netrate-governance (shared across all devices)
//
// DOMAINS:
//   LOANS     — PC (borrower portal, loan applications, dialer)
//   RATES     — PC (rate pipeline, rate history, market watch)
//   WEBSITE   — PC (leads, tickets, HECM scenarios)
//   KNOWLEDGE — All agents (context layer: thoughts, sessions, decisions)
//   OPS       — Mac (TrackerPortal: projects, instructions, milestones)
//   PAYROLL   — Mac (funded loans, wire emails, loan officers)
//   COMPLIANCE— Claw (regulatory rules)
//
// RULES:
//   - No cross-domain foreign keys between LOANS and KNOWLEDGE
//   - Schema changes require governance approval (RELAY proposal)
//   - PC is authority for LOANS, RATES, WEBSITE domains
//   - Mac is authority for OPS, PAYROLL domains
//   - Claw is authority for COMPLIANCE domain
// ═══════════════════════════════════════════════════════════════

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  directUrl  = env("DIRECT_URL")
  extensions = [vector]
}

// ═══════════════════════════════════════════════════════════════
// LOANS DOMAIN — PC (Borrower Portal + Dialer)
// Authority: PC. Do NOT modify without PC approval via RELAY.
// ═══════════════════════════════════════════════════════════════

`;

// Add LOANS models from PC (source of truth)
for (const name of PC_LOANS_MODELS) {
  const model = pcModelMap[name];
  if (model) {
    output += model.block + '\n\n';
  } else {
    console.warn(`  ⚠ Missing PC model: ${name}`);
  }
}

// Add RATES domain
output += `// ═══════════════════════════════════════════════════════════════
// RATES DOMAIN — PC (Rate Pipeline + Market Watch)
// Authority: PC. Rate sheets, rate history, lender configs.
// ═══════════════════════════════════════════════════════════════

`;

for (const name of PC_RATES_MODELS) {
  const model = pcModelMap[name];
  if (model) {
    output += model.block + '\n\n';
  } else {
    console.warn(`  ⚠ Missing PC model: ${name}`);
  }
}

// Add WEBSITE EXTRAS domain
output += `// ═══════════════════════════════════════════════════════════════
// WEBSITE DOMAIN — PC (Leads, Tickets, HECM, Dev Backlog)
// Authority: PC. Public website features and internal tools.
// ═══════════════════════════════════════════════════════════════

`;

for (const name of PC_EXTRAS_MODELS) {
  const model = pcModelMap[name];
  if (model) {
    output += model.block + '\n\n';
  } else {
    console.warn(`  ⚠ Missing PC model: ${name}`);
  }
}

// Add KNOWLEDGE domain from governance (source of truth)
output += `// ═══════════════════════════════════════════════════════════════
// KNOWLEDGE DOMAIN — Context Layer (Open Brain)
// Isolated from all other domains. No foreign keys to LOANS.
// Accessed only via the netrate-context MCP server.
// ═══════════════════════════════════════════════════════════════

`;

for (const name of GOV_KNOWLEDGE_MODELS) {
  const model = govModelMap[name];
  if (model) {
    output += model.block + '\n\n';
  } else {
    console.warn(`  ⚠ Missing governance model: ${name}`);
  }
}

// Add OPS domain from governance
output += `// ═══════════════════════════════════════════════════════════════
// OPS DOMAIN — Mac (TrackerPortal)
// Authority: Mac. Do NOT modify without Mac approval via RELAY.
// ═══════════════════════════════════════════════════════════════

`;

for (const name of GOV_OPS_MODELS) {
  const model = govModelMap[name];
  if (model) {
    output += model.block + '\n\n';
  }
}

// Add PAYROLL domain from governance
output += `// ═══════════════════════════════════════════════════════════════
// PAYROLL DOMAIN — Mac (Funded Loans + Wire Tracking)
// Authority: Mac. Do NOT modify without Mac approval via RELAY.
// ═══════════════════════════════════════════════════════════════

`;

for (const name of GOV_PAYROLL_MODELS) {
  const model = govModelMap[name];
  if (model) {
    output += model.block + '\n\n';
  }
}

// Add COMPLIANCE domain from governance
output += `// ═══════════════════════════════════════════════════════════════
// COMPLIANCE DOMAIN — Claw (Regulatory Rules)
// Authority: Claw. Do NOT modify without Claw approval via RELAY.
// ═══════════════════════════════════════════════════════════════

`;

const complianceModel = govModelMap['OpsComplianceRule'];
if (complianceModel) {
  output += complianceModel.block + '\n';
}

// ─── Summary ──────────────────────────────────────────────

const allModelNames = extractModels(output).map(m => m.name);
console.log(`\nMerged schema: ${allModelNames.length} models`);

// Check for any governance models we missed
const govOnlyModels = govModels.filter(m => !allModelNames.includes(m.name));
if (govOnlyModels.length > 0) {
  console.log(`\n⚠ Governance models not in merged schema:`);
  govOnlyModels.forEach(m => console.log(`  - ${m.name}`));
}

// Check for any PC models we missed
const pcOnlyModels = pcModels.filter(m => !allModelNames.includes(m.name));
if (pcOnlyModels.length > 0) {
  console.log(`\n⚠ PC models not in merged schema:`);
  pcOnlyModels.forEach(m => console.log(`  - ${m.name}`));
}

if (dryRun) {
  console.log('\nDry run — writing to stdout:');
  console.log('---');
  console.log(output);
} else {
  fs.writeFileSync(GOVERNANCE_SCHEMA, output, 'utf-8');
  console.log(`\n✓ Written to: ${GOVERNANCE_SCHEMA}`);
}
