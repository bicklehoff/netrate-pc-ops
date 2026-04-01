/**
 * QuotePDF — Server-renderable PDF for borrower rate quotes.
 *
 * Uses @react-pdf/renderer. Works both client-side (pdf().toBlob()) and
 * server-side (renderToBuffer()) for email attachments.
 */

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';

const BRAND = '#0891b2';
const GRAY_50 = '#f9fafb';
const GRAY_200 = '#e5e7eb';
const GRAY_500 = '#6b7280';
const GRAY_700 = '#374151';
const GRAY_900 = '#111827';
const GREEN = '#059669';
const RED = '#dc2626';

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 9, color: GRAY_900 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: BRAND },
  brandName: { fontSize: 18, fontFamily: 'Helvetica-Bold' },
  brandTeal: { color: BRAND },
  headerRight: { textAlign: 'right', fontSize: 8, color: GRAY_500 },
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: GRAY_900, marginBottom: 8, marginTop: 16 },
  scenarioBox: { flexDirection: 'row', backgroundColor: GRAY_50, borderRadius: 6, padding: 10, marginBottom: 12, gap: 20 },
  scenarioItem: { flex: 1 },
  scenarioLabel: { fontSize: 7, color: GRAY_500, textTransform: 'uppercase', marginBottom: 2 },
  scenarioValue: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  table: { marginBottom: 12 },
  tableHeader: { flexDirection: 'row', backgroundColor: GRAY_900, borderRadius: 4, paddingVertical: 6, paddingHorizontal: 8, marginBottom: 2 },
  tableHeaderText: { color: '#ffffff', fontSize: 8, fontFamily: 'Helvetica-Bold' },
  tableRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: GRAY_200 },
  tableRowAlt: { backgroundColor: GRAY_50 },
  cell: { fontSize: 9 },
  cellBold: { fontSize: 9, fontFamily: 'Helvetica-Bold' },
  cellMono: { fontSize: 9, fontFamily: 'Courier' },
  cellRight: { textAlign: 'right' },
  green: { color: GREEN },
  red: { color: RED },
  feeSection: { marginBottom: 8 },
  feeSectionTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: GRAY_700, marginBottom: 4, backgroundColor: GRAY_50, padding: 4, borderRadius: 3 },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2, paddingHorizontal: 4 },
  feeLabel: { fontSize: 8, color: GRAY_700 },
  feeAmount: { fontSize: 8, fontFamily: 'Courier' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, paddingHorizontal: 4, borderTopWidth: 1.5, borderTopColor: GRAY_900, marginTop: 4 },
  totalLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  totalAmount: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  summaryBox: { backgroundColor: GRAY_900, borderRadius: 6, padding: 12, marginTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  summaryItem: {},
  summaryLabel: { fontSize: 7, color: '#9ca3af', textTransform: 'uppercase' },
  summaryValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#ffffff', marginTop: 2 },
  disclaimer: { marginTop: 20, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: GRAY_200, fontSize: 7, color: GRAY_500, lineHeight: 1.5 },
  footer: { position: 'absolute', bottom: 30, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: GRAY_500 },
});

function fmt(n) {
  if (n == null) return '$0';
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export default function QuotePDF({ quote, scenarios, fees }) {
  const borrowerName = quote.borrowerName || 'Valued Client';
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.brandName}>
              <Text>Net</Text>
              <Text style={s.brandTeal}>Rate</Text>
              <Text> Mortgage</Text>
            </Text>
            <Text style={{ fontSize: 8, color: GRAY_500, marginTop: 2 }}>Your Personalized Rate Quote</Text>
          </View>
          <View style={s.headerRight}>
            <Text>Prepared for {borrowerName}</Text>
            <Text>{date}</Text>
            <Text>David Burson | NMLS #641790</Text>
            <Text>303-444-5251 | david@netratemortgage.com</Text>
          </View>
        </View>

        {/* Scenario Summary */}
        <View style={s.scenarioBox}>
          <View style={s.scenarioItem}>
            <Text style={s.scenarioLabel}>Purpose</Text>
            <Text style={s.scenarioValue}>{quote.purpose}</Text>
          </View>
          <View style={s.scenarioItem}>
            <Text style={s.scenarioLabel}>Loan Amount</Text>
            <Text style={s.scenarioValue}>{fmt(quote.loanAmount)}</Text>
          </View>
          <View style={s.scenarioItem}>
            <Text style={s.scenarioLabel}>Property Value</Text>
            <Text style={s.scenarioValue}>{fmt(quote.propertyValue)}</Text>
          </View>
          <View style={s.scenarioItem}>
            <Text style={s.scenarioLabel}>LTV</Text>
            <Text style={s.scenarioValue}>{Number(quote.ltv)}%</Text>
          </View>
          <View style={s.scenarioItem}>
            <Text style={s.scenarioLabel}>Credit Score</Text>
            <Text style={s.scenarioValue}>{quote.fico}</Text>
          </View>
          <View style={s.scenarioItem}>
            <Text style={s.scenarioLabel}>Loan Type</Text>
            <Text style={s.scenarioValue}>{(quote.loanType || 'conventional').toUpperCase()}</Text>
          </View>
        </View>

        {/* Rate Comparison Table */}
        <Text style={s.sectionTitle}>Rate Options</Text>
        <View style={s.table}>
          <View style={s.tableHeader}>
            <Text style={[s.tableHeaderText, { width: '15%' }]}>Rate</Text>
            <Text style={[s.tableHeaderText, { width: '30%' }]}>Program</Text>
            <Text style={[s.tableHeaderText, { width: '15%', textAlign: 'right' }]}>Price</Text>
            <Text style={[s.tableHeaderText, { width: '20%', textAlign: 'right' }]}>Credit/Cost</Text>
            <Text style={[s.tableHeaderText, { width: '20%', textAlign: 'right' }]}>Monthly P&I</Text>
          </View>
          {(scenarios || []).map((r, i) => (
            <View key={i} style={[s.tableRow, i % 2 === 1 && s.tableRowAlt]}>
              <Text style={[s.cellBold, { width: '15%' }]}>{r.rate?.toFixed(3)}%</Text>
              <Text style={[s.cell, { width: '30%' }]}>{r.program}</Text>
              <Text style={[s.cellMono, s.cellRight, { width: '15%' }]}>{r.price?.toFixed(4)}</Text>
              <Text style={[s.cellMono, s.cellRight, { width: '20%' }, r.rebateDollars > 0 ? s.green : s.red]}>
                {r.rebateDollars > 0 ? `+${fmt(r.rebateDollars)}` : `-${fmt(r.discountDollars)}`}
              </Text>
              <Text style={[s.cellMono, s.cellRight, { width: '20%' }]}>{fmt(r.monthlyPI)}/mo</Text>
            </View>
          ))}
        </View>

        {/* Fee Breakdown */}
        {fees && (
          <>
            <Text style={s.sectionTitle}>Estimated Closing Costs</Text>
            {['sectionA', 'sectionB', 'sectionC', 'sectionE', 'sectionF', 'sectionG'].map(key => {
              const section = fees[key];
              if (!section || section.items.length === 0) return null;
              return (
                <View key={key} style={s.feeSection}>
                  <Text style={s.feeSectionTitle}>{section.label} — {fmt(section.total)}</Text>
                  {section.items.map((item, i) => (
                    <View key={i} style={s.feeRow}>
                      <Text style={s.feeLabel}>{item.label}</Text>
                      <Text style={s.feeAmount}>{fmt(item.amount)}</Text>
                    </View>
                  ))}
                </View>
              );
            })}
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Total Estimated Closing Costs</Text>
              <Text style={s.totalAmount}>{fmt(fees.totalClosingCosts)}</Text>
            </View>
          </>
        )}

        {/* Monthly Payment Summary */}
        {scenarios?.[0] && (
          <View style={s.summaryBox}>
            <View style={s.summaryItem}>
              <Text style={s.summaryLabel}>Rate</Text>
              <Text style={s.summaryValue}>{scenarios[0].rate?.toFixed(3)}%</Text>
            </View>
            <View style={s.summaryItem}>
              <Text style={s.summaryLabel}>Monthly P&I</Text>
              <Text style={s.summaryValue}>{fmt(scenarios[0].monthlyPI)}</Text>
            </View>
            <View style={s.summaryItem}>
              <Text style={s.summaryLabel}>Closing Costs</Text>
              <Text style={s.summaryValue}>{fmt(fees?.totalClosingCosts)}</Text>
            </View>
            <View style={s.summaryItem}>
              <Text style={s.summaryLabel}>Loan Amount</Text>
              <Text style={s.summaryValue}>{fmt(quote.loanAmount)}</Text>
            </View>
          </View>
        )}

        {/* Disclaimer */}
        <View style={s.disclaimer}>
          <Text>This quote is an estimate based on the information provided and current wholesale pricing. Actual rates, fees, and terms may vary based on full credit review, property appraisal, and underwriting. This is not a commitment to lend or a loan approval. Rate locks are subject to lender availability. Rates may change without notice. Contact your loan officer for the most current rates and to discuss your specific situation.</Text>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text>NetRate Mortgage LLC | NMLS #1111861 | Equal Housing Lender</Text>
          <Text>357 S McCaslin Blvd #200, Louisville, CO 80027</Text>
        </View>
      </Page>
    </Document>
  );
}
