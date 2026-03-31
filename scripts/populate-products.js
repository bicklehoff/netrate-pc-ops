/**
 * DEPRECATED — db-writer.js now auto-upserts rate_products.
 * Use writeRatesToDB() directly — it handles both products and prices in one step.
 * This script is kept for reference only.
 */
const { Client } = require('pg');
const data = require('../src/data/parsed-rates.json');

const DB = 'postgresql://neondb_owner:npg_sWV0dtFf4iwZ@ep-plain-math-aixa3lmr-pooler.c-4.us-east-1.aws.neon.tech/netrate_pc?sslmode=require';
const lenderCodes = ['amwest', 'everstream', 'keystone', 'swmc', 'tls', 'windsor'];

function classify(name) {
  const n = name.toLowerCase();
  const p = {};
  if (n.includes('dscr')) p.loanType = 'dscr';
  else if (n.includes('non-qm') || n.includes('expanded prime')) p.loanType = 'nonqm';
  else if (n.includes('bank statement')) p.loanType = 'bankstatement';
  else if (n.includes('heloc')) p.loanType = 'heloc';
  else if (n.includes('2nd lien')) p.loanType = 'secondlien';
  else if (n.includes('jumbo')) p.loanType = 'jumbo';
  else if (n.includes('usda')) p.loanType = 'usda';
  else if (n.includes('va')) p.loanType = 'va';
  else if (n.includes('fha')) p.loanType = 'fha';
  else p.loanType = 'conventional';
  
  if (n.includes('fnma') || n.includes('fannie')) p.agency = 'fnma';
  else if (n.includes('fhlmc') || n.includes('freddie')) p.agency = 'fhlmc';
  else p.agency = null;
  
  if (n.includes('elite')) p.tier = 'elite';
  else if (n.includes('core')) p.tier = 'core';
  else if (n.match(/\bft\b/) || n.includes('fast track')) p.tier = 'fasttrack';
  else p.tier = null;
  
  const termMatch = n.match(/(\d+)yr/);
  p.term = termMatch ? parseInt(termMatch[1]) : 30;
  if (p.term > 100) p.term = 30;
  
  p.productType = n.includes('arm') ? 'arm' : 'fixed';
  p.armStructure = null;
  if (p.productType === 'arm') {
    const armMatch = n.match(/(\d+\/\d+)\s*arm/);
    p.armStructure = armMatch ? armMatch[1] : null;
  }
  
  if (n.includes(' noo')) p.occupancy = 'investment';
  else if (n.match(/\bsh\b/) || n.includes('second home')) p.occupancy = 'secondary';
  else p.occupancy = 'primary';
  
  p.isHighBalance = n.includes('high balance') || n.includes('super-conforming');
  p.isStreamline = n.includes('streamline') || n.includes('irrrl');
  p.isBuydown = n.includes('buydown');
  p.isInterestOnly = n.includes('i/o');
  p.isFastTrack = p.tier === 'fasttrack';
  
  if (n.includes('(full)') || n.includes('(full doc)')) p.docType = 'full';
  else if (n.includes('(alt)')) p.docType = 'altDoc';
  else if (n.includes('(asset)')) p.docType = 'asset';
  else if (n.includes('(investor)')) p.docType = 'investor';
  else if (n.includes('(expanded)')) p.docType = 'expanded';
  else if (p.loanType === 'bankstatement') p.docType = 'bankStatement';
  else if (p.loanType === 'dscr') p.docType = 'dscr';
  else p.docType = null;

  return p;
}

function displayName(name, loanAmountRange) {
  let d = name;
  if (loanAmountRange && (loanAmountRange.min > 0 || loanAmountRange.max)) {
    const min = loanAmountRange.min ? '$' + (loanAmountRange.min/1000) + 'K' : '$0';
    const max = loanAmountRange.max ? '$' + (loanAmountRange.max/1000) + 'K' : '+';
    d += ' (' + min + '-' + max + ')';
  }
  return d;
}

(async () => {
  const c = new Client({ connectionString: DB });
  await c.connect();
  
  // Get lender IDs
  const lenderRows = await c.query('SELECT id, code FROM rate_lenders');
  const lenderMap = {};
  lenderRows.rows.forEach(r => lenderMap[r.code] = r.id);
  
  let inserted = 0;
  let skipped = 0;
  
  for (let i = 0; i < data.lenders.length; i++) {
    const lender = data.lenders[i];
    const code = lenderCodes[i];
    const lenderId = lenderMap[code];
    if (!lenderId) { console.log('No lender ID for ' + code); continue; }
    
    // Get unique products (name + loanAmountRange combo)
    const seen = new Set();
    const products = [];
    for (const prog of lender.programs) {
      const key = prog.name + '|' + JSON.stringify(prog.loanAmountRange || {});
      if (seen.has(key)) continue;
      seen.add(key);
      products.push(prog);
    }
    
    for (const prog of products) {
      const cls = classify(prog.name);
      const range = prog.loanAmountRange || {};
      const rawName = prog.name + (range.min > 0 || range.max ? ' [' + (range.min||0) + '-' + (range.max||'') + ']' : '');
      const dName = displayName(prog.name, range);
      
      try {
        await c.query(`
          INSERT INTO rate_products (id, lender_id, raw_name, display_name, loan_type, agency, tier, term, product_type, occupancy,
            loan_amount_min, loan_amount_max, is_high_balance, is_streamline, is_buydown, is_interest_only, is_fast_track,
            arm_structure, doc_type, fico_min, fico_max, status, created_at, updated_at)
          VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, 'active', NOW(), NOW())
          ON CONFLICT (lender_id, raw_name) DO NOTHING
        `, [lenderId, rawName, dName, cls.loanType, cls.agency, cls.tier, cls.term, cls.productType, cls.occupancy,
            range.min || null, range.max || null, cls.isHighBalance, cls.isStreamline, cls.isBuydown, cls.isInterestOnly, cls.isFastTrack,
            cls.armStructure, cls.docType, null, null]);
        inserted++;
      } catch (e) {
        console.log('Error: ' + code + ' / ' + prog.name + ': ' + e.message);
        skipped++;
      }
    }
    console.log(code + ': ' + products.length + ' products');
  }
  
  console.log('\nTotal inserted: ' + inserted + ', skipped: ' + skipped);
  
  // Verify counts
  const counts = await c.query('SELECT l.code, COUNT(p.id) as cnt FROM rate_products p JOIN rate_lenders l ON p.lender_id = l.id GROUP BY l.code ORDER BY l.code');
  console.log('\nDB counts:');
  counts.rows.forEach(r => console.log('  ' + r.code + ': ' + r.cnt));
  
  await c.end();
})();
