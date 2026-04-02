/**
 * Seed fee templates for CO, CA, TX, OR (purchase + refinance).
 *
 * CO data sourced from David's RT spreadsheet (page 2 of RT quote PDF).
 * CA/TX/OR are market-typical estimates — update as needed.
 *
 * Run: node scripts/seed-fee-templates.mjs
 */

import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

const sql = neon(process.env.PC_DATABASE_URL || process.env.DATABASE_URL);

// ---------------------------------------------------------------------------
// Fee data by state
// Notes:
//   homeInsuranceAtClose = annual premium (12 months). Monthly = this / 12.
//   propertyTaxMonthly   = estimated monthly tax (varies by property value — placeholder).
//   escrowInsuranceMonths = months of insurance held in escrow (cushion).
//   escrowTaxMonths       = months of taxes held in escrow (cushion).
// ---------------------------------------------------------------------------

const templates = [
  // ── COLORADO ──────────────────────────────────────────────────────────────
  // Purchase — from David's RT PDF (Section B/C/E exact, F/G estimates)
  {
    state: 'CO',
    county: null,
    purpose: 'purchase',
    label: 'Colorado Purchase',

    // Section A — origination (lenderFeeUw comes from lender record at runtime)
    lenderFeeOrigination: 0,

    // Section B — third-party services
    appraisal: 750,
    creditReport: 97,
    mersFee: 25,
    floodCert: 17,
    taxService: 57,
    titleEndorsement: 0,

    // Section C/E — title, settlement, recording
    titleLendersPolicy: 950,
    closingProtectionLetter: 25,
    settlementAgentFee: 200,
    recordingServiceFee: 0,
    recordingFees: 5,
    countyRecordingFee: 196,

    // Section F — prepaids (homeowners insurance annual premium estimate)
    homeInsuranceAtClose: 1800,   // 12-month prepaid; monthly = $150
    floodInsurance: 0,

    // Section G — initial escrow reserves
    propertyTaxMonthly: 300,      // Placeholder — ~0.55% on $450K CO avg. Varies by property.
    escrowInsuranceMonths: 2,
    escrowTaxMonths: 3,

    notes: 'CO baseline from RT quote PDF. Tax/insurance estimates — update per borrower.',
  },

  // Refinance — same as purchase except title is reissue rate (lower), no county recording
  {
    state: 'CO',
    county: null,
    purpose: 'refinance',
    label: 'Colorado Refinance',

    lenderFeeOrigination: 0,

    appraisal: 750,
    creditReport: 97,
    mersFee: 25,
    floodCert: 17,
    taxService: 57,
    titleEndorsement: 0,

    // Refi title: reissue rate typically 40% discount on lender's policy
    titleLendersPolicy: 575,
    closingProtectionLetter: 25,
    settlementAgentFee: 200,
    recordingServiceFee: 0,
    recordingFees: 5,
    countyRecordingFee: 98,       // Typically less on refi (fewer documents)

    homeInsuranceAtClose: 0,      // Prepaid insurance already exists — escrow only
    floodInsurance: 0,

    propertyTaxMonthly: 300,
    escrowInsuranceMonths: 2,
    escrowTaxMonths: 3,

    notes: 'CO refi — reissue title rate. No insurance prepaid (borrower already has policy).',
  },

  // ── CALIFORNIA ────────────────────────────────────────────────────────────
  {
    state: 'CA',
    county: null,
    purpose: 'purchase',
    label: 'California Purchase',

    lenderFeeOrigination: 0,

    appraisal: 800,
    creditReport: 97,
    mersFee: 25,
    floodCert: 17,
    taxService: 57,
    titleEndorsement: 50,

    // CA uses escrow companies, not settlement agents — combined in settlementAgentFee
    titleLendersPolicy: 1200,
    closingProtectionLetter: 75,
    settlementAgentFee: 500,      // Escrow fee
    recordingServiceFee: 0,
    recordingFees: 225,
    countyRecordingFee: 0,

    homeInsuranceAtClose: 1500,
    floodInsurance: 0,

    // CA: semi-annual taxes Nov 1 & Feb 1 — higher escrow cushion
    propertyTaxMonthly: 500,      // ~1.1% on $550K avg
    escrowInsuranceMonths: 2,
    escrowTaxMonths: 4,

    notes: 'CA market estimates. Escrow fee varies by county/escrow company.',
  },

  {
    state: 'CA',
    county: null,
    purpose: 'refinance',
    label: 'California Refinance',

    lenderFeeOrigination: 0,

    appraisal: 800,
    creditReport: 97,
    mersFee: 25,
    floodCert: 17,
    taxService: 57,
    titleEndorsement: 50,

    titleLendersPolicy: 750,
    closingProtectionLetter: 75,
    settlementAgentFee: 500,
    recordingServiceFee: 0,
    recordingFees: 150,
    countyRecordingFee: 0,

    homeInsuranceAtClose: 0,
    floodInsurance: 0,

    propertyTaxMonthly: 500,
    escrowInsuranceMonths: 2,
    escrowTaxMonths: 4,

    notes: 'CA refi estimates.',
  },

  // ── TEXAS ─────────────────────────────────────────────────────────────────
  {
    state: 'TX',
    county: null,
    purpose: 'purchase',
    label: 'Texas Purchase',

    lenderFeeOrigination: 0,

    appraisal: 750,
    creditReport: 97,
    mersFee: 25,
    floodCert: 17,
    taxService: 57,
    titleEndorsement: 0,

    // TX: title company handles closing — no separate settlement agent
    titleLendersPolicy: 900,
    closingProtectionLetter: 50,
    settlementAgentFee: 400,      // Title company closing fee
    recordingServiceFee: 0,
    recordingFees: 50,
    countyRecordingFee: 0,

    homeInsuranceAtClose: 2200,   // TX: higher due to hail/wind exposure
    floodInsurance: 0,

    // TX: Jan 31 tax deadline — high escrow cushion
    propertyTaxMonthly: 625,      // ~1.8% on $420K avg
    escrowInsuranceMonths: 2,
    escrowTaxMonths: 3,

    notes: 'TX market estimates. Insurance higher due to hail/wind exposure.',
  },

  {
    state: 'TX',
    county: null,
    purpose: 'refinance',
    label: 'Texas Refinance',

    lenderFeeOrigination: 0,

    appraisal: 750,
    creditReport: 97,
    mersFee: 25,
    floodCert: 17,
    taxService: 57,
    titleEndorsement: 0,

    titleLendersPolicy: 550,
    closingProtectionLetter: 50,
    settlementAgentFee: 400,
    recordingServiceFee: 0,
    recordingFees: 50,
    countyRecordingFee: 0,

    homeInsuranceAtClose: 0,
    floodInsurance: 0,

    propertyTaxMonthly: 625,
    escrowInsuranceMonths: 2,
    escrowTaxMonths: 3,

    notes: 'TX refi estimates.',
  },

  // ── OREGON ────────────────────────────────────────────────────────────────
  {
    state: 'OR',
    county: null,
    purpose: 'purchase',
    label: 'Oregon Purchase',

    lenderFeeOrigination: 0,

    appraisal: 750,
    creditReport: 97,
    mersFee: 25,
    floodCert: 17,
    taxService: 57,
    titleEndorsement: 0,

    titleLendersPolicy: 900,
    closingProtectionLetter: 25,
    settlementAgentFee: 300,
    recordingServiceFee: 0,
    recordingFees: 75,
    countyRecordingFee: 0,

    homeInsuranceAtClose: 1400,
    floodInsurance: 0,

    // OR: semi-annual taxes Nov 15 — moderate cushion
    propertyTaxMonthly: 350,      // ~0.9% on $470K avg
    escrowInsuranceMonths: 2,
    escrowTaxMonths: 3,

    notes: 'OR market estimates.',
  },

  {
    state: 'OR',
    county: null,
    purpose: 'refinance',
    label: 'Oregon Refinance',

    lenderFeeOrigination: 0,

    appraisal: 750,
    creditReport: 97,
    mersFee: 25,
    floodCert: 17,
    taxService: 57,
    titleEndorsement: 0,

    titleLendersPolicy: 550,
    closingProtectionLetter: 25,
    settlementAgentFee: 300,
    recordingServiceFee: 0,
    recordingFees: 75,
    countyRecordingFee: 0,

    homeInsuranceAtClose: 0,
    floodInsurance: 0,

    propertyTaxMonthly: 350,
    escrowInsuranceMonths: 2,
    escrowTaxMonths: 3,

    notes: 'OR refi estimates.',
  },
];

async function main() {
  console.log(`Seeding ${templates.length} fee templates...`);

  for (const t of templates) {
    const county = t.county ?? '';
    const rows = await sql`
      INSERT INTO fee_templates (
        id, state, county, purpose, label,
        lender_fee_origination,
        appraisal, credit_report, mers_fee, flood_cert, tax_service, title_endorsement,
        title_lenders_policy, closing_protection_letter, settlement_agent_fee,
        recording_service_fee, recording_fees, county_recording_fee,
        home_insurance_at_close, flood_insurance,
        property_tax_monthly, escrow_insurance_months, escrow_tax_months,
        notes, status, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), ${t.state}, ${county}, ${t.purpose}, ${t.label ?? null},
        ${t.lenderFeeOrigination ?? 0},
        ${t.appraisal ?? null}, ${t.creditReport ?? null}, ${t.mersFee ?? null},
        ${t.floodCert ?? null}, ${t.taxService ?? null}, ${t.titleEndorsement ?? null},
        ${t.titleLendersPolicy ?? null}, ${t.closingProtectionLetter ?? null},
        ${t.settlementAgentFee ?? null},
        ${t.recordingServiceFee ?? null}, ${t.recordingFees ?? null},
        ${t.countyRecordingFee ?? null},
        ${t.homeInsuranceAtClose ?? null}, ${t.floodInsurance ?? null},
        ${t.propertyTaxMonthly ?? null}, ${t.escrowInsuranceMonths ?? null},
        ${t.escrowTaxMonths ?? null},
        ${t.notes ?? null}, 'active', now(), now()
      )
      ON CONFLICT (state, county, purpose) DO UPDATE SET
        label = EXCLUDED.label,
        lender_fee_origination = EXCLUDED.lender_fee_origination,
        appraisal = EXCLUDED.appraisal,
        credit_report = EXCLUDED.credit_report,
        mers_fee = EXCLUDED.mers_fee,
        flood_cert = EXCLUDED.flood_cert,
        tax_service = EXCLUDED.tax_service,
        title_endorsement = EXCLUDED.title_endorsement,
        title_lenders_policy = EXCLUDED.title_lenders_policy,
        closing_protection_letter = EXCLUDED.closing_protection_letter,
        settlement_agent_fee = EXCLUDED.settlement_agent_fee,
        recording_service_fee = EXCLUDED.recording_service_fee,
        recording_fees = EXCLUDED.recording_fees,
        county_recording_fee = EXCLUDED.county_recording_fee,
        home_insurance_at_close = EXCLUDED.home_insurance_at_close,
        flood_insurance = EXCLUDED.flood_insurance,
        property_tax_monthly = EXCLUDED.property_tax_monthly,
        escrow_insurance_months = EXCLUDED.escrow_insurance_months,
        escrow_tax_months = EXCLUDED.escrow_tax_months,
        notes = EXCLUDED.notes,
        updated_at = now()
      RETURNING id
    `;
    console.log(`  ✓ ${t.state} / ${t.purpose} → id=${rows[0].id}`);
  }

  console.log('\nDone. Fee templates seeded.');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
