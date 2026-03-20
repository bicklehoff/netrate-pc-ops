const fs = require('fs');
const path = process.argv[2] || 'C:\\Users\\bickl\\Downloads\\ALANDEVOE_1188 (1).xml';
const xml = fs.readFileSync(path, 'utf-8');

const liabCount = (xml.match(/LIABILITY /g) || []).length;
console.log('LIABILITY elements:', liabCount);

const scoreCount = (xml.match(/CreditScore/g) || []).length;
console.log('CreditScore mentions:', scoreCount);

const monthlyCount = (xml.match(/MonthlyPayment/g) || []).length;
const balanceCount = (xml.match(/UnpaidBalance/g) || []).length;
console.log('MonthlyPayment mentions:', monthlyCount);
console.log('UnpaidBalance mentions:', balanceCount);

// Extract all liability snippets
const liabs = xml.match(/<LIABILITY [\s\S]*?<\/LIABILITY>/g) || [];
console.log('\nTotal liabilities found:', liabs.length);

liabs.forEach((l, i) => {
  const name = (l.match(/FullName>([^<]+)/) || [])[1] || 'unknown';
  const bal = (l.match(/UnpaidBalanceAmount>([^<]+)/) || [])[1] || '?';
  const pmt = (l.match(/MonthlyPaymentAmount>([^<]+)/) || [])[1] || '?';
  const type = (l.match(/LiabilityType>([^<]+)/) || [])[1] || '?';
  const acct = (l.match(/LiabilityAccountIdentifier>([^<]+)/) || [])[1] || '?';
  console.log(`  ${i+1}. ${name} | ${type} | acct:${acct} | bal:${bal} | pmt:${pmt}`);
});

// Credit scores
console.log('\nCredit Scores:');
const scores = xml.match(/<CREDIT_SCORE>[\s\S]*?<\/CREDIT_SCORE>/g) || [];
scores.forEach((s) => {
  const val = (s.match(/CreditScoreValue>([^<]+)/) || [])[1] || '?';
  const src = (s.match(/CreditRepositorySourceType>([^<]+)/) || [])[1] || '?';
  console.log(`  ${val} from ${src}`);
});

// Find credit score contexts (broader search)
console.log('\nCreditScore contexts:');
const scoreContexts = xml.match(/.{0,80}CreditScore.{0,80}/g) || [];
scoreContexts.slice(0, 5).forEach((c, i) => console.log(`  ${i+1}: ${c.replace(/\s+/g, ' ').trim()}`));

// MonthlyPayment contexts
console.log('\nMonthlyPayment contexts:');
const pmtContexts = xml.match(/.{0,80}MonthlyPayment.{0,80}/g) || [];
pmtContexts.forEach((c, i) => console.log(`  ${i+1}: ${c.replace(/\s+/g, ' ').trim()}`));

// LIABILITIES section
const liabSection = xml.match(/LIABILITIES[\s\S]{0,300}/);
if (liabSection) console.log('\nLIABILITIES section:', liabSection[0].substring(0, 200));
