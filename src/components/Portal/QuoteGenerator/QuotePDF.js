/**
 * QuotePDF — Borrower rate quote matching the RT comparison format.
 *
 * Page 1: 3-rate side-by-side comparison (credit/charge, monthly payment, fees summary, cash to close)
 * Page 2: Detailed fee breakdown (sections A, B, C/E, F/G/H)
 * Page 3: Dates and daily interest
 */

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';

const BRAND = '#0891b2';
const GRAY_BG = '#f3f4f6';
const GRAY_BORDER = '#d1d5db';
const GRAY_500 = '#6b7280';
const GRAY_700 = '#374151';
const GRAY_900 = '#111827';
const GREEN = '#059669';
const RED = '#dc2626';

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 9, color: GRAY_900 },
  // Header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  headerLeft: {},
  headerRight: { textAlign: 'right' },
  companyName: { fontSize: 14, fontFamily: 'Helvetica-Bold' },
  teal: { color: BRAND },
  headerDetail: { fontSize: 8, color: GRAY_500, marginTop: 1 },
  preparedRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: GRAY_BORDER },
  preparedLabel: { fontSize: 10 },
  preparedValue: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  productType: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 8 },
  // Comparison table
  table: { marginBottom: 0 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: GRAY_BORDER },
  rowAlt: { backgroundColor: '#fafafa' },
  rowHeader: { backgroundColor: GRAY_BG },
  rowBold: {},
  rowHighlight: { backgroundColor: '#f0fdf4', borderBottomWidth: 1, borderBottomColor: '#86efac' },
  labelCell: { width: '40%', paddingVertical: 5, paddingHorizontal: 8, fontSize: 9.5 },
  labelCellBold: { width: '40%', paddingVertical: 5, paddingHorizontal: 8, fontSize: 10, fontFamily: 'Helvetica-Bold' },
  valCell: { width: '20%', paddingVertical: 5, paddingHorizontal: 8, textAlign: 'right', fontSize: 10, fontFamily: 'Courier' },
  valCellBold: { width: '20%', paddingVertical: 5, paddingHorizontal: 8, textAlign: 'right', fontSize: 10.5, fontFamily: 'Courier-Bold' },
  sectionHeader: { flexDirection: 'row', backgroundColor: GRAY_900, paddingVertical: 6, paddingHorizontal: 8, marginTop: 10 },
  sectionHeaderText: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: '#ffffff' },
  sectionHeaderVal: { width: '20%', fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#ffffff', textAlign: 'right', paddingHorizontal: 8 },
  greenText: { color: GREEN },
  redText: { color: RED },
  // Page 2 - fees
  feeTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginBottom: 10, marginTop: 4 },
  feeSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: GRAY_BG, paddingVertical: 5, paddingHorizontal: 8, marginTop: 10, borderBottomWidth: 1, borderBottomColor: GRAY_900 },
  feeSectionLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  feeSectionTotal: { fontSize: 10, fontFamily: 'Courier-Bold' },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: GRAY_BORDER },
  feeLabel: { fontSize: 9.5, color: GRAY_700 },
  feeAmount: { fontSize: 9.5, fontFamily: 'Courier' },
  feeTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, paddingHorizontal: 8, borderTopWidth: 1.5, borderTopColor: GRAY_900, marginTop: 6 },
  feeTotalLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold' },
  feeTotalAmount: { fontSize: 11, fontFamily: 'Courier-Bold' },
  // Page 3
  dateRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: GRAY_BORDER },
  dateLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  dateValue: { fontSize: 10, fontFamily: 'Courier' },
  note: { fontSize: 8, color: GRAY_500, lineHeight: 1.5, marginTop: 16, maxWidth: 300 },
  // Footer
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: GRAY_500, borderTopWidth: 0.5, borderTopColor: GRAY_BORDER, paddingTop: 6 },
});

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

export default function QuotePDF({ quote, scenarios, fees, closingDate, fundingDate, firstPaymentDate }) {
  const borrowerName = quote.borrowerName || 'Valued Client';
  const date = new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
  const rates = (scenarios || []).slice(0, 3);
  const loanAmount = Number(quote.loanAmount);
  const propertyValue = Number(quote.propertyValue);
  const ltv = Number(quote.ltv);
  const term = quote.term || 30;

  // Calculate daily interest for each rate
  const closingDay = closingDate ? new Date(closingDate) : null;
  const daysInterest = closingDay ? (new Date(closingDay.getFullYear(), closingDay.getMonth() + 1, 0).getDate() - closingDay.getDate() + 1) : 7;

  // Monthly payment components
  const monthlyTax = fees?.monthlyTax || 0;
  const monthlyIns = fees?.monthlyInsurance || 0;

  return (
    <Document>
      {/* PAGE 1 — Comparison of Three Rates */}
      <Page size="LETTER" style={s.page}>
        {/* Header */}
        <View style={s.headerRow}>
          <View style={s.headerLeft}>
            <Text style={s.companyName}>
              <Text>Net</Text><Text style={s.teal}>Rate</Text><Text> Mortgage</Text>
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica', color: GRAY_500 }}> | David Burson</Text>
            </Text>
            <Text style={s.headerDetail}>357 South McCaslin Blvd., #200, Louisville, CO 80027</Text>
            <Text style={s.headerDetail}>david@netratemortgage.com</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerDetail}>Phone and Text: 303-444-5251</Text>
            <Text style={s.headerDetail}>NMLS #641790 | Company NMLS #1111861</Text>
          </View>
        </View>

        {/* Prepared for + Date */}
        <View style={s.preparedRow}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Text style={s.preparedLabel}>Prepared For: </Text>
            <Text style={s.preparedValue}>{borrowerName}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Text style={s.preparedLabel}>Date Prepared</Text>
            <Text style={s.preparedValue}>{date}</Text>
          </View>
        </View>

        {/* Product type */}
        <Text style={s.productType}>{term} Year {rates[0]?.program?.includes('ARM') ? 'ARM' : 'Fixed'} — {(quote.loanType || 'conventional').toUpperCase()}</Text>

        {/* Comparison of Three Rates */}
        <View style={s.sectionHeader}>
          <Text style={[s.sectionHeaderText, { width: '40%' }]}>Comparison of Three Rates:</Text>
          {rates.map((r, i) => (
            <Text key={i} style={s.sectionHeaderVal}>{pct(r.rate)}</Text>
          ))}
        </View>

        <View style={s.table}>
          {/* Credit/Charge — green = money back to borrower, red = borrower pays */}
          <CompRow label="Lender (Credit) or Charge for Rate as %" values={rates.map(r => {
            const price = r.price || 100;
            if (price > 100) {
              // Credit — borrower gets money back (green, show as negative)
              return { text: '-' + (price - 100).toFixed(3) + '%', color: GREEN };
            }
            // Charge — borrower pays (red, show as positive)
            return { text: (100 - price).toFixed(3) + '%', color: RED };
          })} />
          <CompRow label="Lender (Credit) or Charge for Rate as $" values={rates.map(r => {
            if (r.rebateDollars > 0) return { text: '(' + $int(r.rebateDollars) + ')', color: GREEN };
            return { text: $int(r.discountDollars || 0), color: RED };
          })} alt />
          <CompRow label="Appraised Value" values={rates.map(() => ({ text: $int(propertyValue) }))} />
          <CompRow label="Loan Amount" values={rates.map(() => ({ text: $int(loanAmount) }))} bold />
          <CompRow label="Loan To Value" values={rates.map(() => ({ text: ltv.toFixed(3) + '%' }))} alt />
        </View>

        {/* Monthly Payment */}
        <View style={s.sectionHeader}>
          <Text style={[s.sectionHeaderText, { width: '40%' }]}>Monthly Payment Comparison:</Text>
          {rates.map((r, i) => (
            <Text key={i} style={s.sectionHeaderVal}>{pct(r.rate)}</Text>
          ))}
        </View>
        <View style={s.table}>
          <CompRow label="Principal and Interest" values={rates.map(r => ({ text: $(r.monthlyPI) }))} />
          <CompRow label={`Taxes (${new Date().getFullYear()})`} values={rates.map(() => ({ text: $(monthlyTax) }))} alt />
          <CompRow label="Insurance (est)" values={rates.map(() => ({ text: $(monthlyIns) }))} />
          <CompRow label="PMI" values={rates.map(() => ({ text: '$0.00' }))} alt />
          <CompRow label="Total Payment" values={rates.map(r => ({ text: $(Number(r.monthlyPI || 0) + monthlyTax + monthlyIns) }))} bold highlight />
        </View>

        {/* Fees Summary */}
        <View style={s.sectionHeader}>
          <Text style={[s.sectionHeaderText, { width: '40%' }]}>Fees Information:</Text>
          {rates.map((r, i) => (
            <Text key={i} style={s.sectionHeaderVal}>{pct(r.rate)}</Text>
          ))}
        </View>
        <View style={s.table}>
          <CompRow label="Lender Fees and Loan Fees (A+B)" values={rates.map(() => ({ text: $((fees?.sectionA?.total || 0) + (fees?.sectionB?.total || 0)) }))} />
          <CompRow label="Title Fees and Recording Fees (C)" values={rates.map(() => ({ text: $((fees?.sectionC?.total || 0) + (fees?.sectionE?.total || 0)) }))} alt />
          <CompRow label="Prepaids, Escrow, and Other (F+G+H)" values={rates.map(() => ({ text: $((fees?.sectionF?.total || 0) + (fees?.sectionG?.total || 0)) }))} />
          <CompRow label="Daily Interest" values={rates.map(r => {
            const daily = (loanAmount * (r.rate / 100)) / 365 * daysInterest;
            return { text: $(daily) };
          })} alt />
          <CompRow label="Total of All Loan Costs" values={rates.map(r => {
            const daily = (loanAmount * (r.rate / 100)) / 365 * daysInterest;
            return { text: $((fees?.totalClosingCosts || 0) + daily) };
          })} bold />
        </View>

        {/* Cash to Close */}
        <View style={s.sectionHeader}>
          <Text style={[s.sectionHeaderText, { width: '40%' }]}>Total Cash to Close (for each rate):</Text>
          {rates.map((r, i) => (
            <Text key={i} style={s.sectionHeaderVal}>{pct(r.rate)}</Text>
          ))}
        </View>
        <View style={s.table}>
          <CompRow label="Total of All Loan Charges" values={rates.map(r => {
            const daily = (loanAmount * (r.rate / 100)) / 365 * daysInterest;
            return { text: $((fees?.totalClosingCosts || 0) + daily) };
          })} />
          <CompRow label="Lender (Credit) or Charge" values={rates.map(r => {
            if (r.rebateDollars > 0) return { text: '(' + $int(r.rebateDollars) + ')', color: GREEN };
            return { text: $int(r.discountDollars || 0), color: RED };
          })} alt />
          {quote.purpose !== 'purchase' && (
            <CompRow label="Loan Payoff (Estimate)" values={rates.map(() => ({ text: $(quote.currentBalance || 0) }))} />
          )}
          {quote.purpose !== 'purchase' && (
            <CompRow label="Loan Amount (Calculated as a Credit)" values={rates.map(() => ({ text: $(-loanAmount) }))} alt />
          )}
          {quote.purpose === 'purchase' && (
            <CompRow label="Down Payment" values={rates.map(() => ({ text: $(propertyValue - loanAmount) }))} />
          )}
          <CompRow label={quote.purpose === 'purchase' ? 'Total Cash to Close' : 'Total Cash to Close or (Cash Back to You)'} values={rates.map(r => {
            const daily = (loanAmount * (r.rate / 100)) / 365 * daysInterest;
            const totalFees = (fees?.totalClosingCosts || 0) + daily;
            const credit = r.rebateDollars > 0 ? -r.rebateDollars : (r.discountDollars || 0);
            if (quote.purpose === 'purchase') {
              return { text: $(totalFees + credit + (propertyValue - loanAmount)) };
            }
            const payoff = Number(quote.currentBalance || 0);
            return { text: $(totalFees + credit + payoff - loanAmount) };
          })} bold highlight />
        </View>

        <View style={s.footer} fixed>
          <Text>NetRate Mortgage LLC | NMLS #1111861 | Equal Housing Lender</Text>
          <Text>357 S McCaslin Blvd #200, Louisville, CO 80027</Text>
        </View>
      </Page>

      {/* PAGE 2 — Detailed Fee Breakdown */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.feeTitle}>Loan Costs (These fields match the Loan Estimate Form Page 2 A-J)</Text>

        {['sectionA', 'sectionB', 'sectionC', 'sectionE', 'sectionF', 'sectionG'].map(key => {
          const section = fees?.[key];
          if (!section) return null;
          return (
            <View key={key}>
              <View style={s.feeSectionHeader}>
                <Text style={s.feeSectionLabel}>{section.label}</Text>
                <Text style={s.feeSectionTotal}>{$(section.total)}</Text>
              </View>
              {(section.items || []).map((item, i) => (
                <View key={i} style={s.feeRow}>
                  <Text style={s.feeLabel}>{item.label}</Text>
                  <Text style={s.feeAmount}>{$(item.amount)}</Text>
                </View>
              ))}
            </View>
          );
        })}

        <View style={s.feeTotalRow}>
          <Text style={s.feeTotalLabel}>Total of all charges A, B, C, E, F, G, H</Text>
          <Text style={s.feeTotalAmount}>{$(fees?.totalClosingCosts)}</Text>
        </View>

        <View style={s.footer} fixed>
          <Text>NetRate Mortgage LLC | NMLS #1111861 | Equal Housing Lender</Text>
          <Text>357 S McCaslin Blvd #200, Louisville, CO 80027</Text>
        </View>
      </Page>

      {/* PAGE 3 — Dates and Daily Interest */}
      <Page size="LETTER" style={s.page}>
        <View style={s.feeSectionHeader}>
          <Text style={s.feeSectionLabel}>Dates for Escrow and Daily Interest</Text>
          <Text style={s.feeSectionTotal}></Text>
        </View>
        <View style={s.dateRow}>
          <Text style={s.dateLabel}>Closing Date</Text>
          <Text style={s.dateValue}>{closingDate || 'TBD'}</Text>
        </View>
        <View style={s.dateRow}>
          <Text style={s.dateLabel}>Funding Date</Text>
          <Text style={s.dateValue}>{fundingDate || 'TBD'}</Text>
        </View>
        <View style={s.dateRow}>
          <Text style={s.dateLabel}>First Payment Date</Text>
          <Text style={s.dateValue}>{firstPaymentDate || 'TBD'}</Text>
        </View>
        <View style={s.dateRow}>
          <Text style={s.dateLabel}>Days Interest</Text>
          <Text style={s.dateValue}>{daysInterest}</Text>
        </View>

        <Text style={s.note}>
          {"Daily interest charges are calculated based on the loan\u2019s interest rate and the number of days between the loan\u2019s closing date and the last day of the month. This ensures the lender collects interest for the time the loan is active before the first regular payment is due."}
        </Text>

        <Text style={[s.note, { marginTop: 24, fontSize: 7 }]}>
          This quote is an estimate based on current wholesale pricing. Actual rates, fees, and terms may vary based on full credit review, property appraisal, and underwriting. This is not a commitment to lend. Rate locks are subject to lender availability. Rates may change without notice.
        </Text>

        <View style={s.footer} fixed>
          <Text>NetRate Mortgage LLC | NMLS #1111861 | Equal Housing Lender</Text>
          <Text>357 S McCaslin Blvd #200, Louisville, CO 80027</Text>
        </View>
      </Page>
    </Document>
  );
}

function CompRow({ label, values, bold, alt, highlight }) {
  const rowStyle = [s.row, alt && s.rowAlt, highlight && s.rowHighlight];
  return (
    <View style={rowStyle}>
      <Text style={bold ? s.labelCellBold : s.labelCell}>{label}</Text>
      {values.map((v, i) => (
        <Text key={i} style={[bold ? s.valCellBold : s.valCell, v.color === GREEN && s.greenText, v.color === RED && s.redText]}>
          {v.text}
        </Text>
      ))}
      {/* Pad if fewer than 3 rates */}
      {values.length < 3 && Array.from({ length: 3 - values.length }).map((_, i) => (
        <Text key={`pad${i}`} style={s.valCell}>—</Text>
      ))}
    </View>
  );
}
