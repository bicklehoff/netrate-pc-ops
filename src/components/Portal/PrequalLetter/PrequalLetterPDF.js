// PrequalLetterPDF.js — @react-pdf/renderer component for Pre-Qualification Letters
// Single-page professional PDF with NetRate Mortgage branding (2026 retheme).
// Uses react-pdf primitives (Document, Page, View, Text, Svg, Line, Rect) — NO HTML/CSS.

import {
  Document,
  Page,
  View,
  Text,
  Svg,
  Line,
  Rect,
  StyleSheet,
} from '@react-pdf/renderer';

// ---------- Brand Colors (2026 retheme) ----------

const BRAND = '#024c4f';

const BRAND_LIGHT = '#e6f0f0';
const YELLOW = '#fff000';
const DEEP = '#012d30';
const GREEN = '#059669';
const GREEN_LIGHT = '#ecfdf5';
const GRAY_100 = '#f3f4f6';
const GRAY_200 = '#e5e7eb';
const GRAY_300 = '#d1d5db';
const GRAY_500 = '#6b7280';
const GRAY_600 = '#4b5563';
const GRAY_700 = '#374151';
const GRAY_800 = '#1f2937';
const GRAY_900 = '#111827';

// ---------- Logo Mark (D-variation: yellow slashes on teal rounded square) ----------

function LogoMark({ size = 36 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 44 44">
      <Rect x="0" y="0" width="44" height="44" rx="14" ry="14" fill={BRAND} />
      <Line
        x1={11 * 1} y1={33 * 1} x2={23 * 1} y2={14 * 1}
        stroke={YELLOW}
        strokeWidth="4.5"
        strokeLinecap="round"
      />
      <Line
        x1={23 * 1} y1={30 * 1} x2={35 * 1} y2={11 * 1}
        stroke={YELLOW}
        strokeWidth="4.5"
        strokeLinecap="round"
      />
    </Svg>
  );
}

// ---------- Styles ----------

const s = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 28,
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
    marginBottom: 14,
  },

  // Title bar
  titleBar: {
    backgroundColor: BRAND,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginBottom: 14,
  },
  titleText: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: YELLOW,
    textAlign: 'center',
    letterSpacing: 0.5,
  },

  // Borrower info grid
  infoGrid: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  infoCol: { width: '50%' },
  infoLabel: { fontSize: 8, color: GRAY_500, marginBottom: 1, textTransform: 'uppercase', letterSpacing: 0.6 },
  infoValue: { fontSize: 11, color: GRAY_900, fontFamily: 'Helvetica-Bold', marginBottom: 5 },

  // Body text
  bodyText: {
    fontSize: 11,
    color: GRAY_700,
    lineHeight: 1.5,
    marginBottom: 7,
  },

  // Property address callout
  propertyCallout: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: BRAND_LIGHT,
    borderLeftWidth: 3,
    borderLeftColor: BRAND,
    borderRadius: 3,
    marginBottom: 12,
  },
  propertyText: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: GRAY_900,
  },

  // Hero boxes
  heroRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  heroBox: {
    flex: 1,
    backgroundColor: BRAND,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  heroLabel: {
    fontSize: 8,
    color: YELLOW,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  heroValue: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: 'white',
  },

  // Loan details + verification side by side
  detailsRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 10,
  },
  detailsCol: { flex: 1 },
  detailsTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: BRAND,
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    borderBottomWidth: 1.5,
    borderBottomColor: BRAND,
    paddingBottom: 3,
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
    borderBottomWidth: 0.5,
    borderBottomColor: GRAY_200,
  },
  checkIcon: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: GREEN_LIGHT,
    borderWidth: 0.5,
    borderColor: GREEN,
    marginRight: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { fontSize: 9, color: GREEN, fontFamily: 'Helvetica-Bold' },
  checkLabel: { fontSize: 10, color: GRAY_700 },
  uncheckIcon: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: GRAY_100,
    borderWidth: 0.5,
    borderColor: GRAY_300,
    marginRight: 6,
  },

  // Conditions note
  conditionsText: {
    fontSize: 10,
    color: GRAY_600,
    lineHeight: 1.4,
    marginBottom: 4,
  },

  // Signature block
  signatureBlock: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sincerely: { fontSize: 10, color: GRAY_600, marginBottom: 4 },
  signatureLine: {
    width: 180,
    borderBottomWidth: 1,
    borderBottomColor: BRAND,
    marginBottom: 4,
    marginTop: 18,
  },
  signatureName: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: GRAY_900 },
  signatureDetail: { fontSize: 9, color: GRAY_500, marginTop: 1 },
  companyBlockRight: { alignItems: 'flex-end', justifyContent: 'flex-end' },
  companyBlock: { fontSize: 10, color: BRAND, fontFamily: 'Helvetica-Bold' },
  nmlsBlock: { fontSize: 9, color: GRAY_500, marginTop: 1 },

  // Trust bar
  trustBar: {
    position: 'absolute',
    bottom: 28,
    left: 48,
    right: 48,
    backgroundColor: DEEP,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trustItem: {
    alignItems: 'center',
    flex: 1,
  },
  trustLabel: {
    fontSize: 8,
    color: '#9ca3af',
  },
  trustValue: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: 'white',
  },
  trustDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#ffffff20',
  },
  starRow: {
    flexDirection: 'row',
    gap: 1,
    marginBottom: 1,
  },
  star: {
    fontSize: 9,
    color: YELLOW,
  },

  // Disclaimer
  disclaimer: {
    marginBottom: 40,
  },
  disclaimerText: {
    fontSize: 8,
    color: GRAY_500,
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
};

const LOAN_TERM_DISPLAY = {
  360: '30 Year Fixed',
  240: '20 Year Fixed',
  180: '15 Year Fixed',
};

// ---------- Component ----------

export default function PrequalLetterPDF({ data }) {
  const {
    borrowerNames,
    propertyAddress,
    purchasePrice,
    loanAmount,
    ltv,
    loanType,
    loanTerm,
    interestRate,
    letterDate,
    expirationDate,
    referenceNumber,
    verifications,
    mloName,
    mloNmls,
    mloPhone,
    mloEmail,
  } = data;

  const verificationItems = [
    { key: 'creditReviewed', label: 'Credit Report Reviewed' },
    { key: 'incomeDocumented', label: 'Income Documented' },
    { key: 'assetsVerified', label: 'Assets Verified' },
    { key: 'ausApproval', label: 'AUS Approval Obtained' },
    { key: 'appraisalWaiver', label: 'Appraisal Waiver Accepted' },
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
            {referenceNumber ? (
              <>
                <Text style={s.infoLabel}>Reference</Text>
                <Text style={s.infoValue}>{referenceNumber}</Text>
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
        {propertyAddress ? (
          <View style={s.propertyCallout}>
            <Text style={s.propertyText}>{propertyAddress}</Text>
          </View>
        ) : null}

        {/* ===== HERO BOXES ===== */}
        <View style={s.heroRow}>
          <View style={s.heroBox}>
            <Text style={s.heroLabel}>Purchase Price</Text>
            <Text style={s.heroValue}>{fmtDollar(purchasePrice)}</Text>
          </View>
          <View style={s.heroBox}>
            <Text style={s.heroLabel}>Max Loan Amount</Text>
            <Text style={s.heroValue}>{fmtDollar(loanAmount)}</Text>
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
                {LOAN_TYPE_DISPLAY[loanType] || loanType || '—'}
              </Text>
            </View>
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Loan Term</Text>
              <Text style={s.detailValue}>
                {LOAN_TERM_DISPLAY[loanTerm] || `${loanTerm} months`}
              </Text>
            </View>
            <View style={s.detailRow}>
              <Text style={s.detailLabel}>Loan-to-Value</Text>
              <Text style={s.detailValue}>{ltv ? `${Number(ltv).toFixed(1)}%` : '—'}</Text>
            </View>
            {interestRate ? (
              <View style={s.detailRow}>
                <Text style={s.detailLabel}>Interest Rate</Text>
                <Text style={s.detailValue}>{interestRate}%</Text>
              </View>
            ) : null}
          </View>

          {/* Right: Verification Checklist */}
          <View style={s.detailsCol}>
            <Text style={s.detailsTitle}>Verified</Text>
            {verificationItems.map((item) => (
              <View key={item.key} style={s.checkRow}>
                {verifications[item.key] ? (
                  <View style={s.checkIcon}>
                    <Text style={s.checkMark}>✓</Text>
                  </View>
                ) : (
                  <View style={s.uncheckIcon} />
                )}
                <Text style={s.checkLabel}>{item.label}</Text>
              </View>
            ))}
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
            <Text style={s.signatureName}>{mloName}</Text>
            <Text style={s.signatureDetail}>NMLS #{mloNmls}</Text>
            <Text style={s.signatureDetail}>{mloPhone} | {mloEmail}</Text>
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
            <View style={s.starRow}>
              <Text style={s.star}>★</Text>
              <Text style={s.star}>★</Text>
              <Text style={s.star}>★</Text>
              <Text style={s.star}>★</Text>
              <Text style={s.star}>★</Text>
            </View>
            <Text style={s.trustValue}>4.9 / 5.0</Text>
            <Text style={s.trustLabel}>Google Reviews</Text>
          </View>

          <View style={s.trustDivider} />

          <View style={s.trustItem}>
            <Text style={[s.trustValue, { color: YELLOW, fontSize: 13 }]}>A+</Text>
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
