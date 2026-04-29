/**
 * cost-of-waiting v1 — PDFView.
 *
 * @react-pdf/renderer view for the borrower-facing PDF deliverable when
 * this module is attached to a quote. Pure presentational — consumes
 * the frozen `result`. Mirrors design tokens from QuotePDF.js (§ Design
 * tokens — same hex values as tailwind.config.js / DESIGN-SYSTEM.md).
 *
 * Compact: meant to fit one page section, not a whole page. The quote
 * PDF orchestrator (Phase 9-10) renders multiple module PDFViews on a
 * dedicated "Analysis" page.
 */

import { View, Text, StyleSheet } from '@react-pdf/renderer';

// Mirror of DESIGN-SYSTEM.md / tailwind.config.js — keep in sync with QuotePDF.js
const BRAND_DARK = '#24578C';
const SURFACE_LOW = '#F5F4F1';
const ON_SURFACE = '#1A1F2E';
const OUTLINE = '#7A8E9E';
const GREEN = '#059669';
const RED = '#dc2626';

const s = StyleSheet.create({
  container: {
    borderWidth: 0.5,
    borderColor: OUTLINE + '40',
    borderRadius: 6,
    backgroundColor: '#ffffff',
    marginBottom: 12,
  },
  header: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: SURFACE_LOW,
    borderBottomWidth: 0.5,
    borderBottomColor: OUTLINE + '30',
  },
  headerTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: BRAND_DARK },
  headerSub: { fontSize: 7, color: OUTLINE, marginTop: 1 },

  heroRow: { flexDirection: 'row', padding: 10, gap: 12 },
  heroCell: { flex: 1 },
  heroLabel: { fontSize: 7, color: OUTLINE, textTransform: 'uppercase', letterSpacing: 1 },
  heroValueBig: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: GREEN, marginTop: 2 },
  heroValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: ON_SURFACE, marginTop: 2 },
  heroSub: { fontSize: 7, color: OUTLINE, marginTop: 2 },

  table: { borderTopWidth: 0.5, borderTopColor: OUTLINE + '30' },
  tableHeader: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 10 },
  tableHeaderCell: { fontSize: 7, color: OUTLINE, textTransform: 'uppercase', letterSpacing: 1 },
  tableHeaderCellRight: { textAlign: 'right' },
  tableRow: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 10, borderTopWidth: 0.5, borderTopColor: OUTLINE + '20' },
  tableCell: { fontSize: 9, color: ON_SURFACE, flex: 1 },
  tableCellRight: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: RED, flex: 1, textAlign: 'right' },
});

const fmt = (n) => `$${Math.round(n).toLocaleString('en-US')}`;

const CONDENSED_WAIT_MONTHS = [3, 6, 12];

/**
 * @param {{
 *   scenario: object,
 *   config: { newRate: number, sp500ReturnRate: number, cdReturnRate: number },
 *   result: object,
 * }} props
 */
export default function PDFView({ result }) {
  if (!result || !result.eligible) return null;

  const condensed = result.table.filter((row) => CONDENSED_WAIT_MONTHS.includes(row.months));

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Cost of Waiting</Text>
        <Text style={s.headerSub}>What delaying refinance at the proposed rate costs you.</Text>
      </View>

      <View style={s.heroRow}>
        <View style={s.heroCell}>
          <Text style={s.heroLabel}>Monthly Savings</Text>
          <Text style={s.heroValueBig}>{fmt(result.monthlySavings)}</Text>
          <Text style={s.heroSub}>{fmt(result.currentPmt)}/mo → {fmt(result.newPmt)}/mo</Text>
        </View>
        <View style={s.heroCell}>
          <Text style={s.heroLabel}>Lifetime Savings</Text>
          <Text style={s.heroValue}>{fmt(result.lifetimeSavings)}</Text>
          <Text style={s.heroSub}>over the loan term</Text>
        </View>
      </View>

      <View style={s.table}>
        <View style={s.tableHeader}>
          <Text style={[s.tableHeaderCell, { flex: 1 }]}>If you wait</Text>
          <Text style={[s.tableHeaderCell, s.tableHeaderCellRight, { flex: 1 }]}>You lose</Text>
        </View>
        {condensed.map((row) => (
          <View style={s.tableRow} key={row.months}>
            <Text style={s.tableCell}>{row.months} {row.months === 1 ? 'month' : 'months'}</Text>
            <Text style={s.tableCellRight}>{fmt(row.lost)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
