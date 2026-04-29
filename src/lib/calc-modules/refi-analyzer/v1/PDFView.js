/**
 * refi-analyzer v1 — PDFView.
 *
 * @react-pdf/renderer view. Mirrors design tokens from QuotePDF.js +
 * cost-of-waiting/v1/PDFView.js. Pure presentational; consumes frozen
 * result.
 */

import { View, Text, StyleSheet } from '@react-pdf/renderer';

// Mirror of DESIGN-SYSTEM.md / tailwind.config.js.
const BRAND_DARK = '#24578C';
const SURFACE_LOW = '#F5F4F1';
const ON_SURFACE = '#1A1F2E';
const OUTLINE = '#7A8E9E';
const GREEN = '#059669';
const GREEN_BG = '#ECFDF5';
const RED = '#dc2626';
const RED_BG = '#FEF2F2';
const AMBER = '#B45309';
const AMBER_BG = '#FFFBEB';

const VERDICT_STYLE = {
  good: { color: GREEN, bg: GREEN_BG, border: '#A7F3D0' },
  bad: { color: RED, bg: RED_BG, border: '#FECACA' },
  neutral: { color: AMBER, bg: AMBER_BG, border: '#FCD34D' },
};

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

  verdictBar: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: OUTLINE + '30',
  },
  verdictText: { fontSize: 9, fontFamily: 'Helvetica-Bold', textAlign: 'center' },

  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    width: '50%',
    padding: 8,
    borderRightWidth: 0.5,
    borderRightColor: OUTLINE + '20',
    borderBottomWidth: 0.5,
    borderBottomColor: OUTLINE + '20',
  },
  cellLabel: { fontSize: 7, color: OUTLINE, textTransform: 'uppercase', letterSpacing: 1 },
  cellValueBig: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: GREEN, marginTop: 2 },
  cellValue: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: ON_SURFACE, marginTop: 2 },
  cellSub: { fontSize: 7, color: OUTLINE, marginTop: 1 },
});

const fmt = (n) => `$${Math.round(n).toLocaleString('en-US')}`;

/**
 * @param {{
 *   scenario: object,
 *   config: { closing_costs: number, hold_years: number },
 *   result: object,
 * }} props
 */
export default function PDFView({ config, result }) {
  if (!result) return null;
  const tone = VERDICT_STYLE[result.verdictTone] || VERDICT_STYLE.neutral;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Refi Recoup Analysis</Text>
        <Text style={s.headerSub}>Break-even on the proposed rate over a {config.hold_years}-year hold horizon.</Text>
      </View>

      <View style={[s.verdictBar, { backgroundColor: tone.bg, borderBottomColor: tone.border }]}>
        <Text style={[s.verdictText, { color: tone.color }]}>{result.verdict}</Text>
      </View>

      <View style={s.grid}>
        <View style={s.cell}>
          <Text style={s.cellLabel}>Monthly Savings</Text>
          <Text style={s.cellValueBig}>{fmt(result.monthlySavings)}</Text>
          <Text style={s.cellSub}>{fmt(result.currentPmt)}/mo → {fmt(result.newPmt)}/mo</Text>
        </View>
        <View style={s.cell}>
          <Text style={s.cellLabel}>Break-Even</Text>
          <Text style={s.cellValue}>
            {result.breakEvenMonths == null ? '—' : `${result.breakEvenMonths} mo`}
          </Text>
          <Text style={s.cellSub}>on {fmt(config.closing_costs)} costs</Text>
        </View>
        <View style={s.cell}>
          <Text style={s.cellLabel}>Interest Saved</Text>
          <Text style={s.cellValueBig}>{fmt(result.interestSaved)}</Text>
          <Text style={s.cellSub}>over life of loan</Text>
        </View>
        <View style={s.cell}>
          <Text style={s.cellLabel}>Net Savings ({config.hold_years}yr hold)</Text>
          <Text style={s.cellValue}>{fmt(result.netSavingsOverHold)}</Text>
          <Text style={s.cellSub}>after closing costs</Text>
        </View>
      </View>
    </View>
  );
}
