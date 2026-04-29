/**
 * refinance-calculator v1 — PDFView.
 *
 * @react-pdf/renderer view. Same shape as EmbeddedView. Renders the
 * MLO-selected preset from config.active_preset.
 */

import { View, Text, StyleSheet } from '@react-pdf/renderer';

const BRAND_DARK = '#24578C';
const SURFACE_LOW = '#F5F4F1';
const ON_SURFACE = '#1A1F2E';
const OUTLINE = '#7A8E9E';
const GREEN = '#059669';
const GREEN_BG = '#ECFDF5';
const RED = '#dc2626';
const AMBER = '#B45309';
const AMBER_BG = '#FFFBEB';

const PRESET_LABEL = {
  noCost: 'No-Cost',
  zeroOop: 'Zero Out of Pocket',
  lowestRate: 'Lowest Rate',
  custom: 'Custom Rate',
};

const PRESET_KEY = {
  noCost: 'noCost',
  zeroOop: 'zeroOop',
  lowestRate: 'lowest',
  custom: 'custom',
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

  rateRow: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: OUTLINE + '30',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  rate: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: ON_SURFACE },
  rateAsOf: { fontSize: 7, color: OUTLINE },

  explanation: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    fontSize: 8,
    color: OUTLINE,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 0.5, borderTopColor: OUTLINE + '20' },
  cell: {
    width: '50%',
    padding: 8,
    borderRightWidth: 0.5,
    borderRightColor: OUTLINE + '20',
    borderBottomWidth: 0.5,
    borderBottomColor: OUTLINE + '20',
  },
  cellLabel: { fontSize: 7, color: OUTLINE, textTransform: 'uppercase', letterSpacing: 1 },
  cellValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: ON_SURFACE, marginTop: 2 },

  netBar: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  netLabel: { fontSize: 7, textTransform: 'uppercase', letterSpacing: 1 },
  netValue: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  netSub: { fontSize: 7, color: OUTLINE, marginTop: 1 },
});

const fmt = (n) => `$${Math.round(n).toLocaleString('en-US')}`;

/**
 * @param {{
 *   scenario: object,
 *   config: { active_preset: string },
 *   result: object,
 * }} props
 */
export default function PDFView({ config, result }) {
  if (!result?.strategies) return null;
  const preset = config?.active_preset || 'noCost';
  const active = result.strategies[PRESET_KEY[preset]] || result.strategies.noCost;
  if (!active) return null;

  const inPocket = active.netCashFlow <= 0;

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Refinance Strategy — {PRESET_LABEL[preset]}</Text>
        <Text style={s.headerSub}>{active.lender} · {active.program}</Text>
      </View>

      <View style={s.rateRow}>
        <Text style={s.rate}>{active.rate.toFixed(3)}%</Text>
        {result.effectiveDate && <Text style={s.rateAsOf}>Rates as of {result.effectiveDate}</Text>}
      </View>

      <Text style={s.explanation}>{active.explanation}</Text>

      <View style={s.grid}>
        <View style={s.cell}>
          <Text style={s.cellLabel}>New Payment</Text>
          <Text style={s.cellValue}>{fmt(active.payment)}</Text>
        </View>
        <View style={[s.cell, { borderRightWidth: 0 }]}>
          <Text style={s.cellLabel}>Monthly Savings</Text>
          <Text style={[s.cellValue, { color: active.monthlySavings > 0 ? GREEN : RED }]}>
            {active.monthlySavings > 0 ? '+' : ''}{fmt(active.monthlySavings)}
          </Text>
        </View>
        <View style={s.cell}>
          <Text style={s.cellLabel}>New Loan Amount</Text>
          <Text style={s.cellValue}>{fmt(active.loanAmount)}</Text>
        </View>
        <View style={[s.cell, { borderRightWidth: 0, borderBottomWidth: 0 }]}>
          <Text style={s.cellLabel}>Cash to Close</Text>
          <Text style={s.cellValue}>{active.cashToClose === 0 ? '$0' : fmt(active.cashToClose)}</Text>
        </View>
      </View>

      <View style={[s.netBar, { backgroundColor: inPocket ? GREEN_BG : AMBER_BG }]}>
        <Text style={[s.netLabel, { color: inPocket ? GREEN : AMBER }]}>Net Out-of-Pocket</Text>
        <Text style={[s.netValue, { color: inPocket ? GREEN : AMBER }]}>
          {inPocket ? `+${fmt(Math.abs(active.netCashFlow))} in pocket` : fmt(active.netCashFlow)}
        </Text>
        <Text style={s.netSub}>After {fmt(active.totalCashBack)} cash back within ~30 days</Text>
      </View>
    </View>
  );
}
