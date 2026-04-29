/**
 * purchase-calculator v1 — PDFView.
 *
 * @react-pdf/renderer view. Same shape as EmbeddedView (total +
 * PITI breakdown + cash-to-close + DTI), with PDF-native styling.
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

const DTI_STYLE = {
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

  hero: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: OUTLINE + '20',
    alignItems: 'center',
  },
  heroLabel: { fontSize: 7, color: OUTLINE, textTransform: 'uppercase', letterSpacing: 1 },
  heroValue: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: ON_SURFACE, marginTop: 2 },

  pitiRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: OUTLINE + '20' },
  pitiCell: {
    flex: 1,
    padding: 6,
    borderRightWidth: 0.5,
    borderRightColor: OUTLINE + '20',
  },
  pitiCellLast: { borderRightWidth: 0 },
  pitiLabel: { fontSize: 7, color: OUTLINE },
  pitiValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: ON_SURFACE, marginTop: 1 },

  bottomRow: { flexDirection: 'row' },
  bottomCell: {
    flex: 1,
    padding: 8,
    borderRightWidth: 0.5,
    borderRightColor: OUTLINE + '20',
  },
  bottomCellLast: { borderRightWidth: 0 },
  bottomLabel: { fontSize: 7, color: OUTLINE, textTransform: 'uppercase', letterSpacing: 1 },
  bottomValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: ON_SURFACE, marginTop: 2 },
  bottomSub: { fontSize: 7, color: OUTLINE, marginTop: 1 },
});

const fmt = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
const fmtPct = (n) => `${n.toFixed(1)}%`;

/**
 * @param {{
 *   scenario: object,
 *   config: object,
 *   result: object,
 * }} props
 */
export default function PDFView({ result }) {
  if (!result) return null;
  const dtiStyle = DTI_STYLE[result.dtiTone] || DTI_STYLE.neutral;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Purchase Payment Breakdown</Text>
        <Text style={s.headerSub}>Estimated monthly payment + cash to close at the proposed scenario.</Text>
      </View>

      <View style={s.hero}>
        <Text style={s.heroLabel}>Estimated Monthly Payment</Text>
        <Text style={s.heroValue}>{fmt(result.totalMonthly)}</Text>
      </View>

      <View style={s.pitiRow}>
        <View style={s.pitiCell}>
          <Text style={s.pitiLabel}>P&amp;I</Text>
          <Text style={s.pitiValue}>{fmt(result.monthlyPI)}</Text>
        </View>
        <View style={s.pitiCell}>
          <Text style={s.pitiLabel}>Tax</Text>
          <Text style={s.pitiValue}>{fmt(result.monthlyTax)}</Text>
        </View>
        <View style={s.pitiCell}>
          <Text style={s.pitiLabel}>Insurance</Text>
          <Text style={s.pitiValue}>{fmt(result.monthlyIns)}</Text>
        </View>
        <View style={[s.pitiCell, s.pitiCellLast]}>
          <Text style={s.pitiLabel}>{result.monthlyPMI > 0 ? 'PMI' : 'No PMI'}</Text>
          <Text style={s.pitiValue}>{fmt(result.monthlyPMI)}</Text>
        </View>
      </View>

      <View style={s.bottomRow}>
        <View style={s.bottomCell}>
          <Text style={s.bottomLabel}>Cash to Close</Text>
          <Text style={s.bottomValue}>{fmt(result.cashToClose)}</Text>
          <Text style={s.bottomSub}>
            {fmt(result.downPayment)} down + ~{fmt(result.closingCostsEstimate)} closing
          </Text>
        </View>
        <View style={[s.bottomCell, s.bottomCellLast, { backgroundColor: dtiStyle.bg }]}>
          <Text style={s.bottomLabel}>DTI</Text>
          <Text style={[s.bottomValue, { color: dtiStyle.color }]}>
            {fmtPct(result.dti)} — {result.dtiLabel}
          </Text>
        </View>
      </View>
    </View>
  );
}
