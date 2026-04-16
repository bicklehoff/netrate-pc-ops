/**
 * Company constants — canonical source for company identity, contact info,
 * licensing IDs, and Google Business Profile review stats.
 *
 * USE THIS MODULE instead of hardcoding these values in JSX, metadata,
 * schema.org blocks, email templates, or copy. When David's phone changes,
 * the office moves, or the NMLS numbers are updated, only this file should
 * need to change.
 *
 * Consolidated from findings in:
 *   - D8 Pass 2 (homepage hardcodes)
 *   - D8 Pass 3 (marketing pages duplicated refs)
 *   - D8 Pass 4 (schema.org + SEO duplication — 59 NMLS touch points if fully swept)
 *   - D8 Pass 5 (borrower portal hardcodes — BP-7, BP-8)
 *
 * GBP review stats are static today. Future: wire to Google Business
 * Profile Performance API via a daily sync cron; this module stays
 * the read surface, data just becomes DB-backed.
 *
 * GBP rename note: the business is still registered as "Locus Mortgage" on
 * Google Business Profile (Place ID ChIJa5-5jCXza4cRptwJxaP23eU). Reviews
 * carry over when the rename completes. See src/data/marketing-playbook.md
 * for the deferred GBP rename plan.
 */

// Legal + brand names
export const COMPANY_NAME = 'NetRate Mortgage';
export const COMPANY_LEGAL_NAME = 'NetRate Mortgage LLC';

// NMLS IDs
export const COMPANY_NMLS = '1111861';
export const INDIVIDUAL_NMLS = '641790';

// NMLS consumer-access links
export const COMPANY_NMLS_URL =
  `https://nmlsconsumeraccess.org/EntityDetails.aspx/COMPANY/${COMPANY_NMLS}`;
export const INDIVIDUAL_NMLS_URL =
  `https://nmlsconsumeraccess.org/EntityDetails.aspx/INDIVIDUAL/${INDIVIDUAL_NMLS}`;

// Principal officer
export const PRINCIPAL_OFFICER = {
  name: 'David Burson',
  title: 'Principal Officer, Loan Officer',
  phone: '303-444-5251',
  email: 'david@netratemortgage.com',
  nmls: INDIVIDUAL_NMLS,
};

// Physical address
export const OFFICE_ADDRESS = {
  street: '357 S McCaslin Blvd #200',
  city: 'Louisville',
  state: 'CO',
  zip: '80027',
  country: 'US',
};

// Formatted as a single line (most common rendering)
export const OFFICE_ADDRESS_LINE =
  `${OFFICE_ADDRESS.street}, ${OFFICE_ADDRESS.city}, ${OFFICE_ADDRESS.state} ${OFFICE_ADDRESS.zip}`;

// Primary domain + URL bases
export const COMPANY_DOMAIN = 'netratemortgage.com';
export const COMPANY_URL = `https://${COMPANY_DOMAIN}`;

// Licensed states — source of truth for the site's areaServed claims.
// Keep in sync with src/app/licensing/page.js (which expands each into its
// required state-specific disclosure block).
export const LICENSED_STATES = ['CO', 'CA', 'OR', 'TX'];

// State-specific license numbers / agency references. Oregon and Texas
// piggyback on the company NMLS; California has its own DFPI CFL file number.
export const STATE_LICENSES = {
  CA: {
    agency: 'Department of Financial Protection and Innovation (DFPI)',
    law: 'California Financing Law',
    licenseType: 'Finance Broker',
    // File No. from the DFPI license certificate issued 2026-03-12.
    // Kept distinct from COMPANY_NMLS — DFPI uses its own numbering.
    fileNumber: '60DBO-210083',
    complaintUrl: 'https://dfpi.ca.gov',
    complaintPhone: '866-275-2677',
  },
  CO: {
    agency: 'Colorado Division of Real Estate, DORA',
    complaintUrl: 'https://dora.colorado.gov/mortgage',
    complaintPhone: '303-894-2166',
  },
  OR: {
    agency: 'Oregon Division of Financial Regulation',
    licenseNumber: `ML-${COMPANY_NMLS}`,
    complaintUrl: 'https://dfr.oregon.gov',
    complaintPhone: '888-877-4894',
  },
  TX: {
    agency: 'Texas Department of Savings and Mortgage Lending (SML)',
    licenseNumber: COMPANY_NMLS,
    complaintUrl: 'https://www.sml.texas.gov',
    complaintPhone: '1-877-276-5550',
  },
};

// Google Business Profile review stats. Update manually until the GBP
// sync cron is built. See marketing-playbook.md for the rename-deferred
// context (the GBP itself is still under "Locus Mortgage").
export const GBP_PLACE_ID = 'ChIJa5-5jCXza4cRptwJxaP23eU';
export const GBP_REVIEW_RATING = 4.9;
export const GBP_REVIEW_COUNT = 35;
export const GBP_REVIEW_URL =
  `https://www.google.com/maps/search/?api=1&query=Locus+Mortgage&query_place_id=${GBP_PLACE_ID}`;
