/**
 * Parse Rate Sheets from GCS
 *
 * Pulls raw rate sheet files from gs://netrate-rates/raw/{lender}/,
 * runs them through the appropriate parser, writes parsed JSON
 * to GCS, and seeds the pricing engine DB for active lenders.
 *
 * Run: node scripts/parse-gcs-rates.mjs
 * Schedule: daily after OC's morning rate sheet upload (~6:30 AM)
 *
 * File ID → Lender mapping:
 *   47006 → amwest
 *   61534 → tls
 *   80220 → keystone
 *   96573 → everstream (rates CSV)
 *   96596 → everstream (LLPAs XLSX)
 *   99522 → swmc
 */

import { SignJWT, importPKCS8 } from 'jose';
import { createRequire } from 'module';
import dotenv from 'dotenv';

dotenv.config({ path: new URL('../.env', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1') });

const require = createRequire(import.meta.url);
const { writeRatesToDB } = require('../src/lib/rates/db-writer');

// Lenders with DB pipeline ready — parsed rates get seeded to rate_prices
// TLS excluded: rate sheet has no LLPA data, can't price accurately (see lenders/tls.md)
const DB_READY_LENDERS = new Set(['everstream', 'swmc', 'keystone', 'amwest', 'windsor']);

// Lenders to skip entirely (no parse, no upload)
const EXCLUDED_LENDERS = new Set(['tls']);

// Parsers (CommonJS)
const keystoneParser = require('../src/lib/rates/parsers/keystone.js');
const swmcParser = require('../src/lib/rates/parsers/swmc.js');
const amwestParser = require('../src/lib/rates/parsers/amwest.js');
const everstreamParser = require('../src/lib/rates/parsers/everstream.js');
const windsorParser = require('../src/lib/rates/parsers/windsor.js');

const BUCKET = process.env.GCS_BUCKET_NAME || 'netrate-rates';

// File ID prefix → lender mapping
const FILE_LENDER_MAP = {
  '47006': 'amwest',
  '61534': 'tls',
  '65196': 'windsor',
  '80220': 'keystone',
  '96573': 'everstream',
  '96596': 'everstream',
  '99522': 'swmc',
};

// ─── GCS Auth ─────────────────────────────────────────────────────

let tokenCache = { token: null, expiresAt: 0 };

async function getToken() {
  const now = Date.now();
  if (tokenCache.token && now < tokenCache.expiresAt - 60000) return tokenCache.token;

  const key = JSON.parse(process.env.GCS_SERVICE_ACCOUNT_KEY);
  const pk = await importPKCS8(key.private_key, 'RS256');
  const jwt = await new SignJWT({ scope: 'https://www.googleapis.com/auth/devstorage.full_control' })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(key.client_email)
    .setSubject(key.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(pk);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  const data = await res.json();
  tokenCache = { token: data.access_token, expiresAt: now + data.expires_in * 1000 };
  return data.access_token;
}

async function listFiles(prefix) {
  const token = await getToken();
  const res = await fetch(
    `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o?prefix=${encodeURIComponent(prefix)}&maxResults=100`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  return data.items || [];
}

async function downloadFile(path) {
  const token = await getToken();
  const res = await fetch(
    `https://storage.googleapis.com/storage/v1/b/${BUCKET}/o/${encodeURIComponent(path)}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Download failed: ${path} (${res.status})`);
  return res;
}

async function downloadText(path) {
  const res = await downloadFile(path);
  return res.text();
}

async function downloadBuffer(path) {
  const res = await downloadFile(path);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

async function uploadJson(path, data) {
  const token = await getToken();
  const body = JSON.stringify(data, null, 2);
  const res = await fetch(
    `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=media&name=${encodeURIComponent(path)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body,
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Upload failed: ${path} (${res.status}) ${err}`);
  }
  console.log(`  ✓ Uploaded ${path} (${(body.length / 1024).toFixed(1)}KB)`);
}

async function uploadText(path, text) {
  const token = await getToken();
  const res = await fetch(
    `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o?uploadType=media&name=${encodeURIComponent(path)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'text/plain',
      },
      body: text,
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Upload marker failed: ${path} (${res.status}) ${err}`);
  }
}

// ─── Parse Logic ──────────────────────────────────────────────────

/**
 * Find the most recent file for each lender in raw/
 */
async function findLatestRawFiles() {
  const allFiles = await listFiles('raw/');

  // Group by lender (using file ID prefix, not folder name)
  const byLender = {};
  for (const file of allFiles) {
    if (file.size === '0') continue; // skip directory markers
    const filename = file.name.split('/').pop();
    const fileId = filename.split('_')[0];
    const lender = FILE_LENDER_MAP[fileId];
    if (!lender) {
      console.log(`  ? Unknown file ID ${fileId}: ${file.name}`);
      continue;
    }
    if (!byLender[lender]) byLender[lender] = [];
    byLender[lender].push({
      path: file.name,
      filename,
      fileId,
      size: parseInt(file.size),
      updated: file.updated,
      isCSV: filename.endsWith('.csv'),
      isXLSX: filename.endsWith('.xlsx') || filename.endsWith('.xlsm'),
    });
  }

  // For each lender, keep the most recent file(s)
  const latest = {};
  for (const [lender, files] of Object.entries(byLender)) {
    // Sort by updated date descending
    files.sort((a, b) => new Date(b.updated) - new Date(a.updated));
    latest[lender] = files;
  }

  return latest;
}

async function parseKeystone(files) {
  const xlsxFile = files.find(f => f.isXLSX);
  if (!xlsxFile) throw new Error('Keystone: No XLSX file found');
  console.log(`  Downloading ${xlsxFile.filename}...`);
  const buf = await downloadBuffer(xlsxFile.path);
  const result = keystoneParser.parseRates(buf);
  console.log(`  Parsed: ${result.programs.length} programs`);
  return {
    lenderId: 'keystone',
    sheetDate: result.sheetDate,
    programs: result.programs,
    llpas: result.llpas || null,
    loanAmountAdj: result.loanAmountAdj || null,
    stateAdj: result.stateAdj || null,
    specPayups: result.specPayups || null,
    pricingSpecials: result.pricingSpecials || null,
    occupancyAdj: result.occupancyAdj || null,
    lenderFee: result.lenderFee || null,
  };
}

async function parseSWMC(files) {
  const xlsxFile = files.find(f => f.isXLSX);
  if (!xlsxFile) throw new Error('SWMC: No XLSX file found');
  console.log(`  Downloading ${xlsxFile.filename}...`);
  const buf = await downloadBuffer(xlsxFile.path);
  const result = swmcParser.parseRates(buf);
  console.log(`  Parsed: ${result.programs.length} programs, date: ${result.sheetDate}`);
  return {
    lenderId: 'swmc',
    sheetDate: result.sheetDate,
    programs: result.programs,
    llpas: result.llpas,
    loanAmountAdj: result.loanAmountAdj,
    stateAdj: result.stateAdj,
    specPayups: result.specPayups,
    pricingSpecials: result.pricingSpecials,
    occupancyAdj: result.occupancyAdj,
    lenderFee: result.lenderFee,
    compCap: result.compCap,
    agencyAdj: result.agencyAdj,
    govAdj: result.govAdj,
    fees: result.fees,
  };
}

async function parseAmWest(files) {
  const xlsxFile = files.find(f => f.isXLSX);
  if (!xlsxFile) throw new Error('AmWest: No XLSX file found');
  console.log(`  Downloading ${xlsxFile.filename}...`);
  const buf = await downloadBuffer(xlsxFile.path);
  const result = amwestParser.parseRates(buf);
  console.log(`  Parsed: ${result.programs.length} programs, date: ${result.sheetDate}`);
  return {
    lenderId: 'amwest',
    sheetDate: result.sheetDate,
    programs: result.programs,
    llpas: result.llpas,
    loanAmountAdj: result.loanAmountAdj,
    stateAdj: result.stateAdj,
    specPayups: result.specPayups,
    pricingSpecials: result.pricingSpecials,
    occupancyAdj: result.occupancyAdj,
    lenderFee: result.lenderFee,
    compCap: result.compCap,
    // AmWest-specific
    fastTrackLlpas: result.fastTrackLlpas,
    agencyLlpas: result.agencyLlpas,
    govAdj: result.govAdj,
    jumboAdj: result.jumboAdj,
  };
}

async function parseEverStream(files) {
  const csvFile = files.find(f => f.isCSV);
  const xlsxFile = files.find(f => f.isXLSX);
  if (!csvFile) throw new Error('EverStream: No CSV file found');
  console.log(`  Downloading ${csvFile.filename}...`);
  const csv = await downloadText(csvFile.path);

  let xlsxBuf = null;
  if (xlsxFile) {
    console.log(`  Downloading ${xlsxFile.filename} (LLPAs)...`);
    xlsxBuf = await downloadBuffer(xlsxFile.path);
  }

  // Use combined parser for standard output format
  const result = everstreamParser.parse(csv, xlsxBuf);
  console.log(`  Parsed: ${result.programs.length} programs, date: ${result.sheetDate}`);

  return {
    lenderId: 'everstream',
    sheetDate: result.sheetDate,
    programs: result.programs,
    llpas: result.llpas,
    loanAmountAdj: result.loanAmountAdj,
    stateAdj: result.stateAdj,
    specPayups: result.specPayups,
    pricingSpecials: result.pricingSpecials,
    occupancyAdj: result.occupancyAdj,
    lenderFee: result.lenderFee,
    compCap: result.compCap,
    agencyLlpas: result.agencyLlpas,
  };
}

async function parseWindsor(files) {
  const xlsxFile = files.find(f => f.isXLSX);
  if (!xlsxFile) throw new Error('Windsor: No XLSX file found');
  console.log(`  Downloading ${xlsxFile.filename}...`);
  const buf = await downloadBuffer(xlsxFile.path);
  const result = windsorParser.parseRates(buf);
  console.log(`  Parsed: ${result.programs.length} programs, date: ${result.sheetDate}`);
  return {
    lenderId: 'windsor',
    sheetDate: result.sheetDate,
    programs: result.programs,
    llpas: result.llpas,
    loanAmountAdj: result.loanAmountAdj,
    stateAdj: result.stateAdj,
    specPayups: result.specPayups,
    pricingSpecials: result.pricingSpecials,
    occupancyAdj: result.occupancyAdj,
    lenderFee: result.lenderFee,
    compCap: result.compCap,
    convLlpas: result.convLlpas,
    govAdj: result.govAdj,
    jumboAdj: result.jumboAdj,
  };
}

const PARSERS = {
  keystone: parseKeystone,
  swmc: parseSWMC,
  amwest: parseAmWest,
  everstream: parseEverStream,
  windsor: parseWindsor,
};

// ─── Main ─────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== Parse GCS Rate Sheets ===`);
  console.log(`Bucket: ${BUCKET}`);
  console.log(`Time: ${new Date().toISOString()}\n`);

  // Find latest raw files
  console.log('Scanning raw/ for latest files...');
  const rawFiles = await findLatestRawFiles();
  console.log(`Found files for: ${Object.keys(rawFiles).join(', ')}\n`);

  const results = [];
  const errors = [];

  for (const [lender, files] of Object.entries(rawFiles)) {
    console.log(`[${lender.toUpperCase()}]`);

    // Skip excluded lenders (e.g. TLS — no LLPA data)
    if (EXCLUDED_LENDERS.has(lender)) {
      console.log(`  ⊘ Excluded — skipping`);
      console.log();
      continue;
    }

    const parser = PARSERS[lender];
    if (!parser) {
      console.log(`  ⚠ No parser for ${lender}, skipping`);
      continue;
    }

    // Idempotent: skip if the latest GCS file hasn't changed since last parse
    const latestFile = files[0]; // already sorted by updated desc
    const lastParsedKey = `parsed/.last-parsed-${lender}`;
    try {
      const lastParsedRes = await downloadText(lastParsedKey).catch(() => null);
      // Strip JSON quotes if present (backwards compat with prior uploadJson markers)
      const lastParsed = lastParsedRes?.trim().replace(/^"|"$/g, '');
      if (lastParsed && lastParsed === latestFile.path) {
        console.log(`  ⊜ File unchanged (${latestFile.filename}) — skipping`);
        console.log();
        continue;
      }
    } catch { /* no marker yet — proceed with parse */ }

    try {
      const result = await parser(files);
      results.push(result);

      // Upload parsed JSON to GCS
      await uploadJson(`parsed/${lender}.json`, result);

      // Seed pricing engine DB for active lenders
      if (DB_READY_LENDERS.has(lender) && result.sheetDate) {
        try {
          const sourceFile = latestFile.filename;
          const dbResult = await writeRatesToDB(lender, result.programs, result.sheetDate, sourceFile);
          console.log(`  ✓ DB: ${dbResult.pricesInserted} prices, ${dbResult.productsMatched} matched, ${dbResult.productsCreated} new products`);
        } catch (dbErr) {
          console.error(`  ✗ DB write failed for ${lender}: ${dbErr.message}`);
          errors.push({ lender, error: `DB: ${dbErr.message}` });
        }
      }

      // Write marker so next run skips if same file
      await uploadText(lastParsedKey, latestFile.path);
    } catch (err) {
      console.error(`  ✗ ${lender} failed: ${err.message}`);
      errors.push({ lender, error: err.message });
    }
    console.log();
  }

  // Upload manifest
  const manifest = {
    version: 2,
    generatedAt: new Date().toISOString(),
    lenders: results.map(r => ({
      id: r.lenderId,
      file: `${r.lenderId}.json`,
      sheetDate: r.sheetDate,
      programCount: r.programs.length,
    })),
  };
  await uploadJson('parsed/manifest.json', manifest);

  const totalPrograms = results.reduce((sum, r) => sum + r.programs.length, 0);

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Parsed: ${results.length} lenders`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Total programs: ${totalPrograms}`);
  if (errors.length > 0) {
    console.log('Failed:', errors.map(e => `${e.lender}: ${e.error}`).join(', '));
  }
  console.log();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
