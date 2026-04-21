// PrequalLetterPDF.js — @react-pdf/renderer component for Pre-Qualification Letters
// Single-page professional PDF in the NetRate design system.
// Uses react-pdf primitives (Document, Page, View, Text, Svg, Rect) — NO HTML/CSS.
//
// Hex values mirror Work/Dev/DESIGN-SYSTEM.md — when tokens change, update both.

import {
  Document,
  Page,
  View,
  Text,
  Svg,
  Rect,
  Polygon,
  Image,
  StyleSheet,
} from '@react-pdf/renderer';

// ---------- Star (SVG polygon) — Helvetica's ★ glyph renders unreliably in
// @react-pdf/renderer depending on the build's font fallback chain, so we
// draw the star directly. 5-point star centered in 12×12 viewBox.
function Star({ size = 8, color }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 12 12">
      <Polygon
        points="6,0.8 7.5,4.5 11.5,4.8 8.4,7.3 9.4,11.2 6,9.1 2.6,11.2 3.6,7.3 0.5,4.8 4.5,4.5"
        fill={color}
      />
    </Svg>
  );
}

// ---------- Brand colors — mirror of Work/Dev/DESIGN-SYSTEM.md ----------

const BRAND = '#2E6BA8';       // brand.DEFAULT
const BRAND_DARK = '#24578C';  // brand.dark — footer trust bar
const BRAND_LIGHT = '#E6EEF7'; // brand.light — decorative brand fills
const YELLOW = '#FFC220';      // accent.DEFAULT — yellow stripe + logo-mark slashes
const GREEN = '#059669';       // go.DEFAULT — success/check accents
// Tailwind stock grays retained for neutral scale — no design-system tokens yet.
const GRAY_100 = '#f3f4f6';
const GRAY_200 = '#e5e7eb';
const GRAY_300 = '#d1d5db';
const GRAY_500 = '#6b7280';
const GRAY_600 = '#4b5563';
const GRAY_700 = '#374151';
const GRAY_800 = '#1f2937';
const GRAY_900 = '#111827';

// ---------- Logo Mark — mirrors the canonical equal-parallel-slashes mark in src/app/layout.js.
// Four vertical bars on a white rounded square. Three yellow, one brand-blue (the tall middle).

function LogoMark({ size = 36 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 44 44">
      <Rect x="0" y="0" width="44" height="44" rx="8" ry="8" fill="#FFFFFF" stroke="#1A1F2E" strokeOpacity="0.12" />
      <Rect x="9"  y="24" width="5" height="11" rx="1" ry="1" fill={YELLOW} />
      <Rect x="17" y="21" width="5" height="14" rx="1" ry="1" fill={YELLOW} />
      <Rect x="25" y="12" width="5" height="23" rx="1" ry="1" fill={BRAND} />
      <Rect x="33" y="26" width="5" height="9"  rx="1" ry="1" fill={YELLOW} />
    </Svg>
  );
}

// ---------- Styles ----------

const s = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 48,
    fontSize: 11,
    fontFamily: 'Helvetica',
    color: GRAY_800,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  wordmark: {
    flexDirection: 'column',
  },
  wordmarkRow: {
    flexDirection: 'row',
  },
  wordNet: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: GRAY_900 },
  wordRate: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: BRAND },
  wordMortgage: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: GRAY_700 },
  companyNmls: { fontSize: 9, color: GRAY_500, marginTop: 1 },
  companyAddress: { fontSize: 9, color: GRAY_500, marginTop: 1 },
  headerRight: { alignItems: 'flex-end' },

  // Accent stripe under header
  accentStripe: {
    height: 3,
    backgroundColor: BRAND,
    marginBottom: 2,
  },
  yellowStripe: {
    height: 1.5,
    backgroundColor: YELLOW,
    marginBottom: 10,
  },

  // Title bar
  titleBar: {
    backgroundColor: GRAY_100,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginBottom: 10,
  },
  titleText: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: BRAND,
    textAlign: 'center',
    letterSpacing: 0.5,
  },

  // Borrower info grid
  infoGrid: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  infoCol: { width: '50%' },
  infoLabel: { fontSize: 8, color: GRAY_500, marginBottom: 1, textTransform: 'uppercase', letterSpacing: 0.6 },
  infoValue: { fontSize: 11, color: GRAY_900, fontFamily: 'Helvetica-Bold', marginBottom: 3 },

  // Body text
  bodyText: {
    fontSize: 11,
    color: GRAY_700,
    lineHeight: 1.45,
    marginBottom: 8,
  },

  // Property address callout
  propertyCallout: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: BRAND_LIGHT,
    borderLeftWidth: 3,
    borderLeftColor: BRAND,
    borderRadius: 3,
    marginTop: 4,
    marginBottom: 14,
  },
  propertyText: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: GRAY_900,
  },

  // Hero boxes
  heroRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  heroBox: {
    flex: 1,
    backgroundColor: GRAY_100,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  heroLabel: {
    fontSize: 8,
    color: BRAND,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  heroValue: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: GRAY_900,
  },

  // Loan details + verification side by side
  detailsRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 14,
  },
  detailsCol: { flex: 1 },
  detailsTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: BRAND,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: GRAY_200,
  },
  detailLabel: { fontSize: 10, color: GRAY_600 },
  detailValue: { fontSize: 10, color: GRAY_900, fontFamily: 'Helvetica-Bold' },

  // Verification checklist
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 6,
    backgroundColor: GRAY_100,
    borderRadius: 4,
    marginBottom: 2,
  },
  checkIcon: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { fontSize: 9, color: GREEN, fontFamily: 'Helvetica-Bold' },
  checkLabel: { fontSize: 10, color: GRAY_900, fontFamily: 'Helvetica-Bold' },
  uncheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
    marginBottom: 2,
  },
  uncheckIcon: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: GRAY_100,
    borderWidth: 0.5,
    borderColor: GRAY_300,
    marginRight: 6,
  },
  uncheckLabel: { fontSize: 10, color: GRAY_500 },

  // Conditions note
  conditionsText: {
    fontSize: 9,
    color: GRAY_800,
    lineHeight: 1.35,
    marginTop: 4,
    marginBottom: 4,
  },

  // Signature block
  signatureBlock: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sincerely: { fontSize: 10, color: GRAY_600, marginBottom: 4 },
  signatureLine: {
    width: 180,
    borderBottomWidth: 1,
    borderBottomColor: BRAND,
    marginBottom: 6,
    marginTop: 40,
  },
  signatureName: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: GRAY_900 },
  signatureDetail: { fontSize: 9, color: GRAY_700, marginTop: 1 },
  signatureIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  signaturePhoto: {
    width: 54,
    height: 54,
    borderRadius: 27,
    objectFit: 'cover',
  },
  signatureIdCol: { flexDirection: 'column' },
  companyBlockRight: { alignItems: 'flex-end', justifyContent: 'flex-end' },
  companyBlock: { fontSize: 10, color: BRAND, fontFamily: 'Helvetica-Bold' },
  nmlsBlock: { fontSize: 9, color: GRAY_700, marginTop: 1 },

  // Trust bar
  trustBar: {
    position: 'absolute',
    bottom: 24,
    left: 48,
    right: 48,
    backgroundColor: BRAND_DARK,
    borderRadius: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trustItem: {
    alignItems: 'center',
    flex: 1,
  },
  trustLabel: {
    fontSize: 7,
    color: '#E5E7EB',
  },
  trustValue: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: 'white',
  },
  trustDivider: {
    width: 0.5,
    height: 16,
    backgroundColor: '#ffffff30',
  },
  starRow: {
    flexDirection: 'row',
    gap: 1.5,
    marginBottom: 0.5,
  },

  // Disclaimer
  disclaimer: {
    marginTop: 18,
    marginBottom: 34,
  },
  disclaimerText: {
    fontSize: 8,
    color: GRAY_700,
    lineHeight: 1.4,
  },
});

// ---------- Helpers ----------

function fmtDollar(val) {
  if (!val && val !== 0) return '$0';
  return '$' + Number(val).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

const LOAN_TYPE_DISPLAY = {
  conventional: 'Conventional',
  fha: 'FHA',
  va: 'VA',
  usda: 'USDA Rural',
  jumbo: 'Jumbo',
  nonqm: 'Non-QM',
  other: 'Other',
};

// Keyed on years (loans.loan_term is years per migration 017).
const LOAN_TERM_DISPLAY = {
  30: '30 Year Fixed',
  25: '25 Year Fixed',
  20: '20 Year Fixed',
  15: '15 Year Fixed',
};

// ---------- Component ----------

export default function PrequalLetterPDF({ data }) {
  const {
    borrowerNames,
    property_address,
    purchase_price,
    loan_amount,
    ltv,
    loan_type,
    loan_term,
    interest_rate,
    letterDate,
    expirationDate,
    reference_number,
    verifications,
    mlo_name,
    mloNmls,
    mloPhone,
    mloEmail,
    mloPhotoUrl,
  } = data;

  const verificationItems = [
    { key: 'creditReviewed', label: 'Credit Report Reviewed' },
    { key: 'incomeDocumented', label: 'Income Documented' },
    { key: 'assetsVerified', label: 'Assets Verified' },
    { key: 'ausApproval', label: 'AUS Approval Obtained' },
    { key: 'appraisal_waiver', label: 'Appraisal Waiver Accepted' },
  ];

  return (
    <Document
      title="Pre-Qualification Letter — NetRate Mortgage"
      author="NetRate Mortgage"
    >
      <Page size="LETTER" style={s.page}>

        {/* ===== HEADER: Logo Mark + Wordmark ===== */}
        <View style={s.headerRow}>
          <View style={s.headerLeft}>
            <LogoMark size={36} />
            <View style={s.wordmark}>
              <View style={s.wordmarkRow}>
                <Text style={s.wordNet}>Net</Text>
                <Text style={s.wordRate}>Rate</Text>
                <Text style={s.wordMortgage}> Mortgage</Text>
              </View>
              <Text style={s.companyNmls}>NMLS #1111861</Text>
            </View>
          </View>
          <View style={s.headerRight}>
            <Text style={s.companyAddress}>357 S McCaslin Blvd #200</Text>
            <Text style={s.companyAddress}>Louisville, CO 80027</Text>
            <Text style={[s.companyAddress, { marginTop: 3 }]}>303-444-5251</Text>
            <Text style={s.companyAddress}>netratemortgage.com</Text>
          </View>
        </View>

        {/* ===== ACCENT STRIPES ===== */}
        <View style={s.accentStripe} />
        <View style={s.yellowStripe} />

        {/* ===== TITLE BAR ===== */}
        <View style={s.titleBar}>
          <Text style={s.titleText}>Lender Pre-Qualification Letter</Text>
        </View>

        {/* ===== DATE + BORROWER INFO ===== */}
        <View style={s.infoGrid}>
          <View style={s.infoCol}>
            <Text style={s.infoLabel}>Borrower(s)</Text>
            <Text style={s.infoValue}>{borrowerNames}</Text>
            {reference_number ? (
              <>
                <Text style={s.infoLabel}>Reference</Text>
                <Text style={s.infoValue}>{reference_number}</Text>
              </>
            ) : null}
          </View>
          <View style={[s.infoCol, { alignItems: 'flex-end' }]}>
            <Text style={s.infoLabel}>Date</Text>
            <Text style={s.infoValue}>{fmtDate(letterDate)}</Text>
            <Text style={s.infoLabel}>Valid Through</Text>
            <Text style={s.infoValue}>{fmtDate(expirationDate)}</Text>
          </View>
        </View>

        {/* ===== LETTER BODY ===== */}
        <Text style={s.bodyText}>
          Dear {borrowerNames},
        </Text>
        <Text style={s.bodyText}>
          Thank you for the opportunity to serve your home financing needs. Based on the application and documentation provided, I am pleased to confirm that you have been pre-qualified for a home purchase at the following address:
        </Text>

        {/* Property address callout */}
        {property_address ? (
          <View style={s.propertyCallout}>
            <Text style={s.propertyText}>{property_address}</Text>
          </View>
        ) : null}

        {/* ===== HERO BOXES ===== */}
        <View style={s.heroRow}>
          <View style={s.heroBox}>
            <Text style={s.heroLabel}>Purchase Price</Text>
            <Text style={s.heroValue}>{fmtDollar(purchase_price)}</Text>
          </View>
          <View style={s.heroBox}>
            <Text style={s.heroLabel}>Max Loan Amount</Text>
            <Text style={s.heroValue}>{fmtDollar(loan_amount)}</Text>
          </View>
        </View>

        {/* ===== LOAN DETAILS + VERIFICATION ===== */}
        <View style={s.detailsRow}>
          {/* Left: Loan Terms */}
          <View style={s.detailsCol}>
            <Text style={s.detailsTitle}>Loan Terms</Text>
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Loan Type</Text>
              <Text style={s.detailValue}>
                {LOAN_TYPE_DISPLAY[loan_type] || loan_type || '—'}
              </Text>
            </View>
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Loan Term</Text>
              <Text style={s.detailValue}>
                {(() => {
                  // loans.loan_term is years per migration 017, but legacy records
                  // and user-typed overrides sometimes hold months (360/180). Normalize.
                  const n = Number(loan_term);
                  const years = n > 50 ? Math.round(n / 12) : n;
                  return LOAN_TERM_DISPLAY[years] || `${years} Year Fixed`;
                })()}
              </Text>
            </View>
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Loan-to-Value</Text>
              <Text style={s.detailValue}>{ltv ? `${Number(ltv).toFixed(2)}%` : '—'}</Text>
            </View>
            {interest_rate ? (
              <View style={s.detailRow}>
                <Text style={s.detailLabel}>Interest Rate</Text>
                <Text style={s.detailValue}>{interest_rate}%</Text>
              </View>
            ) : null}
          </View>

          {/* Right: Verification Checklist */}
          <View style={s.detailsCol}>
            <Text style={s.detailsTitle}>Verified</Text>
            {verificationItems.map((item) =>
              verifications[item.key] ? (
                <View key={item.key} style={s.checkRow}>
                  <View style={s.checkIcon}>
                    <Text style={s.checkMark}>✓</Text>
                  </View>
                  <Text style={s.checkLabel}>{item.label}</Text>
                </View>
              ) : (
                <View key={item.key} style={s.uncheckRow}>
                  <View style={s.uncheckIcon} />
                  <Text style={s.uncheckLabel}>{item.label}</Text>
                </View>
              )
            )}
          </View>
        </View>

        {/* ===== CONDITIONS NOTE ===== */}
        <Text style={s.conditionsText}>
          All information is subject to re-verification and acceptable appraisal, executed contract, and title commitment. This pre-qualification is subject to final underwriting approval and verification that financial condition has not materially changed.
        </Text>

        {/* ===== SIGNATURE BLOCK ===== */}
        <View style={s.signatureBlock}>
          <View>
            <Text style={s.sincerely}>Sincerely,</Text>
            <View style={s.signatureLine} />
            <View style={s.signatureIdRow}>
              {mloPhotoUrl ? <Image src={mloPhotoUrl} style={s.signaturePhoto} /> : null}
              <View style={s.signatureIdCol}>
                <Text style={s.signatureName}>{mlo_name}</Text>
                <Text style={s.signatureDetail}>NMLS #{mloNmls}</Text>
                <Text style={s.signatureDetail}>{mloPhone} | {mloEmail}</Text>
              </View>
            </View>
          </View>
          <View style={s.companyBlockRight}>
            <Text style={s.companyBlock}>NetRate Mortgage LLC</Text>
            <Text style={s.nmlsBlock}>NMLS #1111861</Text>
            <Text style={s.nmlsBlock}>netratemortgage.com</Text>
          </View>
        </View>

        {/* ===== DISCLAIMER ===== */}
        <View style={s.disclaimer}>
          <Text style={s.disclaimerText}>
            This is not a commitment to lend, nor a commitment of interest rate or fees. Changes to income, employment, assets, or credit may void this pre-qualification. Equal Housing Lender.
          </Text>
        </View>

        {/* ===== TRUST BAR (pinned to bottom, dark band) ===== */}
        <View style={s.trustBar}>
          <View style={s.trustItem}>
            <View style={[s.starRow, { marginBottom: 2 }]}>
              <Star size={9} color={YELLOW} />
              <Star size={9} color={YELLOW} />
              <Star size={9} color={YELLOW} />
              <Star size={9} color={YELLOW} />
              <Star size={9} color={YELLOW} />
            </View>
            <Text style={s.trustLabel}>Google Reviews</Text>
          </View>

          <View style={s.trustDivider} />

          <View style={s.trustItem}>
            <Text style={[s.trustValue, { fontSize: 10 }]}>A+</Text>
            <Text style={s.trustLabel}>BBB Rating</Text>
          </View>

          <View style={s.trustDivider} />

          <View style={s.trustItem}>
            <Text style={s.trustValue}>CO · CA · TX · OR</Text>
            <Text style={s.trustLabel}>Licensed States</Text>
          </View>

          <View style={s.trustDivider} />

          <View style={s.trustItem}>
            <Text style={s.trustValue}>Since 2013</Text>
            <Text style={s.trustLabel}>Established</Text>
          </View>
        </View>

      </Page>
    </Document>
  );
}
