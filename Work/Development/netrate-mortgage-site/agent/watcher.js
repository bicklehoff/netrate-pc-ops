#!/usr/bin/env node
/**
 * Rate Sheet Watcher — Monitors ~/rates/inbox for new XLSX files,
 * parses them, uploads to GCS, and archives the originals.
 *
 * Can run standalone (without OpenClaw) as a systemd service,
 * or be invoked by OpenClaw's heartbeat/skill system.
 *
 * Usage:
 *   node watcher.js              # One-shot: process any files in inbox
 *   node watcher.js --watch      # Continuous: poll every 60 seconds
 *   node watcher.js --watch 30   # Continuous: poll every 30 seconds
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const INBOX = path.join(__dirname, 'inbox');
const ARCHIVE = path.join(__dirname, 'archive');
const OUTPUT = path.join(__dirname, 'output');

// Ensure directories exist
[INBOX, ARCHIVE, OUTPUT].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function timestamp() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

function log(msg) {
  console.log(`[${timestamp()}] ${msg}`);
}

function processFile(xlsxPath) {
  const filename = path.basename(xlsxPath);
  log(`Processing: ${filename}`);

  // 1. Parse XLSX → JSON
  const outputJson = path.join(OUTPUT, 'amwest.json');
  try {
    const parseScript = path.join(__dirname, 'parse-amwest-xlsx.js');
    execSync(`node "${parseScript}" "${xlsxPath}" "${outputJson}"`, {
      stdio: 'pipe',
      timeout: 30000,
    });
    log(`  Parsed → ${outputJson}`);
  } catch (err) {
    log(`  ERROR parsing: ${err.stderr?.toString() || err.message}`);
    return false;
  }

  // 2. Upload JSON → GCS
  try {
    const uploadScript = path.join(__dirname, 'upload-to-gcs.js');
    const result = execSync(
      `node "${uploadScript}" "${outputJson}" live/amwest.json`,
      { stdio: 'pipe', timeout: 30000 }
    );
    log(`  Uploaded to GCS`);
    log(`  ${result.toString().trim().split('\n').slice(-1)[0]}`);
  } catch (err) {
    log(`  ERROR uploading: ${err.stderr?.toString() || err.message}`);
    log(`  JSON saved at ${outputJson} — will retry on next run`);
    return false;
  }

  // 3. Generate and upload updated manifest.json
  try {
    const rateData = JSON.parse(fs.readFileSync(outputJson, 'utf-8'));
    const manifest = {
      version: 1,
      generatedAt: new Date().toISOString(),
      lenders: [{
        id: 'amwest',
        name: rateData.lender?.name || 'AmWest Wholesale',
        file: 'amwest.json',
        effectiveDate: rateData.lender?.effectiveDate || '',
        effectiveTime: rateData.lender?.effectiveTime || '',
        uploadedAt: new Date().toISOString(),
      }],
    };
    const manifestPath = path.join(OUTPUT, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

    const uploadScript = path.join(__dirname, 'upload-to-gcs.js');
    execSync(
      `node "${uploadScript}" "${manifestPath}" live/manifest.json`,
      { stdio: 'pipe', timeout: 30000 }
    );
    log(`  Manifest updated (${manifest.lenders[0].effectiveDate})`);
  } catch (err) {
    log(`  WARNING: Rate uploaded but manifest update failed: ${err.message}`);
    // Don't return false — the rate data itself was uploaded successfully
  }

  // 3. Archive the original XLSX
  const datestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const archiveName = `${datestamp}_${filename}`;
  const archivePath = path.join(ARCHIVE, archiveName);
  fs.renameSync(xlsxPath, archivePath);
  log(`  Archived → ${archiveName}`);

  return true;
}

function processInbox() {
  const files = fs.readdirSync(INBOX)
    .filter(f => f.toLowerCase().endsWith('.xlsx'))
    .sort();

  if (files.length === 0) return 0;

  log(`Found ${files.length} file(s) in inbox`);
  let processed = 0;

  for (const file of files) {
    const success = processFile(path.join(INBOX, file));
    if (success) processed++;
  }

  log(`Done: ${processed}/${files.length} processed successfully`);
  return processed;
}

// ── CLI ─────────────────────────────────────────────────────

const args = process.argv.slice(2);
const watchMode = args.includes('--watch');
const pollInterval = parseInt(args[args.indexOf('--watch') + 1]) || 60;

if (watchMode) {
  log(`Watching ${INBOX} every ${pollInterval}s (Ctrl+C to stop)`);
  processInbox(); // Run immediately
  setInterval(processInbox, pollInterval * 1000);
} else {
  const count = processInbox();
  if (count === 0) log('No XLSX files in inbox');
  process.exit(count > 0 ? 0 : 1);
}
