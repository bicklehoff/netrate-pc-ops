#!/usr/bin/env node
// One-time migration: Normalize all phone numbers to E.164 and merge duplicate contacts.
//
// What it does:
//   1. Normalizes phone numbers on Contact, Borrower, Lead, CallLog, SmsMessage, LoanContact
//   2. Finds duplicate contacts (same phone after normalization)
//   3. Merges duplicates: reassigns SMS, calls, loans, notes to the primary contact, deletes the duplicate
//
// Usage:
//   node scripts/normalize-phones.mjs          # Dry run (no writes)
//   node scripts/normalize-phones.mjs --apply  # Actually apply changes
//
// Requires: DATABASE_URL in .env or environment

import { WebSocket } from 'undici';
globalThis.WebSocket = WebSocket;

import { neonConfig, Pool } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../src/generated/prisma/index.js';
import 'dotenv/config';

neonConfig.webSocketConstructor = WebSocket;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaNeon(pool);
const prisma = new PrismaClient({ adapter });

const DRY_RUN = !process.argv.includes('--apply');

if (DRY_RUN) {
  console.log('=== DRY RUN === (pass --apply to make changes)\n');
}

function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`;
  if (digits.length > 11) return `+${digits}`;
  return null;
}

// ─── Step 1: Normalize phone fields on all tables ──────────────────
async function normalizeTable(model, label) {
  const records = await prisma[model].findMany({
    where: { phone: { not: null } },
    select: { id: true, phone: true },
  });

  let updated = 0;
  for (const r of records) {
    const normalized = normalizePhone(r.phone);
    if (normalized && normalized !== r.phone) {
      console.log(`  ${label} ${r.id}: "${r.phone}" → "${normalized}"`);
      if (!DRY_RUN) {
        await prisma[model].update({ where: { id: r.id }, data: { phone: normalized } });
      }
      updated++;
    }
  }
  console.log(`${label}: ${updated} of ${records.length} updated\n`);
  return updated;
}

async function normalizeNumberField(model, field, label) {
  const records = await prisma[model].findMany({
    where: { [field]: { not: null } },
    select: { id: true, [field]: true },
  });

  let updated = 0;
  for (const r of records) {
    const normalized = normalizePhone(r[field]);
    if (normalized && normalized !== r[field]) {
      console.log(`  ${label} ${r.id}: ${field} "${r[field]}" → "${normalized}"`);
      if (!DRY_RUN) {
        await prisma[model].update({ where: { id: r.id }, data: { [field]: normalized } });
      }
      updated++;
    }
  }
  console.log(`${label} (${field}): ${updated} of ${records.length} updated\n`);
  return updated;
}

// ─── Step 2: Find and merge duplicate contacts ────────────────────
async function mergeDuplicateContacts() {
  const contacts = await prisma.contact.findMany({
    where: { phone: { not: null } },
    select: { id: true, phone: true, firstName: true, lastName: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  // Group by phone
  const byPhone = {};
  for (const c of contacts) {
    if (!c.phone) continue;
    if (!byPhone[c.phone]) byPhone[c.phone] = [];
    byPhone[c.phone].push(c);
  }

  let mergeCount = 0;
  for (const [phone, group] of Object.entries(byPhone)) {
    if (group.length < 2) continue;

    // Primary = oldest (first created)
    const primary = group[0];
    const duplicates = group.slice(1);

    for (const dup of duplicates) {
      console.log(`  MERGE: "${dup.firstName} ${dup.lastName}" (${dup.id}) → "${primary.firstName} ${primary.lastName}" (${primary.id}) [phone: ${phone}]`);

      if (!DRY_RUN) {
        // Reassign SMS messages
        await prisma.smsMessage.updateMany({
          where: { contactId: dup.id },
          data: { contactId: primary.id },
        });

        // Reassign call logs
        await prisma.callLog.updateMany({
          where: { contactId: dup.id },
          data: { contactId: primary.id },
        });

        // Reassign contact notes
        await prisma.contactNote.updateMany({
          where: { contactId: dup.id },
          data: { contactId: primary.id },
        });

        // Reassign leads
        await prisma.lead.updateMany({
          where: { contactId: dup.id },
          data: { contactId: primary.id },
        });

        // Reassign loan contacts
        await prisma.loanContact.updateMany({
          where: { contactId: dup.id },
          data: { contactId: primary.id },
        });

        // Reassign loans (contactId on Loan)
        await prisma.loan.updateMany({
          where: { contactId: dup.id },
          data: { contactId: primary.id },
        });

        // Delete duplicate
        await prisma.contact.delete({ where: { id: dup.id } });
      }
      mergeCount++;
    }
  }

  console.log(`Duplicate contacts merged: ${mergeCount}\n`);
  return mergeCount;
}

// ─── Main ─────────────────────────────────────────────────────────
async function main() {
  console.log('Step 1: Normalize phone numbers\n');

  await normalizeTable('contact', 'Contact');
  await normalizeTable('borrower', 'Borrower');
  await normalizeTable('lead', 'Lead');

  // CallLog and SmsMessage use fromNumber/toNumber fields
  await normalizeNumberField('callLog', 'fromNumber', 'CallLog');
  await normalizeNumberField('callLog', 'toNumber', 'CallLog');
  await normalizeNumberField('smsMessage', 'fromNumber', 'SmsMessage');
  await normalizeNumberField('smsMessage', 'toNumber', 'SmsMessage');

  // LoanContact has phone
  await normalizeNumberField('loanContact', 'phone', 'LoanContact');

  console.log('\nStep 2: Merge duplicate contacts\n');
  await mergeDuplicateContacts();

  if (DRY_RUN) {
    console.log('=== DRY RUN COMPLETE === Run with --apply to execute changes.');
  } else {
    console.log('=== MIGRATION COMPLETE ===');
  }
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
    pool.end();
  });
