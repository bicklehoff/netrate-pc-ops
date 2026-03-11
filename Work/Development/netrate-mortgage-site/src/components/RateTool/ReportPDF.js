// ReportPDF.js — @react-pdf/renderer PDF document mirroring ComparisonReport.
// Generates a professional vector PDF for download.
// Uses react-pdf primitives (Document, Page, View, Text) — NO HTML/CSS.

import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
} from '@react-pdf/renderer';

import { PURPOSE_LABELS, PROP_LABELS, fmtDollar, fmtPI } from './reportUtils';

// ---------- Styles ----------

const BRAND = '#0891b2';
const BRAND_LIGHT = '#ecfeff';
const GRAY_50 = '#f9fafb';
const GRAY_100 = '#f3f4f6';
const GRAY_200 = '#e5e7eb';
const GRAY_300 = '#d1d5db';
const GRAY_400 = '#9ca3af';
const GRAY_500 = '#6b7280';
const GRAY_600 = '#4b5563';
const GRAY_700 = '#374151';
const GRAY_800 = '#1f2937';
const GREEN_700 = '#15803d';
const RED_600 = '#dc2626';

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: 'Helvetica', color: GRAY_800 },
  // Header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  companyName: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: BRAND },
  nmls: { fontSize: 8, color: GRAY_500, marginTop: 2 },
  contactLine: { fontSize: 7, color: GRAY_400, marginTop: 2 },
  dateBlock: { alignItems: 'flex-end' },
  dateLine: { fontSize: 8, color: GRAY_500 },
  dateSubline: { fontSize: 7, color: GRAY_400, marginTop: 1 },
  // Title bar
  titleBar: { borderTopWidth: 2, borderTopColor: BRAND, paddingTop: 8, marginBottom: 14 },
  titleText: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: GRAY_800 },
  titleSub: { fontSize: 8, color: GRAY_500, marginTop: 3 },
  titleSub2: { fontSize: 7, color: GRAY_400, marginTop: 1 },
  // Scenario box
  scenarioBox: { backgroundColor: GRAY_50, borderRadius: 4, padding: 10, marginBottom: 14 },
  scenarioTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: GRAY_700, marginBottom: 6 },
  scenarioGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  scenarioItem: { width: '33%', marginBottom: 3 },
  scenarioLabel: { fontSize: 7, color: GRAY_500 },
  scenarioValue: { fontSize: 8, color: GRAY_800 },
  scenarioValueBold: { fontSize: 8, color: GRAY_800, fontFamily: 'Helvetica-Bold' },
  // Tables
  table: { borderWidth: 1, borderColor: GRAY_300, marginBottom: 14 },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: BRAND_LIGHT },
  tableHeaderCell: { paddingVertical: 6, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: GRAY_300 },
  tableHeaderText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: GRAY_700 },
  tableHeaderRate: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: BRAND, textAlign: 'right' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: GRAY_200 },
  tableRowAlt: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: GRAY_200, backgroundColor: GRAY_50 },
  tableRowLast: { flexDirection: 'row' },
  tableSectionRow: { flexDirection: 'row', backgroundColor: GRAY_50, borderTopWidth: 1, borderTopColor: GRAY_300 },
  tableSectionText: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: GRAY_700, textTransform: 'uppercase', letterSpacing: 0.5 },
  tableCell: { paddingVertical: 5, paddingHorizontal: 8 },
  tableCellText: { fontSize: 8, color: GRAY_600 },
  tableCellMono: { fontSize: 8, fontFamily: 'Courier', textAlign: 'right' },
  tableCellBold: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: GRAY_800 },
  tableCellMonoBold: { fontSize: 8, fontFamily: 'Courier-Bold', textAlign: 'right' },
  // Payback highlight
  paybackRow: { flexDirection: 'row', backgroundColor: BRAND_LIGHT },
  paybackLabel: { fontSize: 7, color: GRAY_700, fontFamily: 'Helvetica-Bold' },
  paybackValue: { fontSize: 9, fontFamily: 'Courier-Bold', color: BRAND, textAlign: 'right' },
  // LLPA table
  llpaRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: GRAY_100 },
  llpaLabel: { fontSize: 7, color: GRAY_600 },
  llpaTotalRow: { flexDirection: 'row', backgroundColor: GRAY_50 },
  llpaTotalLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: GRAY_700 },
  // Section title
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: GRAY_800, marginBottom: 8 },
  // Footer / Disclaimer
  disclaimer: { marginTop: 16, borderTopWidth: 1, borderTopColor: GRAY_300, paddingTop: 8 },
  disclaimerText: { fontSize: 6.5, color: GRAY_500, lineHeight: 1.4, marginBottom: 3 },
  // Footnote
  footnote: { fontSize: 7, color: GRAY_400, marginTop: 4 },
  // No cost badge
  noCostBadge: { fontSize: 6, color: GREEN_700, marginTop: 2, textAlign: 'right' },
  // Green / red text
  green: { color: GREEN_700 },
  red: { color: RED_600 },
});

// Helper: compute column widths based on rate count
function getColWidths(rateCount) {
  const labelWidth = rateCount === 1 ? '60%' : rateCount === 2 ? '50%' : '40%';
  const dataWidth = rateCount === 1 ? '40%' : rateCount === 2 ? '25%' : '20%';
  return { labelWidth, dataWidth };
}

// ---------- Component ----------

export default function ReportPDF({ compareRates, scenario, rateData, llpa }) {
  const lenderFees = rateData.lender.lenderFees;
  const thirdPartyCosts = scenario.thirdPartyCosts || 0;
  const currentPI = scenario.currentRate
    ? (() => {
        const r = scenario.currentRate / 100 / 12;
        const n = 360;
        return scenario.loanAmount * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
      })()
    : null;
  const isRefi = scenario.purpose !== 'purchase';
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const ratesToShow = [...compareRates].sort((a, b) => a.rate - b.rate);
  const { labelWidth, dataWidth } = getColWidths(ratesToShow.length);

  return (
    <Document title="Rate Comparison Report — NetRate Mortgage" author="NetRate Mortgage">
      <Page size="LETTER" style={s.page}>

        {/* ===== HEADER ===== */}
        <View style={s.headerRow}>
          <View>
            <Text style={s.companyName}>{rateData.lender?.displayName || 'NetRate Mortgage'}</Text>
            <Text style={s.nmls}>NMLS #641790 | 1111861</Text>
            <Text style={s.contactLine}>357 South McCaslin Blvd., #200, Louisville, CO 80027 | 303-444-5251</Text>
          </View>
          <View style={s.dateBlock}>
            <Text style={s.dateLine}>{today}</Text>
            <Text style={s.dateSubline}>Rates effective {rateData.lender.effectiveDate}</Text>
          </View>
        </View>

        {/* ===== TITLE BAR ===== */}
        <View style={s.titleBar}>
          <Text style={s.titleText}>
            {isRefi ? 'Savings and Pay-Back Period for Refinance' : 'Rate Comparison Report'}
          </Text>
          <Text style={s.titleSub}>Prepared by David Burson | {today}</Text>
          <Text style={s.titleSub2}>30 Year Fixed | Effective rates as of {rateData.lender.effectiveDate}</Text>
        </View>

        {/* ===== SCENARIO SUMMARY ===== */}
        <View style={s.scenarioBox}>
          <Text style={s.scenarioTitle}>Your Scenario</Text>
          <View style={s.scenarioGrid}>
            <View style={s.scenarioItem}>
              <Text style={s.scenarioLabel}>Purpose</Text>
              <Text style={s.scenarioValue}>{PURPOSE_LABELS[scenario.purpose]}</Text>
            </View>
            <View style={s.scenarioItem}>
              <Text style={s.scenarioLabel}>Property</Text>
              <Text style={s.scenarioValue}>{fmtDollar(scenario.propertyValue)} | {PROP_LABELS[scenario.propertyType]}</Text>
            </View>
            <View style={s.scenarioItem}>
              <Text style={s.scenarioLabel}>Loan Amount</Text>
              <Text style={s.scenarioValueBold}>{fmtDollar(scenario.loanAmount)}</Text>
            </View>
            <View style={s.scenarioItem}>
              <Text style={s.scenarioLabel}>LTV</Text>
              <Text style={s.scenarioValue}>{scenario.ltv?.toFixed(1)}%</Text>
            </View>
            <View style={s.scenarioItem}>
              <Text style={s.scenarioLabel}>Credit Score</Text>
              <Text style={s.scenarioValue}>{scenario.fico}+</Text>
            </View>
            <View style={s.scenarioItem}>
              <Text style={s.scenarioLabel}>State</Text>
              <Text style={s.scenarioValue}>{scenario.state}</Text>
            </View>
            {currentPI && (
              <View style={s.scenarioItem}>
                <Text style={s.scenarioLabel}>Current Rate</Text>
                <Text style={s.scenarioValueBold}>{scenario.currentRate}%</Text>
              </View>
            )}
            {currentPI && (
              <View style={s.scenarioItem}>
                <Text style={s.scenarioLabel}>Current P&I</Text>
                <Text style={s.scenarioValue}>{fmtPI(currentPI)}</Text>
              </View>
            )}
          </View>
        </View>

        {/* ===== SECTION 1: SAVINGS & PAY-BACK (REFI ONLY) ===== */}
        {isRefi && currentPI && (
          <View style={s.table}>
            {/* Header row */}
            <View style={s.tableHeaderRow}>
              <View style={[s.tableHeaderCell, { width: labelWidth }]}>
                <Text style={s.tableHeaderText}>Refinance Savings</Text>
              </View>
              {ratesToShow.map(r => (
                <View key={r.rate} style={[s.tableHeaderCell, { width: dataWidth }]}>
                  <Text style={s.tableHeaderRate}>{r.rate.toFixed(3)}%</Text>
                </View>
              ))}
            </View>

            {/* New P&I */}
            <View style={s.tableRow}>
              <View style={[s.tableCell, { width: labelWidth }]}>
                <Text style={s.tableCellText}>New Principal and Interest Payment</Text>
              </View>
              {ratesToShow.map(r => (
                <View key={r.rate} style={[s.tableCell, { width: dataWidth }]}>
                  <Text style={s.tableCellMono}>{fmtPI(r.monthlyPI)}</Text>
                </View>
              ))}
            </View>

            {/* Monthly Savings */}
            <View style={s.tableRowAlt}>
              <View style={[s.tableCell, { width: labelWidth }]}>
                <Text style={s.tableCellBold}>Monthly Savings</Text>
              </View>
              {ratesToShow.map(r => {
                const sav = currentPI - r.monthlyPI;
                return (
                  <View key={r.rate} style={[s.tableCell, { width: dataWidth }]}>
                    <Text style={[s.tableCellMonoBold, sav > 0 ? s.green : { color: GRAY_400 }]}>
                      {sav > 0 ? fmtDollar(Math.round(sav)) : '—'}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Annual Savings */}
            <View style={s.tableRowAlt}>
              <View style={[s.tableCell, { width: labelWidth }]}>
                <Text style={s.tableCellBold}>Annual Savings</Text>
              </View>
              {ratesToShow.map(r => {
                const sav = currentPI - r.monthlyPI;
                return (
                  <View key={r.rate} style={[s.tableCell, { width: dataWidth }]}>
                    <Text style={[s.tableCellMonoBold, sav > 0 ? s.green : { color: GRAY_400 }]}>
                      {sav > 0 ? fmtDollar(Math.round(sav * 12)) : '—'}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Cost section header */}
            <View style={s.tableHeaderRow}>
              <View style={[s.tableHeaderCell, { width: labelWidth }]}>
                <Text style={s.tableHeaderText}>Refinance Costs</Text>
              </View>
              {ratesToShow.map(r => (
                <View key={r.rate} style={[s.tableHeaderCell, { width: dataWidth }]}>
                  <Text style={s.tableHeaderRate}>{r.rate.toFixed(3)}%</Text>
                </View>
              ))}
            </View>

            {/* Loan Costs */}
            <View style={s.tableRow}>
              <View style={[s.tableCell, { width: labelWidth }]}>
                <Text style={s.tableCellText}>Loan Costs (excl. escrows & daily interest)</Text>
              </View>
              {ratesToShow.map(r => (
                <View key={r.rate} style={[s.tableCell, { width: dataWidth }]}>
                  <Text style={s.tableCellMono}>{fmtDollar(lenderFees + thirdPartyCosts)}</Text>
                </View>
              ))}
            </View>

            {/* Credit or Charge */}
            <View style={s.tableRow}>
              <View style={[s.tableCell, { width: labelWidth }]}>
                <Text style={s.tableCellText}>(Credit) or Charge for Rate</Text>
              </View>
              {ratesToShow.map(r => {
                const isCredit = r.creditDollars < 0;
                return (
                  <View key={r.rate} style={[s.tableCell, { width: dataWidth }]}>
                    <Text style={[s.tableCellMono, isCredit ? s.green : s.red]}>
                      {isCredit ? `(${fmtDollar(Math.abs(r.creditDollars))})` : fmtDollar(r.creditDollars)}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Total Loan Costs */}
            <View style={s.tableRowAlt}>
              <View style={[s.tableCell, { width: labelWidth }]}>
                <Text style={s.tableCellBold}>Total Loan Costs*</Text>
              </View>
              {ratesToShow.map(r => {
                const total = lenderFees + thirdPartyCosts + r.creditDollars;
                return (
                  <View key={r.rate} style={[s.tableCell, { width: dataWidth }]}>
                    <Text style={s.tableCellMonoBold}>{fmtDollar(total)}</Text>
                  </View>
                );
              })}
            </View>

            {/* Pay-back Months */}
            <View style={s.paybackRow}>
              <View style={[s.tableCell, { width: labelWidth }]}>
                <Text style={s.paybackLabel}>Pay Back Period in Months</Text>
              </View>
              {ratesToShow.map(r => {
                const sav = currentPI - r.monthlyPI;
                const total = lenderFees + thirdPartyCosts + r.creditDollars;
                const months = sav > 0 ? total / sav : null;
                return (
                  <View key={r.rate} style={[s.tableCell, { width: dataWidth }]}>
                    <Text style={s.paybackValue}>
                      {months !== null && months > 0 ? months.toFixed(1) : months !== null && months <= 0 ? 'Instant' : '—'}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Pay-back Years */}
            <View style={s.paybackRow}>
              <View style={[s.tableCell, { width: labelWidth }]}>
                <Text style={{ fontSize: 7, color: GRAY_600 }}>Pay Back Period in Years</Text>
              </View>
              {ratesToShow.map(r => {
                const sav = currentPI - r.monthlyPI;
                const total = lenderFees + thirdPartyCosts + r.creditDollars;
                const months = sav > 0 ? total / sav : null;
                return (
                  <View key={r.rate} style={[s.tableCell, { width: dataWidth }]}>
                    <Text style={[s.paybackValue, { fontSize: 8 }]}>
                      {months !== null && months > 0 ? (months / 12).toFixed(2) : months !== null && months <= 0 ? 'Instant' : '—'}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Cost footnote */}
        {isRefi && currentPI && (
          <Text style={s.footnote}>
            *Loan costs do not include new escrow payments (taxes/insurance), daily interest on the new loan, or interest added to your current payoff. You will defer one mortgage payment and receive your escrow refund from your current lender within 30 days of closing.
          </Text>
        )}

        {/* ===== SECTION 2: RATE COMPARISON ===== */}
        <View style={{ marginTop: isRefi && currentPI ? 14 : 0 }}>
          <Text style={s.sectionTitle}>
            Comparison of {ratesToShow.length === 1 ? 'Selected' : ratesToShow.length} Rate{ratesToShow.length > 1 ? 's' : ''}
          </Text>
          <View style={s.table}>
            {/* Header */}
            <View style={[s.tableHeaderRow, { backgroundColor: GRAY_50 }]}>
              <View style={[s.tableHeaderCell, { width: labelWidth }]}>
                <Text style={s.tableHeaderText}> </Text>
              </View>
              {ratesToShow.map(r => {
                const total = lenderFees + thirdPartyCosts + r.creditDollars;
                const noCost = total <= 0;
                return (
                  <View key={r.rate} style={[s.tableHeaderCell, { width: dataWidth }]}>
                    <Text style={s.tableHeaderRate}>{r.rate.toFixed(3)}%</Text>
                    {noCost && <Text style={s.noCostBadge}>NO COST OPTION</Text>}
                  </View>
                );
              })}
            </View>

            {/* Credit/Charge % */}
            <View style={s.tableRow}>
              <View style={[s.tableCell, { width: labelWidth }]}>
                <Text style={s.tableCellText}>Lender (Credit) or Charge as %</Text>
              </View>
              {ratesToShow.map(r => (
                <View key={r.rate} style={[s.tableCell, { width: dataWidth }]}>
                  <Text style={[s.tableCellMono, r.adjPrice < 0 ? s.green : s.red]}>
                    {r.adjPrice < 0 ? '-' : ''}{Math.abs(r.adjPrice).toFixed(3)}%
                  </Text>
                </View>
              ))}
            </View>

            {/* Credit/Charge $ */}
            <View style={s.tableRow}>
              <View style={[s.tableCell, { width: labelWidth }]}>
                <Text style={s.tableCellText}>Lender (Credit) or Charge as $</Text>
              </View>
              {ratesToShow.map(r => {
                const isCredit = r.creditDollars < 0;
                return (
                  <View key={r.rate} style={[s.tableCell, { width: dataWidth }]}>
                    <Text style={[s.tableCellMono, isCredit ? s.green : s.red]}>
                      {isCredit ? `(${fmtDollar(Math.abs(r.creditDollars))})` : fmtDollar(r.creditDollars)}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Loan Amount */}
            <View style={s.tableRow}>
              <View style={[s.tableCell, { width: labelWidth }]}>
                <Text style={{ fontSize: 7, color: GRAY_400 }}>Loan Amount</Text>
              </View>
              {ratesToShow.map(r => (
                <View key={r.rate} style={[s.tableCell, { width: dataWidth }]}>
                  <Text style={[s.tableCellMono, { fontFamily: 'Helvetica-Bold', color: GRAY_600 }]}>{fmtDollar(scenario.loanAmount)}</Text>
                </View>
              ))}
            </View>

            {/* LTV */}
            <View style={s.tableRow}>
              <View style={[s.tableCell, { width: labelWidth }]}>
                <Text style={{ fontSize: 7, color: GRAY_400 }}>Loan to Value</Text>
              </View>
              {ratesToShow.map(r => (
                <View key={r.rate} style={[s.tableCell, { width: dataWidth }]}>
                  <Text style={[s.tableCellMono, { color: GRAY_500 }]}>{scenario.ltv?.toFixed(1)}%</Text>
                </View>
              ))}
            </View>

            {/* P&I Section */}
            <View style={s.tableSectionRow}>
              <View style={[s.tableCell, { width: '100%' }]}>
                <Text style={s.tableSectionText}>Monthly Payment Comparison</Text>
              </View>
            </View>
            <View style={s.tableRow}>
              <View style={[s.tableCell, { width: labelWidth }]}>
                <Text style={s.tableCellText}>Principal and Interest</Text>
              </View>
              {ratesToShow.map(r => (
                <View key={r.rate} style={[s.tableCell, { width: dataWidth }]}>
                  <Text style={s.tableCellMono}>{fmtPI(r.monthlyPI)}</Text>
                </View>
              ))}
            </View>

            {/* Fees Section */}
            <View style={s.tableSectionRow}>
              <View style={[s.tableCell, { width: '100%' }]}>
                <Text style={s.tableSectionText}>Fees Information</Text>
              </View>
            </View>
            <View style={s.tableRow}>
              <View style={[s.tableCell, { width: labelWidth }]}>
                <Text style={s.tableCellText}>Lender Fees</Text>
              </View>
              {ratesToShow.map(r => (
                <View key={r.rate} style={[s.tableCell, { width: dataWidth }]}>
                  <Text style={s.tableCellMono}>{fmtDollar(lenderFees)}</Text>
                </View>
              ))}
            </View>
            <View style={s.tableRow}>
              <View style={[s.tableCell, { width: labelWidth }]}>
                <Text style={s.tableCellText}>Est. Third-Party Fees ({scenario.state})</Text>
              </View>
              {ratesToShow.map(r => (
                <View key={r.rate} style={[s.tableCell, { width: dataWidth }]}>
                  <Text style={s.tableCellMono}>{fmtDollar(thirdPartyCosts)}</Text>
                </View>
              ))}
            </View>
            <View style={s.tableRowAlt}>
              <View style={[s.tableCell, { width: labelWidth }]}>
                <Text style={s.tableCellBold}>Total Estimated Closing Costs</Text>
              </View>
              {ratesToShow.map(r => {
                const total = lenderFees + thirdPartyCosts + r.creditDollars;
                return (
                  <View key={r.rate} style={[s.tableCell, { width: dataWidth }]}>
                    <Text style={s.tableCellMonoBold}>{fmtDollar(total)}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* ===== FEE DETAIL ===== */}
        <Text style={s.sectionTitle}>Fee Details</Text>
        <View style={s.table}>
          <View style={s.tableRow}>
            <View style={[s.tableCell, { width: '70%' }]}>
              <Text style={s.tableCellBold}>Lender Fees (A)</Text>
            </View>
            <View style={[s.tableCell, { width: '30%' }]}>
              <Text style={s.tableCellMono}>{fmtDollar(lenderFees)}</Text>
            </View>
          </View>
          <View style={s.tableRow}>
            <View style={[s.tableCell, { width: '70%' }]}>
              <Text style={s.tableCellBold}>Est. Third-Party Fees (B) — {scenario.state} avg.</Text>
            </View>
            <View style={[s.tableCell, { width: '30%' }]}>
              <Text style={s.tableCellMono}>{fmtDollar(thirdPartyCosts)}</Text>
            </View>
          </View>
          <View style={[s.tableRowAlt, { borderBottomWidth: 0 }]}>
            <View style={[s.tableCell, { width: '70%' }]}>
              <Text style={[s.tableCellBold, { fontFamily: 'Helvetica-Bold' }]}>Total A + B</Text>
            </View>
            <View style={[s.tableCell, { width: '30%' }]}>
              <Text style={[s.tableCellMonoBold, { fontFamily: 'Courier-Bold' }]}>{fmtDollar(lenderFees + thirdPartyCosts)}</Text>
            </View>
          </View>
        </View>
        <Text style={s.footnote}>
          Third-party fees estimated for {scenario.state}. Contact for exact line-item Loan Estimate.
        </Text>

        {/* ===== LLPA BREAKDOWN ===== */}
        {llpa && llpa.breakdown && (
          <View style={{ marginTop: 14 }}>
            <Text style={s.sectionTitle}>Price Adjustments (LLPA)</Text>
            <View style={[s.table, { borderColor: GRAY_200 }]}>
              {llpa.breakdown.map((adj, i) => (
                <View key={i} style={s.llpaRow}>
                  <View style={[s.tableCell, { width: '70%' }]}>
                    <Text style={s.llpaLabel}>{adj.label}</Text>
                  </View>
                  <View style={[s.tableCell, { width: '30%' }]}>
                    <Text style={[s.tableCellMono, adj.value > 0 ? s.red : s.green]}>
                      {adj.value > 0 ? '+' : ''}{adj.value.toFixed(3)}
                    </Text>
                  </View>
                </View>
              ))}
              <View style={s.llpaTotalRow}>
                <View style={[s.tableCell, { width: '70%' }]}>
                  <Text style={s.llpaTotalLabel}>Total Adjustment</Text>
                </View>
                <View style={[s.tableCell, { width: '30%' }]}>
                  <Text style={s.tableCellMonoBold}>
                    {llpa.total > 0 ? '+' : ''}{llpa.total.toFixed(3)} pts
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ===== DISCLAIMER ===== */}
        <View style={s.disclaimer}>
          <Text style={s.disclaimerText}>
            Rates shown are approximate based on today&apos;s wholesale pricing and standard loan-level price adjustments. Actual rates depend on full credit review, property appraisal, and underwriting approval. Third-party cost estimates are based on state averages and may vary by county and provider. Not a commitment to lend.
          </Text>
          <Text style={s.disclaimerText}>
            David Burson | NMLS #641790 | NetRate Mortgage | 303-444-5251 | david@netratemortgage.com
          </Text>
          <Text style={[s.disclaimerText, { color: GRAY_400 }]}>netratemortgage.com</Text>
        </View>

      </Page>
    </Document>
  );
}
