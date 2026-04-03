/**
 * QuotePDF — Borrower rate quote with Financial Architect design language.
 *
 * Page 1: Loan Summary — 3-rate side-by-side comparison, key figures, cash to close
 * Page 2: Monthly Payments — detailed payment breakdown per rate
 * Page 3: Closing Costs — fee sections A-G, daily interest, totals
 * Page 4: Amortization Schedule — yearly principal/interest/balance
 */

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';

/* ── Design Tokens ── */
const BRAND = '#0891b2';       // cyan-600
const BRAND_DARK = '#0e7490';  // cyan-700
const SURFACE = '#f8f9fb';
const SURFACE_LOW = '#f2f4f6';
const SURFACE_HIGH = '#e6e8ea';
const ON_SURFACE = '#191c1e';
const ON_SURFACE_VAR = '#434652';
const OUTLINE = '#737783';
const OUTLINE_VAR = '#c3c6d4';
const GREEN = '#059669';
const RED = '#dc2626';
const WHITE = '#ffffff';

const s = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: ON_SURFACE,
    backgroundColor: WHITE,
  },

  /* ── Header ── */
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: OUTLINE_VAR + '30', marginBottom: 16 },
  logoBlock: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoIcon: { width: 28, height: 28, backgroundColor: BRAND, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  logoIconText: { fontFamily: 'Helvetica-Bold', fontSize: 15, color: WHITE, textAlign: 'center', marginTop: 3 },
  companyName: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: BRAND_DARK },
  subtitle: { fontSize: 7, letterSpacing: 2, textTransform: 'uppercase', color: OUTLINE, marginTop: 1 },
  headerDetail: { fontSize: 8, color: OUTLINE, marginTop: 1 },

  /* ── Borrower / date bar ── */
  infoBar: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  badge: { backgroundColor: SURFACE_LOW, borderRadius: 10, paddingVertical: 3, paddingHorizontal: 10 },
  badgeText: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: OUTLINE, textTransform: 'uppercase', letterSpacing: 1 },

  /* ── Summary cards ── */
  cardRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  card: { flex: 1, backgroundColor: SURFACE_LOW, borderRadius: 8, padding: 12 },
  cardLabel: { fontSize: 7, textTransform: 'uppercase', letterSpacing: 1.5, color: OUTLINE, marginBottom: 2 },
  cardValue: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: ON_SURFACE },

  /* ── Section title ── */
  sectionTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: BRAND_DARK, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6, marginTop: 14 },

  /* ── Comparison table ── */
  tableHeader: { flexDirection: 'row', backgroundColor: SURFACE_LOW, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 8, marginBottom: 2 },
  tableRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8 },
  tableRowAlt: { backgroundColor: SURFACE },
  labelCol: { width: '40%', fontSize: 9 },
  labelColBold: { width: '40%', fontSize: 9.5, fontFamily: 'Helvetica-Bold' },
  valCol: { width: '20%', textAlign: 'center', fontSize: 10 },
  valColBold: { width: '20%', textAlign: 'center', fontSize: 11, fontFamily: 'Helvetica-Bold' },
  headerLabel: { width: '40%' },
  headerVal: { width: '20%', textAlign: 'center' },
  headerValRate: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: ON_SURFACE },
  headerValLabel: { fontSize: 7, color: OUTLINE },

  /* ── Total row (brand bar) ── */
  totalRow: { flexDirection: 'row', backgroundColor: BRAND, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 8, marginTop: 4 },
  totalLabel: { width: '40%', fontSize: 10, fontFamily: 'Helvetica-Bold', color: WHITE },
  totalVal: { width: '20%', textAlign: 'center', fontSize: 13, fontFamily: 'Helvetica-Bold', color: WHITE },

  /* ── Cash to close card ── */
  ctcCard: { backgroundColor: SURFACE_HIGH, borderRadius: 10, padding: 14, marginTop: 14, borderLeftWidth: 3, borderLeftColor: BRAND },
  ctcTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: ON_SURFACE, marginBottom: 8 },

  /* ── Page 2: Payment cards ── */
  paymentCard: { backgroundColor: SURFACE_LOW, borderRadius: 8, padding: 12, marginBottom: 10 },
  paymentRate: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: ON_SURFACE },
  paymentProgram: { fontSize: 8, color: OUTLINE, marginTop: 1, marginBottom: 8 },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  paymentLabel: { fontSize: 9, color: ON_SURFACE_VAR },
  paymentAmount: { fontSize: 9.5, fontFamily: 'Helvetica-Bold' },
  paymentTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 6, marginTop: 6, borderTopWidth: 0.5, borderTopColor: OUTLINE_VAR + '40' },
  paymentTotalLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: ON_SURFACE },
  paymentTotalAmount: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: BRAND_DARK },
  creditBadge: { marginTop: 4, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 8, alignSelf: 'flex-start' },
  creditBadgeGreen: { backgroundColor: '#ecfdf5' },
  creditBadgeRed: { backgroundColor: '#fef2f2' },

  /* ── Page 3: Fee sections ── */
  feeSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: SURFACE_LOW, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 4, marginTop: 10 },
  feeSectionLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: ON_SURFACE },
  feeSectionTotal: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: ON_SURFACE },
  feeIcon: { width: 14, height: 14, backgroundColor: BRAND, borderRadius: 3, justifyContent: 'center', alignItems: 'center', marginRight: 6 },
  feeIconText: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: WHITE, textAlign: 'center', lineHeight: 14 },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, paddingHorizontal: 8, paddingLeft: 28 },
  feeRowAlt: { backgroundColor: SURFACE },
  feeLabel: { fontSize: 9, color: ON_SURFACE_VAR },
  feeAmount: { fontSize: 9.5, color: ON_SURFACE },
  subtotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, paddingHorizontal: 8, marginTop: 2, borderTopWidth: 1, borderTopColor: ON_SURFACE, borderBottomWidth: 0.5, borderBottomColor: OUTLINE_VAR },
  subtotalLabel: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: ON_SURFACE },
  subtotalAmount: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: ON_SURFACE },
  feeTotalBar: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: ON_SURFACE, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 8, marginTop: 10 },
  feeTotalLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: WHITE },
  feeTotalAmount: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: WHITE },

  /* ── Page 4: Amortization ── */
  amortHeader: { flexDirection: 'row', backgroundColor: ON_SURFACE, borderRadius: 6, paddingVertical: 5, paddingHorizontal: 8, marginBottom: 2 },
  amortHeaderText: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: WHITE, textTransform: 'uppercase', letterSpacing: 1 },
  amortRow: { flexDirection: 'row', paddingVertical: 3.5, paddingHorizontal: 8 },
  amortRowAlt: { backgroundColor: SURFACE },
  amortCell: { fontSize: 8.5, color: ON_SURFACE, textAlign: 'right' },
  amortCellBold: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: ON_SURFACE, textAlign: 'right' },
  amortLabelCell: { fontSize: 8.5, color: ON_SURFACE_VAR },
  milestoneBadge: { backgroundColor: '#ecfdf5', borderRadius: 8, paddingVertical: 3, paddingHorizontal: 8, marginRight: 8, marginBottom: 6 },
  milestoneBadgeBlue: { backgroundColor: '#ecfeff' },
  milestoneText: { fontSize: 7, fontFamily: 'Helvetica-Bold' },
  milestoneGreen: { color: GREEN },
  milestoneCyan: { color: BRAND_DARK },

  /* ── Shared ── */
  greenText: { color: GREEN },
  redText: { color: RED },
  note: { fontSize: 7, color: OUTLINE, lineHeight: 1.5, marginTop: 16, textDecoration: 'none' },
  footer: { position: 'absolute', bottom: 34, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', fontSize: 6.5, color: OUTLINE, borderTopWidth: 0.5, borderTopColor: OUTLINE_VAR + '30', paddingTop: 6 },
  pageLabel: { position: 'absolute', bottom: 20, right: 40, fontSize: 6.5, color: OUTLINE },
});

/* ── Formatters ── */
function $(n) {
  if (n == null) return '$0';
  const num = Number(n);
  const neg = num < 0;
  const abs = Math.abs(num);
  const formatted = '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return neg ? `(${formatted})` : formatted;
}

function $int(n) {
  if (n == null) return '$0';
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function pct(n) {
  if (n == null) return '0%';
  return Number(n).toFixed(3) + '%';
}

/* ── Amortization calculator ── */
function buildAmortization(loanAmount, annualRate, termYears) {
  const monthlyRate = annualRate / 100 / 12;
  const totalPayments = termYears * 12;
  const payment = monthlyRate > 0
    ? loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, totalPayments)) / (Math.pow(1 + monthlyRate, totalPayments) - 1)
    : loanAmount / totalPayments;

  const yearly = [];
  let balance = loanAmount;
  let yearPrincipal = 0;
  let yearInterest = 0;

  for (let m = 1; m <= totalPayments; m++) {
    const interest = balance * monthlyRate;
    const principal = payment - interest;
    balance -= principal;
    yearPrincipal += principal;
    yearInterest += interest;

    if (m % 12 === 0) {
      yearly.push({
        year: m / 12,
        principal: yearPrincipal,
        interest: yearInterest,
        totalPayment: yearPrincipal + yearInterest,
        balance: Math.max(0, balance),
      });
      yearPrincipal = 0;
      yearInterest = 0;
    }
  }
  return yearly;
}

/* ══════════════════════════════════════════════════
   QuotePDF Component
   ══════════════════════════════════════════════════ */
export default function QuotePDF({ quote, scenarios, fees, closingDate, fundingDate, firstPaymentDate }) {
  const borrowerName = quote.borrowerName || 'Valued Client';
  const date = new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
  const rates = (scenarios || []).slice(0, 3).sort((a, b) => b.rate - a.rate);
  const loanAmount = Number(quote.loanAmount);
  const propertyValue = Number(quote.propertyValue);
  const ltv = Number(quote.ltv);
  const term = quote.term || 30;

  const closingDay = closingDate ? new Date(closingDate) : null;
  const daysInterest = closingDay ? (new Date(closingDay.getFullYear(), closingDay.getMonth() + 1, 0).getDate() - closingDay.getDate() + 1) : 7;

  const monthlyTax = fees?.monthlyTax || 0;
  const monthlyIns = fees?.monthlyInsurance || 0;

  // Amortization for the first rate (PDF shows one schedule, web lets user toggle)
  const amortSchedule = rates[0] ? buildAmortization(loanAmount, rates[0].rate, term) : [];
  const totalInterest = amortSchedule.reduce((sum, y) => sum + y.interest, 0);
  const totalPaid = amortSchedule.reduce((sum, y) => sum + y.totalPayment, 0);
  const crossoverYear = amortSchedule.find(y => y.principal > y.interest);
  const halfwayYear = amortSchedule.find(y => y.balance <= loanAmount / 2);

  return (
    <Document>
      {/* ═══ PAGE 1: Loan Summary ═══ */}
      <Page size="LETTER" style={s.page}>
        <Header borrowerName={borrowerName} date={date} />

        {/* Summary cards */}
        <View style={s.cardRow}>
          <View style={s.card}>
            <Text style={s.cardLabel}>Appraised Value</Text>
            <Text style={s.cardValue}>{$int(propertyValue)}</Text>
          </View>
          <View style={s.card}>
            <Text style={s.cardLabel}>Loan Amount</Text>
            <Text style={s.cardValue}>{$int(loanAmount)}</Text>
          </View>
          <View style={s.card}>
            <Text style={s.cardLabel}>Loan to Value (LTV)</Text>
            <Text style={s.cardValue}>{ltv.toFixed(1)}%</Text>
          </View>
        </View>

        {/* Rate comparison */}
        <Text style={s.sectionTitle}>Comparison of Rates</Text>
        <RateHeaders rates={rates} />
        <CompRow label="Lender Credit / (Charge) %" values={rates.map(r => {
          const isCredit = r.rebateDollars > 0;
          const price = r.price || 100;
          const val = isCredit ? (price - 100).toFixed(3) : (100 - price).toFixed(3);
          return { text: isCredit ? val + '%' : '(' + val + '%)', color: isCredit ? GREEN : RED };
        })} />
        <CompRow label="Lender Credit / (Charge) $" values={rates.map(r => {
          const isCredit = r.rebateDollars > 0;
          return isCredit
            ? { text: $int(r.rebateDollars), color: GREEN }
            : { text: '(' + $int(r.discountDollars || 0) + ')', color: RED };
        })} alt />

        {/* Monthly payment */}
        <Text style={s.sectionTitle}>Monthly Payment Comparison</Text>
        <RateHeaders rates={rates} />
        <CompRow label="Principal & Interest" values={rates.map(r => ({ text: $(r.monthlyPI) }))} />
        <CompRow label={`Taxes (${new Date().getFullYear()})`} values={rates.map(() => ({ text: $(monthlyTax) }))} alt />
        <CompRow label="Insurance (est)" values={rates.map(() => ({ text: $(monthlyIns) }))} />
        <CompRow label={fees?.monthlyMip > 0 ? 'MIP' : 'PMI'} values={rates.map(() => ({ text: $(fees?.monthlyMip || 0) }))} alt />
        <View style={s.totalRow}>
          <Text style={s.totalLabel}>Total Monthly Payment</Text>
          {rates.map((r, i) => (
            <Text key={i} style={s.totalVal}>{$(Number(r.monthlyPI || 0) + monthlyTax + monthlyIns + (fees?.monthlyMip || 0))}</Text>
          ))}
        </View>

        {/* Cash to close */}
        <CashToClose rates={rates} fees={fees} loanAmount={loanAmount} propertyValue={propertyValue} quote={quote} daysInterest={daysInterest} />

        <Footer page={1} />
      </Page>

      {/* ═══ PAGE 2: Monthly Payments ═══ */}
      <Page size="LETTER" style={s.page}>
        <Header borrowerName={borrowerName} date={date} />
        <Text style={[s.sectionTitle, { marginTop: 0 }]}>Monthly Payment Breakdown</Text>

        {rates.map((r, i) => {
          const mip = fees?.monthlyMip || 0;
          const total = Number(r.monthlyPI || 0) + monthlyTax + monthlyIns + mip;
          return (
            <View key={i} style={s.paymentCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View>
                  <Text style={{ fontSize: 7, textTransform: 'uppercase', letterSpacing: 1.5, color: OUTLINE }}>Option {i + 1}</Text>
                  <Text style={s.paymentRate}>{pct(r.rate)}</Text>
                  <Text style={s.paymentProgram}>{r.program || 'Fixed Rate'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.paymentTotalAmount}>{$(total)}</Text>
                  <Text style={{ fontSize: 7, color: OUTLINE }}>per month</Text>
                </View>
              </View>

              <View style={s.paymentRow}>
                <Text style={s.paymentLabel}>Principal & Interest</Text>
                <Text style={s.paymentAmount}>{$(r.monthlyPI)}</Text>
              </View>
              <View style={s.paymentRow}>
                <Text style={s.paymentLabel}>Taxes ({new Date().getFullYear()})</Text>
                <Text style={s.paymentAmount}>{$(monthlyTax)}</Text>
              </View>
              <View style={s.paymentRow}>
                <Text style={s.paymentLabel}>Insurance (est)</Text>
                <Text style={s.paymentAmount}>{$(monthlyIns)}</Text>
              </View>
              <View style={s.paymentRow}>
                <Text style={s.paymentLabel}>{mip > 0 ? 'MIP' : 'PMI'}</Text>
                <Text style={s.paymentAmount}>{$(mip)}</Text>
              </View>

              {r.rebateDollars > 0 && (
                <View style={[s.creditBadge, s.creditBadgeGreen]}>
                  <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: GREEN }}>Lender credit: {$int(r.rebateDollars)}</Text>
                </View>
              )}
              {r.discountDollars > 0 && (
                <View style={[s.creditBadge, s.creditBadgeRed]}>
                  <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Bold', color: RED }}>Discount points: {$int(r.discountDollars)}</Text>
                </View>
              )}
            </View>
          );
        })}

        {/* Dates section */}
        <View wrap={false}>
          <Text style={s.sectionTitle}>Key Dates</Text>
          <View style={{ backgroundColor: SURFACE_LOW, borderRadius: 8, padding: 12 }}>
            <DateRow label="Closing Date" value={closingDate || 'TBD'} />
            <DateRow label="Funding Date" value={fundingDate || 'TBD'} />
            <DateRow label="First Payment Date" value={firstPaymentDate || 'TBD'} />
            <DateRow label="Days Interest" value={String(daysInterest)} />
          </View>
        </View>

        <Footer page={2} />
      </Page>

      {/* ═══ PAGE 3: Closing Costs ═══ */}
      <Page size="LETTER" style={s.page}>
        <Header borrowerName={borrowerName} date={date} />
        <Text style={[s.sectionTitle, { marginTop: 0 }]}>Closing Costs</Text>

        {/* ── Loan Costs (Sections A–C) ── */}
        <Text style={{ fontSize: 7.5, color: OUTLINE, marginBottom: 4, lineHeight: 1.4 }}>
          Loan costs are fees charged by your lender and third-party services required to originate and close your loan.
        </Text>
        {[
          { key: 'sectionA' },
          { key: 'sectionB' },
          { key: 'sectionC' },
        ].map(({ key }) => {
          const section = fees?.[key];
          if (!section) return null;
          return (
            <View key={key}>
              <View style={s.feeSectionHeader}>
                <Text style={s.feeSectionLabel}>{section.label}</Text>
                <Text style={s.feeSectionTotal}>{$(section.total)}</Text>
              </View>
              {(section.items || []).map((item, i) => (
                <View key={i} style={[s.feeRow, i % 2 !== 0 && s.feeRowAlt]}>
                  <Text style={s.feeLabel}>{item.label}</Text>
                  <Text style={s.feeAmount}>{$(item.amount)}</Text>
                </View>
              ))}
            </View>
          );
        })}

        {/* D. Total Loan Costs subtotal */}
        <View style={s.subtotalRow}>
          <Text style={s.subtotalLabel}>D. Total Loan Costs (A + B + C)</Text>
          <Text style={s.subtotalAmount}>{$(fees?.sectionD ?? ((fees?.sectionA?.total||0) + (fees?.sectionB?.total||0) + (fees?.sectionC?.total||0)))}</Text>
        </View>

        {/* ── Other Costs (Sections E–H) ── */}
        <Text style={{ fontSize: 7.5, color: OUTLINE, marginTop: 6, marginBottom: 4, lineHeight: 1.4 }}>
          Other costs include government fees, prepaid items (interest, insurance), and escrow reserves collected at closing.
        </Text>
        {[
          { key: 'sectionE' },
          { key: 'sectionF' },
          { key: 'sectionG' },
          { key: 'sectionH' },
        ].map(({ key }) => {
          const section = fees?.[key];
          if (!section || (section.items?.length === 0 && key !== 'sectionH')) return null;
          // Only show H if it has items
          if (key === 'sectionH' && (!section.items || section.items.length === 0)) return null;
          return (
            <View key={key}>
              <View style={s.feeSectionHeader}>
                <Text style={s.feeSectionLabel}>{section.label}</Text>
                <Text style={s.feeSectionTotal}>{$(section.total)}</Text>
              </View>
              {(section.items || []).map((item, i) => (
                <View key={i} style={[s.feeRow, i % 2 !== 0 && s.feeRowAlt]}>
                  <Text style={s.feeLabel}>{item.label}</Text>
                  <Text style={s.feeAmount}>{$(item.amount)}</Text>
                </View>
              ))}
            </View>
          );
        })}

        {/* I. Total Other Costs subtotal */}
        <View style={s.subtotalRow}>
          <Text style={s.subtotalLabel}>I. Total Other Costs (E + F + G + H)</Text>
          <Text style={s.subtotalAmount}>{$(fees?.sectionI ?? ((fees?.sectionE?.total||0) + (fees?.sectionF?.total||0) + (fees?.sectionG?.total||0) + (fees?.sectionH?.total||0)))}</Text>
        </View>

        {/* J. Total Closing Costs */}
        <View style={s.feeTotalBar}>
          <Text style={s.feeTotalLabel}>J. Total Closing Costs (D + I)</Text>
          <Text style={s.feeTotalAmount}>{$(fees?.totalClosingCosts)}</Text>
        </View>

        {/* Disclaimer */}
        <Text style={s.note}>
          IMPORTANT: This document is NOT a Loan Estimate (LE) as defined under TRID/TILA-RESPA. It is an informal quote for informational and comparison purposes only. Actual rates, fees, and terms may vary based on full credit review, property appraisal, and underwriting. A formal Loan Estimate will be provided within three business days of receiving your completed loan application.
        </Text>

        <Footer page={3} />
      </Page>

      {/* ═══ PAGE 4: Amortization ═══ */}
      <Page size="LETTER" style={s.page}>
        <Header borrowerName={borrowerName} date={date} />
        <Text style={[s.sectionTitle, { marginTop: 0 }]}>Amortization Schedule — {pct(rates[0]?.rate)}</Text>

        {/* Summary cards */}
        <View style={s.cardRow}>
          <View style={s.card}>
            <Text style={s.cardLabel}>Total Interest Paid</Text>
            <Text style={[s.cardValue, { fontSize: 14 }]}>{$int(totalInterest)}</Text>
          </View>
          <View style={s.card}>
            <Text style={s.cardLabel}>Total Amount Paid</Text>
            <Text style={[s.cardValue, { fontSize: 14 }]}>{$int(totalPaid)}</Text>
          </View>
          <View style={s.card}>
            <Text style={s.cardLabel}>Interest vs Principal</Text>
            <Text style={[s.cardValue, { fontSize: 14 }]}>{((totalInterest / totalPaid) * 100).toFixed(1)}%</Text>
          </View>
        </View>

        {/* Milestones */}
        {(crossoverYear || halfwayYear) && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 }}>
            {crossoverYear && (
              <View style={s.milestoneBadge}>
                <Text style={[s.milestoneText, s.milestoneGreen]}>Year {crossoverYear.year}: Principal exceeds interest</Text>
              </View>
            )}
            {halfwayYear && (
              <View style={[s.milestoneBadge, s.milestoneBadgeBlue]}>
                <Text style={[s.milestoneText, s.milestoneCyan]}>Year {halfwayYear.year}: 50% of principal paid off</Text>
              </View>
            )}
          </View>
        )}

        {/* Table header */}
        <View style={s.amortHeader}>
          <Text style={[s.amortHeaderText, { width: '12%', textAlign: 'left' }]}>Year</Text>
          <Text style={[s.amortHeaderText, { width: '22%', textAlign: 'right' }]}>Principal</Text>
          <Text style={[s.amortHeaderText, { width: '22%', textAlign: 'right' }]}>Interest</Text>
          <Text style={[s.amortHeaderText, { width: '22%', textAlign: 'right' }]}>Total Paid</Text>
          <Text style={[s.amortHeaderText, { width: '22%', textAlign: 'right' }]}>Balance</Text>
        </View>

        {/* Table rows */}
        {amortSchedule.map((row, i) => {
          const isMilestone = row.year % 5 === 0;
          return (
            <View key={row.year} style={[s.amortRow, i % 2 !== 0 && s.amortRowAlt]}>
              <Text style={[s.amortLabelCell, { width: '12%' }, isMilestone && { fontFamily: 'Helvetica-Bold' }]}>{row.year}</Text>
              <Text style={[isMilestone ? s.amortCellBold : s.amortCell, { width: '22%' }]}>{$int(row.principal)}</Text>
              <Text style={[isMilestone ? s.amortCellBold : s.amortCell, { width: '22%' }]}>{$int(row.interest)}</Text>
              <Text style={[isMilestone ? s.amortCellBold : s.amortCell, { width: '22%' }]}>{$int(row.totalPayment)}</Text>
              <Text style={[isMilestone ? s.amortCellBold : s.amortCell, { width: '22%' }]}>{$int(row.balance)}</Text>
            </View>
          );
        })}

        <Text style={[s.note, { marginTop: 6, marginBottom: 20 }]}>
          This amortization schedule shows yearly totals. Actual monthly payments may vary slightly due to rounding. Schedule assumes no prepayments or rate changes.
        </Text>

        <Footer page={4} />
      </Page>
    </Document>
  );
}

/* ═══ Shared PDF sub-components ═══ */

function Header({ borrowerName, date }) {
  return (
    <>
      <View style={s.headerRow}>
        <View>
          <View style={s.logoBlock}>
            <View style={s.logoIcon}><Text style={s.logoIconText}>N</Text></View>
            <View>
              <Text style={s.companyName}>NetRate Mortgage</Text>
            </View>
          </View>
          <Text style={[s.headerDetail, { marginTop: 4 }]}>David Burson | NMLS #641790</Text>
          <Text style={s.headerDetail}>357 S McCaslin Blvd #200, Louisville, CO 80027</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={s.badge}><Text style={s.badgeText}>Personalized Rate Quote</Text></View>
          <Text style={[s.headerDetail, { fontSize: 10, fontFamily: 'Helvetica-Bold', color: ON_SURFACE, marginTop: 6 }]}>Borrower: {borrowerName}</Text>
          <Text style={s.headerDetail}>Date Prepared: {date}</Text>
        </View>
      </View>
    </>
  );
}

function Footer({ page }) {
  return (
    <>
      <View style={s.footer} fixed>
        <Text>NetRate Mortgage LLC | NMLS #1111861 | Equal Housing Lender</Text>
        <Text>303-444-5251 | david@netratemortgage.com</Text>
      </View>
      <Text style={s.pageLabel} fixed>Page {page} of 4</Text>
    </>
  );
}

function RateHeaders({ rates }) {
  return (
    <View style={s.tableHeader}>
      <View style={s.headerLabel} />
      {rates.map((r, i) => (
        <View key={i} style={s.headerVal}>
          <Text style={s.headerValLabel}>Option {i + 1}</Text>
          <Text style={s.headerValRate}>{pct(r.rate)}</Text>
        </View>
      ))}
    </View>
  );
}

function CompRow({ label, values, alt, bold }) {
  return (
    <View style={[s.tableRow, alt && s.tableRowAlt]}>
      <Text style={bold ? s.labelColBold : s.labelCol}>{label}</Text>
      {values.map((v, i) => (
        <Text key={i} style={[
          bold ? s.valColBold : s.valCol,
          v.color === GREEN && s.greenText,
          v.color === RED && s.redText,
        ]}>
          {v.text}
        </Text>
      ))}
      {values.length < 3 && Array.from({ length: 3 - values.length }).map((_, i) => (
        <Text key={`pad${i}`} style={s.valCol}>—</Text>
      ))}
    </View>
  );
}

function DateRow({ label, value }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
      <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: ON_SURFACE }}>{label}</Text>
      <Text style={{ fontSize: 9.5, color: ON_SURFACE_VAR }}>{value}</Text>
    </View>
  );
}

function CashToClose({ rates, fees, loanAmount, propertyValue, quote, daysInterest }) {
  // LE subtotals
  const hardCosts = fees?.sectionD ?? ((fees?.sectionA?.total||0) + (fees?.sectionB?.total||0) + (fees?.sectionC?.total||0));
  const softCosts = fees?.sectionI ?? ((fees?.sectionE?.total||0) + (fees?.sectionF?.total||0) + (fees?.sectionG?.total||0) + (fees?.sectionH?.total||0));

  const lbl = { width: '40%', fontSize: 9.5, color: ON_SURFACE_VAR };
  const lblBold = { width: '40%', fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: ON_SURFACE };
  const v = { width: '20%', textAlign: 'center', fontSize: 10 };
  const vBold = { ...v, fontFamily: 'Helvetica-Bold' };
  const r = { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 8 };
  const rAlt = { ...r, backgroundColor: SURFACE };
  // Accounting lines: single rule = subtotal, double rule = grand total
  const singleRule = { height: 0.75, backgroundColor: ON_SURFACE };
  const doubleRule = { height: 2.5, borderTopWidth: 0.75, borderBottomWidth: 0.75, borderColor: ON_SURFACE, backgroundColor: WHITE, marginTop: 1 };

  return (
    <View style={{ marginTop: 14 }}>
      {/* Title bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: SURFACE_LOW, borderRadius: 6, borderLeftWidth: 3, borderLeftColor: BRAND, paddingVertical: 6, paddingHorizontal: 10, marginBottom: 2 }}>
        <Text style={{ fontSize: 10.5, fontFamily: 'Helvetica-Bold', color: ON_SURFACE }}>Estimated Cash to Close</Text>
      </View>

      {/* Column headers */}
      <View style={rAlt}>
        <Text style={{ width: '40%' }} />
        {rates.map((_, i) => (
          <Text key={i} style={{ width: '20%', textAlign: 'center', fontSize: 7.5, color: OUTLINE, fontFamily: 'Helvetica-Bold' }}>Option {i + 1}</Text>
        ))}
      </View>

      {/* Purchase Price / Appraised Value */}
      <View style={r}>
        <Text style={lbl}>Purchase Price / Appraised Value</Text>
        {rates.map((_, i) => (
          <Text key={i} style={v}>{$int(propertyValue)}</Text>
        ))}
      </View>

      {/* Loan Amount */}
      <View style={rAlt}>
        <Text style={lbl}>Loan Amount</Text>
        {rates.map((_, i) => (
          <Text key={i} style={v}>{$int(loanAmount)}</Text>
        ))}
      </View>

      {/* Down Payment / Payoff */}
      {quote.purpose === 'purchase' ? (
        <View style={r}>
          <Text style={lbl}>Down Payment ({((propertyValue - loanAmount) / propertyValue * 100).toFixed(0)}%)</Text>
          {rates.map((_, i) => (
            <Text key={i} style={v}>{$int(propertyValue - loanAmount)}</Text>
          ))}
        </View>
      ) : (
        <>
          <View style={r}>
            <Text style={lbl}>Loan Payoff (Estimate)</Text>
            {rates.map((_, i) => (
              <Text key={i} style={v}>{$(quote.currentBalance || 0)}</Text>
            ))}
          </View>
          <View style={rAlt}>
            <Text style={lbl}>Loan Amount (Credit)</Text>
            {rates.map((_, i) => (
              <Text key={i} style={{ ...v, color: GREEN }}>({$int(loanAmount)})</Text>
            ))}
          </View>
        </>
      )}

      {/* ── Single rule: subtotal line ── */}
      <View style={{ paddingHorizontal: 8, marginTop: 2, marginBottom: 2 }}>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ width: '40%' }} />
          {rates.map((_, i) => <View key={i} style={{ width: '20%', paddingHorizontal: 4 }}><View style={singleRule} /></View>)}
        </View>
      </View>

      {/* Hard Costs (Section D) */}
      <View style={rAlt}>
        <Text style={lbl}>Loan Costs (D)</Text>
        {rates.map((_, i) => (
          <Text key={i} style={v}>{$(hardCosts)}</Text>
        ))}
      </View>

      {/* Soft Costs (Section I) */}
      <View style={r}>
        <Text style={lbl}>Other Costs (I)</Text>
        {rates.map((_, i) => (
          <Text key={i} style={v}>{$(softCosts)}</Text>
        ))}
      </View>

      {/* Daily Interest — varies per rate */}
      <View style={rAlt}>
        <Text style={lbl}>Daily Interest ({daysInterest} days)</Text>
        {rates.map((rt, i) => {
          const daily = (loanAmount * (rt.rate / 100)) / 365 * daysInterest;
          return <Text key={i} style={v}>{$(daily)}</Text>;
        })}
      </View>

      {/* Lender Credit / (Charge) — varies per rate */}
      <View style={r}>
        <Text style={lbl}>Lender Credit / (Charge)</Text>
        {rates.map((rt, i) => {
          const isCredit = rt.rebateDollars > 0;
          return (
            <Text key={i} style={{ ...v, color: isCredit ? GREEN : RED }}>
              {isCredit ? '(' + $int(rt.rebateDollars) + ')' : $int(rt.discountDollars || 0)}
            </Text>
          );
        })}
      </View>

      {/* Individual credits (seller credit, realtor credit, etc.) */}
      {(fees?.credits || []).filter(c => c.amount > 0).map((c, ci) => (
        <View key={ci} style={ci % 2 === 0 ? rAlt : r}>
          <Text style={lbl}>{c.label}</Text>
          {rates.map((_, i) => (
            <Text key={i} style={{ ...v, color: GREEN }}>({$int(c.amount)})</Text>
          ))}
        </View>
      ))}

      {/* ── Double rule: grand total ── */}
      <View style={{ paddingHorizontal: 8, marginTop: 2 }}>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ width: '40%' }} />
          {rates.map((_, i) => <View key={i} style={{ width: '20%', paddingHorizontal: 4 }}><View style={doubleRule} /></View>)}
        </View>
      </View>

      {/* Total Cash to Close */}
      <View style={r}>
        <Text style={lblBold}>Total Cash To Close</Text>
        {rates.map((rt, i) => {
          const daily = (loanAmount * (rt.rate / 100)) / 365 * daysInterest;
          const totalFees = hardCosts + softCosts + daily;
          const credit = rt.rebateDollars > 0 ? -rt.rebateDollars : (rt.discountDollars || 0);
          const creditTotal = (fees?.credits || []).reduce((sum, c) => sum + (c.amount || 0), 0);
          let cashToClose;
          if (quote.purpose === 'purchase') {
            cashToClose = totalFees + credit - creditTotal + (propertyValue - loanAmount);
          } else {
            cashToClose = totalFees + credit - creditTotal + Number(quote.currentBalance || 0) - loanAmount;
          }
          return <Text key={i} style={vBold}>{$(cashToClose)}</Text>;
        })}
      </View>
    </View>
  );
}
