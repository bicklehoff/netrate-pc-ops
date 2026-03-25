// CRM Migration: Zoho CRM + MyHomeIQ → NetRate Core
// Run: node --env-file=.env scripts/crm-migration/import.mjs [--commit]
//
// Architecture:
//   contacts       = borrowers only (assigned to MLO)
//   accounts       = companies (lenders, title cos, insurance, realtors)
//   account_contacts = non-borrower people linked to accounts
//   leads          = separate from contacts (assigned to MLO)
//
// Default: dry-run (prints report, no DB writes)
// --commit: execute actual imports

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

const COMMIT = process.argv.includes('--commit');
const sql = neon(process.env.DATABASE_URL);

// ─── MLO Mapping ────────────────────────────────────────────────────

// Name variants → canonical name + NMLS
const MLO_NAME_MAP = {
  'jamie cunningham': { name: 'Jamie Cunningham', nmls: '180707' },
  'david burson': { name: 'David Burson', nmls: '641790' },
  'david s burson': { name: 'David Burson', nmls: '641790' },
  'jerry cusick': { name: 'David Burson', nmls: '641790', reassigned: true },
  'gerald cusick': { name: 'David Burson', nmls: '641790', reassigned: true },
  'michael cusick': { name: 'David Burson', nmls: '641790', reassigned: true },
  'mike cusick': { name: 'David Burson', nmls: '641790', reassigned: true },
  'pearl francisco': { name: 'David Burson', nmls: '641790', reassigned: true },
  'jay norvell': { name: 'David Burson', nmls: '641790', reassigned: true },
  'jay norwood': { name: 'David Burson', nmls: '641790', reassigned: true },
};

const NMLS_MAP = {
  '180707': { name: 'Jamie Cunningham', nmls: '180707' },
  '641790': { name: 'David Burson', nmls: '641790' },
  '649445': { name: 'David Burson', nmls: '641790', reassigned: true }, // Jerry Cusick → David
};

const DEFAULT_MLO = { name: 'David Burson', nmls: '641790' };

function resolveMlo(loName, nmls) {
  if (nmls && NMLS_MAP[nmls]) return NMLS_MAP[nmls];
  if (loName) {
    const key = loName.toLowerCase().trim();
    if (MLO_NAME_MAP[key]) return MLO_NAME_MAP[key];
  }
  return null;
}

// ─── Discard Rules ──────────────────────────────────────────────────

const TEST_EMAILS = new Set([
  'david@cmglending.com', 'david@locusprocessing.com', 'bursony@gmail.com',
  'maryfreddie@gmail.com', 'freddie@gmail.com',
  'amy.a@fanniemae.com', 'andy.a@fanniemae.com',
]);

const TEST_NAMES = new Set([
  'davis burston', 'coborrower bursony', 'mary freddie', 'john freddie',
  'amy america', 'andy america', 'home wise', 'michelle michelle',
]);

// CT area codes (203, 860, 959) - discard
function isCTContact(phone, state) {
  if (state && state.toLowerCase() === 'ct') return true;
  if (!phone) return false;
  const digits = phone.replace(/\D/g, '');
  const areaCode = digits.length === 11 ? digits.substring(1, 4) : digits.substring(0, 3);
  return ['203', '860', '959'].includes(areaCode);
}

// Non-borrower domains — these are vendor/lender/realtor contacts, not borrowers
const VENDOR_DOMAINS = new Set([
  // Lenders
  'ca-svs.com', 'rocketmortgage.com', 'newrez.com', 'mcfunding.com', 'keystonefunding.com',
  'everstreammortgage.com', 'thelender.com', 'resicentral.com', 'theloanstore.com',
  'loganfinance.com', 'an2lending.com', 'plainscommerce.com', 'principlehomeloans.com',
  'sclmortgage.com', 'fanniemae.com',
  // Title
  'ortc.com', 'firstam.com', 'arizonatitle.com',
  // Insurance
  'allstate.com', 'allpurposeinsurance.com',
  // Marketing / tech vendors
  'cambermarketing.com', 'lendingdox.com', 'freerateupdate.com', 'mortgageresearchcenter.com',
  'guidemortgagelicense.com', 'amazingbusinessresults.com',
  // Other vendors
  'tpogo.com', 'parkplaceus.com', 'quidproquo.com', 'junestream.com', 'acsol.net',
  'mbpros.net', 'violetlange.com', 'philsmith.ws', 'westpointcarpetone.com',
  'forcebi.com', 'ablitservices.com', 'mtc-llc.com',
]);

// Realtor domains — separate from vendors, go into account_contacts with industry='realtor'
const REALTOR_DOMAINS = new Set([
  '303kathi.com', 'chaniolson.com', 'assist2sell.com', 'bhhsne.com', 'irenesmithhomes.com',
]);

// Known realtor emails on personal domains
const REALTOR_EMAILS = new Set([
  'dreamhomesbyjuanita@yahoo.com', 'aaronwheeler.cohomes@gmail.com',
  'irenesmithhomes@gmail.com',
]);

// Realtor keywords in email or name
function isRealtorContact(email, name) {
  if (!email) return false;
  const lower = email.toLowerCase();
  if (REALTOR_EMAILS.has(lower)) return true;
  const domain = email.split('@')[1] || '';
  if (REALTOR_DOMAINS.has(domain)) return true;
  // Check for realtor-ish email handles
  if (lower.includes('homes') && !lower.includes('homestead')) return true;
  if (lower.includes('realty') || lower.includes('realtor')) return true;
  // Check name for realtor business names
  const nameLower = (name || '').toLowerCase();
  if (nameLower.includes('realty') || nameLower.includes('realtor')) return true;
  return false;
}

function isVendorEmail(email) {
  if (!email) return false;
  const domain = email.split('@')[1];
  return domain && (VENDOR_DOMAINS.has(domain) || REALTOR_DOMAINS.has(domain));
}

function shouldDiscard(name, email, phone, state) {
  const nameLower = (name || '').toLowerCase().trim();
  const emailLower = (email || '').toLowerCase().trim();
  if (TEST_NAMES.has(nameLower)) return 'test';
  if (emailLower && TEST_EMAILS.has(emailLower)) return 'test';
  if (isCTContact(phone, state)) return 'ct';
  // Bot/spam
  if (nameLower.length > 20 && /[A-Z]{5,}/.test(name)) return 'spam';
  return null;
}

// ─── Normalizers ────────────────────────────────────────────────────

function normalizeEmail(email) {
  if (!email) return null;
  const cleaned = email.trim().toLowerCase();
  if (!cleaned) return null;
  if (/^(test|noemail|none|na|no|fake|x+|unknown|info|admin)@/i.test(cleaned)) return null;
  if (cleaned.includes('example.com') || cleaned.includes('placeholder')) return null;
  if (cleaned.includes('@placeholder.netrate.local')) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) return null;
  return cleaned;
}

function normalizePhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (/^(\d)\1+$/.test(digits)) return null;
  if (digits.length < 10) return null;
  return null;
}

function titleCase(str) {
  if (!str) return null;
  return str.trim().replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.substr(1).toLowerCase());
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const mdyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const d = new Date(`${mdyMatch[3]}-${mdyMatch[1].padStart(2, '0')}-${mdyMatch[2].padStart(2, '0')}`);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const ymdMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymdMatch) {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

// ─── Status & Source Mappings ───────────────────────────────────────

const LEAD_STATUS_MAP = {
  'not contacted': 'subscriber', 'never contacted': 'subscriber', 'new': 'subscriber',
  'contacted': 'lead', 'engaged': 'lead', 'waiting': 'lead', 'need quote': 'lead',
  'quote sent': 'lead', 'short app': 'lead', 'ready to submit': 'lead',
  'prequal': 'applicant', 'submitted': 'applicant', 'approved': 'applicant',
  'set up': 'applicant', 'registered': 'applicant',
  'nurture': 'subscriber', 'nuture': 'subscriber',
  'cold': 'archived', 'lost': 'archived', 'lost touch': 'archived',
  'lost to competitor': 'archived', 'not qualified': 'archived',
  'does not qualify': 'archived', 'junk lead': 'archived',
  'exported': 'subscriber',
};

const LOAN_STAGE_STATUS = {
  'final disposition': 'past_client', 'funded': 'past_client', 'paid': 'past_client',
  'payment sent': 'past_client', 'clear to close': 'in_process', 'processing': 'in_process',
  'application': 'applicant', 'web application': 'applicant',
  'prospect': 'lead', 'back to lead': 'lead',
  'withdrawn': 'archived', 'closed incomplete': 'archived',
};

const INDUSTRY_MAP = {
  'realtor': 'realtor', 'title company': 'title', 'insurance': 'insurance',
  'lender': 'lender', 'marketing': 'other', 'licensing': 'other',
  'hoa management': 'other', 'counseling': 'other',
};

// ─── CSV Loading ────────────────────────────────────────────────────

function loadCSV(path) {
  try {
    const content = readFileSync(path, 'utf-8');
    return parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true });
  } catch (e) {
    console.error(`  Failed to load ${path}: ${e.message}`);
    return [];
  }
}

// ─── Main ───────────────────────────────────────────────────────────

async function run() {
  const stats = {
    discarded: { test: 0, ct: 0, spam: 0, emailList: 0, vendor: 0, noData: 0 },
    contacts: { created: 0, updated: 0, errors: 0 },
    accounts: { created: 0 },
    accountContacts: { created: 0 },
    leads: { imported: 0, errors: 0 },
    notes: { imported: 0 },
    reassigned: 0,
  };

  // ─── Step 1: Load Data ──────────────────────────────────────────
  console.log('\n=== Step 1: Loading data ===');
  const BASE = 'Work/Dev/crm-migration/zoho-backup/Data';
  const zohoContacts = loadCSV(`${BASE}/Contacts_001.csv`);
  const zohoLeadsRaw = loadCSV(`${BASE}/Leads_001.csv`);
  const zohoLoans = loadCSV(`${BASE}/Loans_001.csv`);
  const zohoAccounts = loadCSV(`${BASE}/Accounts_001.csv`);
  const zohoNotes = loadCSV(`${BASE}/Notes_001.csv`);
  const homeiq = loadCSV('Work/Dev/crm-migration/homeiq-export.csv');

  // Filter Email List leads
  const zohoLeads = zohoLeadsRaw.filter(l => {
    if ((l['Lead Source'] || '').toLowerCase() === 'email list') { stats.discarded.emailList++; return false; }
    return true;
  });

  console.log(`  Zoho Contacts: ${zohoContacts.length}`);
  console.log(`  Zoho Leads: ${zohoLeads.length} (dropped ${stats.discarded.emailList} "Email List")`);
  console.log(`  Zoho Loans: ${zohoLoans.length}`);
  console.log(`  Zoho Accounts: ${zohoAccounts.length}`);
  console.log(`  MyHomeIQ: ${homeiq.length}`);

  // ─── Step 2: Build loan email→MLO map for cross-reference ──────
  console.log('\n=== Step 2: Building MLO cross-reference ===');
  const loanMloByEmail = new Map(); // email → resolved MLO
  for (const row of zohoLoans) {
    const email = normalizeEmail(row['Email']);
    if (!email) continue;
    const mlo = resolveMlo(row['Loan Officer'], row['LO NMLS']);
    if (mlo) loanMloByEmail.set(email, mlo);
  }
  console.log(`  Loan→MLO map: ${loanMloByEmail.size} entries`);

  // ─── Step 3: Build Borrower Contacts ────────────────────────────
  console.log('\n=== Step 3: Building borrower contacts ===');
  const borrowerMap = new Map(); // email → contact
  const vendorContacts = []; // non-borrower contacts from Zoho Contacts table

  // 3a: Zoho Contacts
  for (const row of zohoContacts) {
    const email = normalizeEmail(row['Email']);
    const name = `${(row['First Name'] || '').trim()} ${(row['Last Name'] || '').trim()}`.trim();
    const phone = normalizePhone(row['Phone'] || row['Home Phone'] || row['Mobile']);

    // Discard checks
    const discardReason = shouldDiscard(name, email, phone, row['Mailing State']);
    if (discardReason) { stats.discarded[discardReason]++; continue; }
    if (!email && !name) { stats.discarded.noData++; continue; }

    // Is this a vendor/lender contact, not a borrower?
    if (email && isVendorEmail(email)) {
      vendorContacts.push(row);
      stats.discarded.vendor++;
      continue;
    }

    // Resolve MLO: direct field → loan cross-ref → default
    const loName = row['Loan Officer'] || '';
    let mlo = resolveMlo(loName, null);
    if (!mlo && email) mlo = loanMloByEmail.get(email);
    if (!mlo) mlo = DEFAULT_MLO;

    const wasReassigned = mlo.reassigned || false;
    if (wasReassigned) stats.reassigned++;

    const contact = {
      firstName: titleCase(row['First Name']) || 'Unknown',
      lastName: titleCase(row['Last Name']) || 'Unknown',
      email,
      phone,
      source: 'zoho',
      status: wasReassigned ? 'past_client' : 'subscriber',
      contactType: 'borrower',
      tags: wasReassigned ? ['reassigned', 'mailing-list'] : ['mailing-list'],
      notes: row['Description'] || null,
      zohoContactId: row['Record Id'] || null,
      zohoLeadId: null,
      originalSource: row['Lead Source'] || null,
      mloNmls: mlo.nmls,
      mloName: mlo.name,
      coBorrowerName: [row['B2 First'], row['B2 Last']].filter(Boolean).join(' ') || null,
      coBorrowerEmail: normalizeEmail(row['B2 Email']) || null,
      coBorrowerPhone: normalizePhone(row['B2 Mobile'] || row['B2 Home PHone']) || null,
      dateOfBirth: parseDate(row['Date of Birth']) || null,
      mailingAddress: row['Mailing Street'] || null,
      city: row['Mailing City'] || null,
      state: row['Mailing State'] || null,
      zipCode: row['Mailing Zip'] || null,
      emailOptOut: row['Email Opt Out'] === 'true',
      propertyAddress: null, currentLoanAmount: null, currentRate: null,
      currentLoanTerm: null, currentLoanDate: null, homeValue: null, fundedDate: null,
      homeiqImported: false,
      _loanNotes: [],
    };

    // Contact type from field
    const cType = (row['Contact Type'] || '').toLowerCase();
    if (cType === 'client') contact.status = 'past_client';
    else if (cType === 'prospect') contact.status = 'lead';

    if (email) {
      borrowerMap.set(email, contact);
    } else {
      borrowerMap.set(`no-email-${row['Record Id']}`, contact);
    }
  }

  // 3b: Enrich from Zoho Loans
  for (const row of zohoLoans) {
    const email = normalizeEmail(row['Email']);
    if (!email) continue;

    const discardReason = shouldDiscard(row['Loan Name'], email, row['Phone'], row['Subject State']);
    if (discardReason) continue;

    const stage = (row['Stage'] || '').toLowerCase();
    const loanStatus = LOAN_STAGE_STATUS[stage] || null;
    const closingDate = parseDate(row['Closing Date']);
    const loanAmount = parseFloat(row['Loan Amount']) || null;
    const purpose = row['Loan Purpose'] || null;
    const address = row['Full Address'] || null;
    const rate = parseFloat(row['Interest Rate']) || parseFloat(row['Current Interest Rate']) || null;

    const loanNote = [purpose, 'loan', loanAmount ? `$${loanAmount.toLocaleString()}` : null,
      rate ? `at ${rate}%` : null, address ? `- ${address}` : null,
      closingDate ? `- Closed ${closingDate.split('T')[0]}` : null,
    ].filter(Boolean).join(' ');

    const mlo = resolveMlo(row['Loan Officer'], row['LO NMLS']);

    if (borrowerMap.has(email)) {
      const existing = borrowerMap.get(email);
      // Upgrade status
      if (loanStatus) {
        const order = ['subscriber', 'lead', 'applicant', 'in_process', 'funded', 'past_client'];
        if (order.indexOf(loanStatus) > order.indexOf(existing.status)) existing.status = loanStatus;
      }
      // Enrich with most recent loan data
      if (closingDate && (!existing.fundedDate || closingDate > existing.fundedDate)) {
        existing.fundedDate = closingDate;
        if (address) existing.propertyAddress = address;
        if (loanAmount) existing.currentLoanAmount = loanAmount;
        if (rate) existing.currentRate = rate;
      }
      // Fill MLO if better source
      if (mlo && !existing.mloNmls) { existing.mloNmls = mlo.nmls; existing.mloName = mlo.name; }
      existing._loanNotes.push(loanNote);
    } else if (!isVendorEmail(email)) {
      // New contact from loan
      const resolvedMlo = mlo || DEFAULT_MLO;
      const wasReassigned = resolvedMlo.reassigned || false;
      borrowerMap.set(email, {
        firstName: titleCase(row['First Name']) || 'Unknown',
        lastName: titleCase(row['Last Name']) || 'Unknown',
        email, phone: normalizePhone(row['Phone'] || row['B1 Cell']),
        source: 'zoho', status: wasReassigned ? 'past_client' : (loanStatus || 'subscriber'),
        contactType: 'borrower',
        tags: wasReassigned ? ['reassigned', 'mailing-list'] : ['mailing-list'],
        notes: null, zohoContactId: null, zohoLeadId: null, originalSource: null,
        mloNmls: resolvedMlo.nmls, mloName: resolvedMlo.name,
        coBorrowerName: [row['B2 First Name'], row['B2 Last Name']].filter(Boolean).join(' ') || null,
        coBorrowerEmail: normalizeEmail(row['B2 Email']) || null,
        coBorrowerPhone: normalizePhone(row['B2 Phone'] || row['B2 Cell']) || null,
        dateOfBirth: parseDate(row['B1 DOB']) || null,
        mailingAddress: null, city: null, state: row['Subject State'] || null, zipCode: row['Subject ZIP'] || null,
        emailOptOut: false,
        propertyAddress: address, currentLoanAmount: loanAmount, currentRate: rate,
        currentLoanTerm: parseInt(row['Amortization Term']) || null,
        currentLoanDate: closingDate,
        homeValue: parseFloat(row['Purchase Price']) || parseFloat(row['Appraised Value']) || null,
        fundedDate: closingDate, homeiqImported: false,
        _loanNotes: [loanNote],
      });
      if (wasReassigned) stats.reassigned++;
    }
  }

  // 3c: Merge MyHomeIQ
  let homeiqOverlap = 0, homeiqNew = 0;
  for (const row of homeiq) {
    const email = normalizeEmail(row['owner_email']);
    if (!email) continue;

    const loanAmount = parseFloat(row['open_lien_amount']) || null;
    const rate = parseFloat(row['interest_rate']) || null;
    const term = parseInt(row['loan_term']) || null;
    const loanDate = parseDate(row['loan_date']) || null;
    const salePrice = parseFloat(row['sale_price']) || null;
    const address = row['full_address'] || null;

    if (borrowerMap.has(email)) {
      homeiqOverlap++;
      const existing = borrowerMap.get(email);
      if (address) existing.propertyAddress = address;
      if (loanAmount) existing.currentLoanAmount = loanAmount;
      if (rate) existing.currentRate = rate;
      if (term) existing.currentLoanTerm = term;
      if (loanDate) existing.currentLoanDate = loanDate;
      if (salePrice) existing.homeValue = salePrice;
      existing.homeiqImported = true;
      if (['subscriber', 'lead'].includes(existing.status)) existing.status = 'past_client';
    } else {
      homeiqNew++;
      const nameParts = (row['owner_name'] || '').split(' ');
      borrowerMap.set(email, {
        firstName: titleCase(nameParts[0]) || 'Unknown',
        lastName: titleCase(nameParts.slice(1).join(' ')) || 'Unknown',
        email, phone: normalizePhone(row['owner_phone']) || null,
        source: 'homeiq', status: 'past_client', contactType: 'borrower',
        tags: [], notes: null, zohoContactId: null, zohoLeadId: null,
        originalSource: 'homeiq', mloNmls: '641790', mloName: 'David Burson',
        coBorrowerName: null, coBorrowerEmail: null, coBorrowerPhone: null,
        dateOfBirth: null, mailingAddress: null, city: null, state: null, zipCode: null,
        emailOptOut: false, propertyAddress: address, currentLoanAmount: loanAmount,
        currentRate: rate, currentLoanTerm: term, currentLoanDate: loanDate,
        homeValue: salePrice, fundedDate: loanDate, homeiqImported: true, _loanNotes: [],
      });
    }
  }

  // ─── Step 4: Build Leads (separate from contacts) ───────────────
  console.log('\n=== Step 4: Building leads ===');
  const leadsList = [];
  for (const row of zohoLeads) {
    const email = normalizeEmail(row['Email']);
    if (!email) continue;

    const name = row['Full Name'] || `${row['First Name'] || ''} ${row['Last Name'] || ''}`.trim();
    const phone = normalizePhone(row['Phone'] || row['Mobile']);

    const discardReason = shouldDiscard(name, email, phone, row['State']);
    if (discardReason) { stats.discarded[discardReason]++; continue; }
    if (isVendorEmail(email)) { stats.discarded.vendor++; continue; }

    // Resolve MLO
    const loName = row['Loan Officer'] || '';
    let mlo = resolveMlo(loName, null);
    if (!mlo && email) mlo = loanMloByEmail.get(email);
    if (!mlo) mlo = DEFAULT_MLO;

    const zohoStatus = (row['Lead Status'] || '').toLowerCase();
    const mappedStatus = LEAD_STATUS_MAP[zohoStatus] || 'new';
    // Map to lead statuses: new|contacted|qualified|quoted|converted|closed
    let leadStatus = 'new';
    if (['lead', 'applicant'].includes(mappedStatus)) leadStatus = 'contacted';
    if (mappedStatus === 'archived') leadStatus = 'closed';

    leadsList.push({
      name: titleCase(name) || 'Unknown',
      email, phone,
      source: row['Lead Source'] || 'zoho',
      status: leadStatus,
      zohoLeadId: row['Record Id'],
      mloNmls: mlo.nmls,
      loanPurpose: row['Loan Purpose'] || null,
      propertyState: row['Property State'] || row['State'] || null,
      creditScore: parseInt(row['Credit Score']) || null,
      propertyValue: parseFloat(row['Property Value']) || null,
      notes: row['Description'] || null,
      createdAt: parseDate(row['Created Time']) || null,
    });
  }

  // ─── Step 5: Build Accounts + Account Contacts ──────────────────
  console.log('\n=== Step 5: Building accounts ===');
  const accountsList = [];
  for (const row of zohoAccounts) {
    const name = (row['Account Name'] || '').trim();
    if (!name) continue;

    const industry = (row['Industry'] || '').toLowerCase();
    // Skip "Client" type accounts — those are borrowers
    if (industry === 'client') continue;

    accountsList.push({
      name,
      phone: normalizePhone(row['Phone']),
      website: row['Website'] || null,
      industry: INDUSTRY_MAP[industry] || 'other',
      address: row['Billing Street'] || null,
      city: row['Billing City'] || null,
      state: row['Billing State'] || null,
      zipCode: row['Billing Code'] || null,
      notes: row['Description'] || null,
      zohoAccountId: row['Record Id'],
    });
  }

  // Vendor contacts from Zoho Contacts that were filtered out of borrowers
  const vendorAccountContacts = [];
  for (const row of vendorContacts) {
    const email = normalizeEmail(row['Email']);
    const domain = email ? email.split('@')[1] : null;
    const name = `${(row['First Name'] || '').trim()} ${(row['Last Name'] || '').trim()}`.trim();
    const isRealtor = isRealtorContact(email, name);
    vendorAccountContacts.push({
      firstName: titleCase(row['First Name']) || 'Unknown',
      lastName: titleCase(row['Last Name']) || 'Unknown',
      email, phone: normalizePhone(row['Phone'] || row['Mobile']),
      domain,
      industry: isRealtor ? 'realtor' : null, // will be resolved from account or domain
      zohoContactId: row['Record Id'],
    });
  }

  // Also catch realtors hiding in borrower contacts (personal email domains)
  // Check borrowerMap for realtor-ish emails and move them to vendorAccountContacts
  const realtorEmails = [];
  for (const [key, c] of borrowerMap) {
    if (isRealtorContact(c.email, `${c.firstName} ${c.lastName}`)) {
      realtorEmails.push(key);
      vendorAccountContacts.push({
        firstName: c.firstName, lastName: c.lastName,
        email: c.email, phone: c.phone,
        domain: c.email ? c.email.split('@')[1] : null,
        industry: 'realtor',
        zohoContactId: c.zohoContactId,
      });
    }
  }
  for (const key of realtorEmails) {
    borrowerMap.delete(key);
    stats.discarded.vendor++;
  }
  if (realtorEmails.length > 0) {
    console.log(`  Moved ${realtorEmails.length} realtors from borrowers to account contacts`);
  }

  // ─── Report ─────────────────────────────────────────────────────
  const statusCounts = {};
  let mloAssigned = 0, totalLoanNotes = 0;
  for (const [, c] of borrowerMap) {
    statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
    if (c.mloNmls) mloAssigned++;
    totalLoanNotes += c._loanNotes.length;
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`  MIGRATION REPORT`);
  console.log(`${'='.repeat(50)}`);
  console.log(`\nBORROWER CONTACTS: ${borrowerMap.size}`);
  console.log(`  MLO assigned: ${mloAssigned}/${borrowerMap.size}`);
  console.log(`  Reassigned (old LOs → David): ${stats.reassigned}`);
  for (const [s, c] of Object.entries(statusCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${s}: ${c}`);
  }
  console.log(`\nLEADS: ${leadsList.length}`);
  console.log(`  With MLO: ${leadsList.filter(l => l.mloNmls).length}/${leadsList.length}`);
  console.log(`\nACCOUNTS: ${accountsList.length}`);
  console.log(`ACCOUNT CONTACTS (from vendor emails): ${vendorAccountContacts.length}`);
  console.log(`\nNOTES: ${totalLoanNotes} loan history + ${zohoNotes.length} Zoho notes`);
  console.log(`\nMyHomeIQ: ${homeiqOverlap} overlap, ${homeiqNew} new`);
  console.log(`\nDISCARDED:`);
  for (const [reason, count] of Object.entries(stats.discarded)) {
    if (count > 0) console.log(`  ${reason}: ${count}`);
  }

  if (!COMMIT) {
    console.log(`\n*** DRY RUN — no changes made. Pass --commit to execute. ***\n`);
    return;
  }

  // ─── COMMIT: Import to Database ─────────────────────────────────
  console.log('\n=== Importing to database ===');

  // Get MLO IDs from DB
  const mlos = await sql`SELECT id, nmls FROM mlos`;
  const mloIdByNmls = new Map();
  for (const m of mlos) { if (m.nmls) mloIdByNmls.set(m.nmls, m.id); }
  console.log(`  MLOs in DB: ${mlos.length} (${[...mloIdByNmls.keys()].join(', ')})`);

  // Get existing contacts
  const existingContacts = await sql`SELECT id, email, borrower_id FROM contacts WHERE email IS NOT NULL`;
  const existingByEmail = new Map();
  for (const ec of existingContacts) { if (ec.email) existingByEmail.set(ec.email.toLowerCase().trim(), ec); }
  console.log(`  Existing contacts: ${existingContacts.length}`);

  // 6a: Import borrower contacts
  console.log('\n  Importing borrower contacts...');
  for (const [key, c] of borrowerMap) {
    try {
      const mloId = mloIdByNmls.get(c.mloNmls) || null;
      if (c.email && existingByEmail.has(c.email)) {
        const existing = existingByEmail.get(c.email);
        await sql`UPDATE contacts SET
          status = ${c.status}, contact_type = 'borrower',
          assigned_mlo_id = ${mloId},
          zoho_contact_id = ${c.zohoContactId || null},
          original_source = ${c.originalSource || null},
          co_borrower_name = COALESCE(co_borrower_name, ${c.coBorrowerName || null}),
          co_borrower_email = COALESCE(co_borrower_email, ${c.coBorrowerEmail || null}),
          property_address = COALESCE(${c.propertyAddress || null}, property_address),
          current_loan_amount = COALESCE(${c.currentLoanAmount || null}, current_loan_amount),
          current_rate = COALESCE(${c.currentRate || null}, current_rate),
          funded_date = COALESCE(${c.fundedDate || null}, funded_date),
          homeiq_imported = ${c.homeiqImported}, email_opt_out = ${c.emailOptOut},
          tags = ${c.tags.length > 0 ? `{${c.tags.join(',')}}` : '{}'},
          updated_at = now()
        WHERE id = ${existing.id}`;
        stats.contacts.updated++;
      } else {
        await sql`INSERT INTO contacts (
          id, first_name, last_name, email, phone, source, tags, notes,
          status, contact_type, assigned_mlo_id,
          newsletter_opt_in, strike_rate_opt_in, email_opt_out, sms_opt_out,
          co_borrower_name, co_borrower_email, co_borrower_phone,
          date_of_birth, mailing_address, city, state, zip_code,
          property_address, current_loan_amount, current_rate, current_loan_term,
          current_loan_date, home_value, funded_date,
          zoho_contact_id, zoho_lead_id, homeiq_imported, original_source,
          created_at, updated_at
        ) VALUES (
          gen_random_uuid(), ${c.firstName}, ${c.lastName}, ${c.email}, ${c.phone},
          ${c.source}, ${c.tags.length > 0 ? `{${c.tags.join(',')}}` : '{}'}, ${c.notes},
          ${c.status}, 'borrower', ${mloId},
          false, false, ${c.emailOptOut}, false,
          ${c.coBorrowerName || null}, ${c.coBorrowerEmail || null}, ${c.coBorrowerPhone || null},
          ${c.dateOfBirth || null}, ${c.mailingAddress || null}, ${c.city || null}, ${c.state || null}, ${c.zipCode || null},
          ${c.propertyAddress || null}, ${c.currentLoanAmount || null}, ${c.currentRate || null}, ${c.currentLoanTerm || null},
          ${c.currentLoanDate || null}, ${c.homeValue || null}, ${c.fundedDate || null},
          ${c.zohoContactId || null}, ${c.zohoLeadId || null}, ${c.homeiqImported}, ${c.originalSource || null},
          now(), now()
        )`;
        stats.contacts.created++;
      }
    } catch (e) {
      stats.contacts.errors++;
      if (stats.contacts.errors <= 5) console.error(`    Error: ${c.email || key}: ${e.message}`);
    }
  }
  console.log(`    Created: ${stats.contacts.created}, Updated: ${stats.contacts.updated}, Errors: ${stats.contacts.errors}`);

  // 6b: Import leads
  console.log('\n  Importing leads...');
  for (const l of leadsList) {
    try {
      const mloId = mloIdByNmls.get(l.mloNmls) || null;
      await sql`INSERT INTO leads (
        id, name, email, phone, source, status, zoho_lead_id, mlo_id,
        loan_purpose, property_state, credit_score, property_value, notes, created_at
      ) VALUES (
        gen_random_uuid(), ${l.name}, ${l.email}, ${l.phone}, ${l.source}, ${l.status},
        ${l.zohoLeadId}, ${mloId},
        ${l.loanPurpose || null}, ${l.propertyState || null}, ${l.creditScore || null},
        ${l.propertyValue || null}, ${l.notes || null}, ${l.createdAt || new Date().toISOString()}
      )`;
      stats.leads.imported++;
    } catch (e) {
      stats.leads.errors++;
      if (stats.leads.errors <= 3) console.error(`    Error: ${l.email}: ${e.message}`);
    }
  }
  console.log(`    Imported: ${stats.leads.imported}, Errors: ${stats.leads.errors}`);

  // 6c: Import accounts
  console.log('\n  Importing accounts...');
  const accountIdByZohoId = new Map();
  const accountIdByDomain = new Map();
  for (const a of accountsList) {
    try {
      const result = await sql`INSERT INTO accounts (
        id, name, phone, website, industry, address, city, state, zip_code, notes, zoho_account_id,
        created_at, updated_at
      ) VALUES (
        gen_random_uuid(), ${a.name}, ${a.phone}, ${a.website}, ${a.industry},
        ${a.address || null}, ${a.city || null}, ${a.state || null}, ${a.zipCode || null},
        ${a.notes || null}, ${a.zohoAccountId},
        now(), now()
      ) RETURNING id`;
      stats.accounts.created++;
      accountIdByZohoId.set(a.zohoAccountId, result[0].id);
      // Try to map domain from website
      if (a.website) {
        try {
          const domain = new URL(a.website.startsWith('http') ? a.website : `https://${a.website}`).hostname.replace('www.', '');
          accountIdByDomain.set(domain, result[0].id);
        } catch {}
      }
    } catch (e) {
      if (stats.accounts.created === 0) console.error(`    Error: ${a.name}: ${e.message}`);
    }
  }
  console.log(`    Accounts created: ${stats.accounts.created}`);

  // 6d: Import account contacts
  console.log('\n  Importing account contacts...');
  for (const vc of vendorAccountContacts) {
    try {
      // Try to find matching account by domain
      let accountId = vc.domain ? accountIdByDomain.get(vc.domain) : null;
      if (!accountId) {
        // Create a standalone account from the domain
        const companyName = vc.domain ? vc.domain.split('.')[0].replace(/-/g, ' ') : 'Unknown';
        const industry = vc.industry || 'other';
        const result = await sql`INSERT INTO accounts (id, name, industry, created_at, updated_at)
          VALUES (gen_random_uuid(), ${titleCase(companyName)}, ${industry}, now(), now()) RETURNING id`;
        accountId = result[0].id;
        if (vc.domain) accountIdByDomain.set(vc.domain, accountId);
        stats.accounts.created++;
      }
      await sql`INSERT INTO account_contacts (
        id, account_id, first_name, last_name, email, phone, zoho_contact_id, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), ${accountId}, ${vc.firstName}, ${vc.lastName},
        ${vc.email}, ${vc.phone}, ${vc.zohoContactId}, now(), now()
      )`;
      stats.accountContacts.created++;
    } catch (e) {
      if (stats.accountContacts.created === 0) console.error(`    Error: ${vc.email}: ${e.message}`);
    }
  }
  console.log(`    Account contacts created: ${stats.accountContacts.created}`);

  // 6e: Import loan history notes
  console.log('\n  Importing notes...');
  const allContacts = await sql`SELECT id, email FROM contacts WHERE email IS NOT NULL`;
  const contactByEmail = new Map();
  for (const c of allContacts) { if (c.email) contactByEmail.set(c.email.toLowerCase().trim(), c.id); }

  for (const [, c] of borrowerMap) {
    if (c._loanNotes.length === 0 || !c.email) continue;
    const contactId = contactByEmail.get(c.email);
    if (!contactId) continue;
    for (const note of c._loanNotes) {
      try {
        await sql`INSERT INTO contact_notes (id, contact_id, content, author_type, source, created_at)
          VALUES (gen_random_uuid(), ${contactId}, ${note}, 'import', 'zoho_import', now())`;
        stats.notes.imported++;
      } catch {}
    }
  }
  console.log(`    Notes imported: ${stats.notes.imported}`);

  // ─── Verification ───────────────────────────────────────────────
  console.log('\n=== Verification ===');
  const totalContacts = await sql`SELECT COUNT(*) as c FROM contacts`;
  const totalLeads = await sql`SELECT COUNT(*) as c FROM leads`;
  const totalAccounts = await sql`SELECT COUNT(*) as c FROM accounts`;
  const totalAccountContacts = await sql`SELECT COUNT(*) as c FROM account_contacts`;
  const totalNotes = await sql`SELECT COUNT(*) as c FROM contact_notes`;
  console.log(`Contacts: ${totalContacts[0].c}`);
  console.log(`Leads: ${totalLeads[0].c}`);
  console.log(`Accounts: ${totalAccounts[0].c}`);
  console.log(`Account Contacts: ${totalAccountContacts[0].c}`);
  console.log(`Contact Notes: ${totalNotes[0].c}`);

  const byStatus = await sql`SELECT status, COUNT(*) as c FROM contacts GROUP BY status ORDER BY c DESC`;
  console.log('\nContacts by status:');
  for (const r of byStatus) console.log(`  ${r.status}: ${r.c}`);

  const withMlo = await sql`SELECT COUNT(*) as c FROM contacts WHERE assigned_mlo_id IS NOT NULL`;
  console.log(`\nContacts with MLO: ${withMlo[0].c}/${totalContacts[0].c}`);

  const leadsWithMlo = await sql`SELECT COUNT(*) as c FROM leads WHERE mlo_id IS NOT NULL`;
  console.log(`Leads with MLO: ${leadsWithMlo[0].c}/${totalLeads[0].c}`);

  const dupEmails = await sql`SELECT LOWER(email) as e, COUNT(*) as c FROM contacts WHERE email IS NOT NULL GROUP BY LOWER(email) HAVING COUNT(*) > 1`;
  console.log(`\nDuplicate emails: ${dupEmails.length === 0 ? 'NONE (clean)' : dupEmails.length + ' found!'}`);

  console.log('\nMigration complete!');
}

run().catch((e) => { console.error(e); process.exit(1); });
