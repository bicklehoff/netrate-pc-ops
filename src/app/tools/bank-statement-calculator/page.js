'use client';

import { useState, useEffect } from 'react';

// ── Rate data: Rocket Pro NQM 30-Year, 30-day lock, April 14 2026 ──
const RATES = [
  { rate: 5.990, base: 98.550 },
  { rate: 6.125, base: 99.276 },
  { rate: 6.250, base: 99.966 },
  { rate: 6.375, base: 100.616 },
  { rate: 6.500, base: 101.219 },
  { rate: 6.625, base: 101.770 },
  { rate: 6.750, base: 102.282 },
  { rate: 6.875, base: 102.766 },
  { rate: 6.990, base: 103.218 },
  { rate: 7.125, base: 103.649 },
  { rate: 7.250, base: 104.028 },
  { rate: 7.375, base: 104.369 },
  { rate: 7.500, base: 104.712 },
  { rate: 7.625, base: 105.048 },
  { rate: 7.750, base: 105.374 },
  { rate: 7.875, base: 105.698 },
];
const MAX_PREMIUM_CAP = 103.045;
const SHEET_DATE = 'April 14, 2026';

// FICO × LTV (HCLTV) grid — Rocket NQM LLPAs
// LTV bands: [≤60, 60-65, 65-70, 70-75, 75-80, 80-85, >85]
const LTV_BANDS = [60, 65, 70, 75, 80, 85, 100];
const FICO_LTV = [
  { min: 780, max: 999, adj: [-0.750, -0.625, -0.500, -0.375, -0.125, 1.625, 3.250] },
  { min: 760, max: 779, adj: [-0.625, -0.500, -0.250, -0.125,  0.125, 2.000, 3.375] },
  { min: 740, max: 759, adj: [-0.375, -0.250, -0.125,  0.125,  0.500, 2.500, 4.250] },
  { min: 720, max: 739, adj: [-0.250, -0.125,  0.125,  0.375,  1.000, 3.375, 5.625] },
  { min: 700, max: 719, adj: [-0.125,  0.125,  0.375,  0.750,  1.250, 4.375, null] },
  { min: 680, max: 699, adj: [ 0.000,  0.375,  0.625,  1.500,  2.250, null,  null] },
  { min: 660, max: 679, adj: [ 0.750,  1.000,  1.625,  2.500,  3.625, null,  null] },
];

// Stacked LLPAs by LTV band [≤60, 60-65, 65-70, 70-75, 75-80, 80-85, >85]
const BANK_STMT_ADJ =  [0.125, 0.125, 0.125, 0.125, 0.375, 0.500, 0.625];
const CASHOUT_ADJ =    [0.375, 0.500, 0.750, 1.000, 1.500, null,  null];
const CONDO_ADJ =      [0.000, 0.250, 0.250, 0.375, 0.500, 0.625, null];
const MULTI_ADJ =      [0.500, 0.500, 0.500, 0.500, 0.750, 1.500, null];
// Investment & Second Home adjustments — available but not wired to occupancy toggle yet
// const INVEST_ADJ =  [0.125, 0.250, 0.500, 0.750, null,  null,  null];
// const SECOND_ADJ =  [0.125, 0.250, 0.250, 0.500, 0.500, 0.875, null];
const DTI_45_50_ADJ =  [0.250, 0.250, 0.500, 0.625, 1.000, 1.500, 2.000];

// Loan amount ladder
const LOAN_AMT_TIERS = [
  { min: 125000, max: 149999, adj: 0.750 },
  { min: 150000, max: 199999, adj: 0.750 },
  { min: 200000, max: 249999, adj: 0.500 },
  { min: 250000, max: 499999, adj: 0.250 },
  { min: 500000, max: 599999, adj: 0.000 },
  { min: 600000, max: 699999, adj: -0.375 },
  { min: 700000, max: 999999, adj: -0.750 },
  { min: 1000000, max: 1499999, adj: -0.750 },
  { min: 1500000, max: 1999999, adj: 0.500 },
  { min: 2000000, max: Infinity, adj: 1.000 },
];

const COMP_RATE = 0.02;
const COMP_CAP_PURCHASE = 4595;
const COMP_CAP_REFI = 3595;

// ── Helpers ──
function getLtvBandIdx(ltv) {
  for (let i = 0; i < LTV_BANDS.length; i++) if (ltv <= LTV_BANDS[i]) return i;
  return LTV_BANDS.length - 1;
}
function getFicoLtvAdj(fico, ltvIdx) {
  for (const row of FICO_LTV) if (fico >= row.min && fico <= row.max) return row.adj[ltvIdx];
  return null;
}
function getLoanAmtAdj(amt) {
  for (const t of LOAN_AMT_TIERS) if (amt >= t.min && amt <= t.max) return t.adj;
  return 0;
}
function getStackedAdj(arr, ltvIdx) { return arr[ltvIdx] ?? null; }
function calcPI(loan, annualRate) {
  const r = annualRate / 100 / 12;
  return loan * (r * Math.pow(1 + r, 360)) / (Math.pow(1 + r, 360) - 1);
}
function fmtD(n) { return '$' + Math.round(n).toLocaleString(); }
function fmtPts(n) { return (n >= 0 ? '+' : '') + n.toFixed(3) + ' pts'; }

// ── Design system classes ──
const labelCls = 'block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1';
const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:border-brand focus:ring-2 focus:ring-brand/10 outline-none transition-colors tabular-nums';
const cardCls = 'bg-white rounded-2xl border border-gray-100 shadow-[0_4px_24px_rgba(2,76,79,0.06)] p-5';
const tightCardCls = 'bg-white rounded-xl border border-gray-100 shadow-[0_2px_12px_rgba(2,76,79,0.05)] p-4';

function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <div className="w-1 h-3 bg-brand rounded-full" />
      <span className="text-[10px] font-bold text-brand uppercase tracking-widest">{children}</span>
    </div>
  );
}

// ── DTI Gauge ──
function DTIGauge({ dti }) {
  const cx = 100, cy = 90, r = 72;
  const arcLen = Math.PI * r;
  const fillPct = Math.min(1, Math.max(0, dti / 65));
  const fillLen = fillPct * arcLen;
  const color = dti <= 43 ? '#059669' : dti <= 50 ? '#d97706' : '#dc2626';
  const status = dti <= 38 ? 'Strong' : dti <= 43 ? 'Good' : dti <= 50 ? 'Max DTI' : 'Over Limit';

  const arcPoint = (f, radius) => {
    const theta = (1 - f) * Math.PI;
    return { x: cx + radius * Math.cos(theta), y: cy - radius * Math.sin(theta) };
  };
  const ticks = [43 / 65, 50 / 65];

  return (
    <svg viewBox="0 0 200 108" className="w-full max-w-[300px] mx-auto">
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="#e5e7eb" strokeWidth="16" strokeLinecap="round" />
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke={color} strokeWidth="16" strokeLinecap="round"
        strokeDasharray={`${fillLen} ${arcLen}`}
        style={{ transition: 'stroke-dasharray 0.4s ease, stroke 0.3s ease' }} />
      {ticks.map(f => {
        const inner = arcPoint(f, r - 9);
        const outer = arcPoint(f, r + 1);
        return <line key={f} x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y}
          stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" />;
      })}
      <text x={cx} y={cy - 20} textAnchor="middle" fontSize="36" fontWeight="700"
        fill={color} fontFamily="Inter,sans-serif" style={{ transition: 'fill 0.3s ease' }}>
        {dti.toFixed(1)}%
      </text>
      <text x={cx} y={cy + 2} textAnchor="middle" fontSize="10" fontWeight="600"
        fill="#9ca3af" fontFamily="Inter,sans-serif" letterSpacing="2">DTI</text>
      <text x={cx} y={cy + 18} textAnchor="middle" fontSize="11" fontWeight="600"
        fill={color} fontFamily="Inter,sans-serif" style={{ transition: 'fill 0.3s ease' }}>{status}</text>
    </svg>
  );
}

// ── PDF Component ──
function BankStatementLoanPDF({ borrowerName, loanAmount, ltv, fico, propertyType, purpose, stateName,
  monthlyDeposits, statementType, expensePct, monthlyQualIncome, annualQualIncome,
  activeRow, monthlyTaxes, monthlyInsurance, monthlyHoa, debt1Label, debt1Amount, debt2Label, debt2Amount, dti,
  Document, Page, View, Text, StyleSheet }) {
  const B = '#2E6BA8', BD = '#24578C', GO = '#059669', INK = '#1A1F2E', IM = '#4A5C6E', IS = '#7A8E9E', SL = '#f2f4f6', W = '#ffffff';
  const s = StyleSheet.create({
    page: { padding: 40, fontFamily: 'Helvetica', fontSize: 9, color: INK, backgroundColor: W },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: IS + '30', marginBottom: 16 },
    logoBlock: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    logoIcon: { width: 28, height: 28, backgroundColor: B, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
    logoIconText: { fontFamily: 'Helvetica-Bold', fontSize: 15, color: W, textAlign: 'center', marginTop: 3 },
    companyName: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: BD },
    subtitle: { fontSize: 7, letterSpacing: 2, textTransform: 'uppercase', color: IS, marginTop: 1 },
    headerDetail: { fontSize: 8, color: IS, marginTop: 1 },
    badge: { backgroundColor: SL, borderRadius: 10, paddingVertical: 3, paddingHorizontal: 10 },
    badgeText: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: IS, textTransform: 'uppercase', letterSpacing: 1 },
    infoBar: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    cardRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    card: { flex: 1, backgroundColor: SL, borderRadius: 8, padding: 10 },
    cardLabel: { fontSize: 7, textTransform: 'uppercase', letterSpacing: 1.5, color: IS, marginBottom: 2 },
    cardValue: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: INK },
    cardValueGreen: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: GO },
    sectionTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: BD, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6, marginTop: 12 },
    row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: SL },
    rowLabel: { fontSize: 9, color: IM },
    rowValue: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: INK },
    totalBar: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: GO, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginTop: 8 },
    totalLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: W },
    totalValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: W },
    footer: { position: 'absolute', bottom: 24, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: IS + '30', paddingTop: 6 },
    footerText: { fontSize: 7, color: IS },
    disclaimer: { fontSize: 7, color: IS, lineHeight: 1.5, marginTop: 10 },
  });
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const totalDebts = (activeRow?.pitia || 0) + debt1Amount + debt2Amount;
  const propLabel = { sfr: 'Single Family', condo: 'Condo', '2unit': '2-Unit', '3-4unit': '3-4 Unit' }[propertyType] || propertyType;
  const purpLabel = { purchase: 'Purchase', refinance: 'Rate/Term Refi', cashout: 'Cash-Out Refi' }[purpose] || purpose;

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        <View style={s.headerRow}>
          <View style={s.logoBlock}>
            <View style={s.logoIcon}><Text style={s.logoIconText}>N</Text></View>
            <View>
              <Text style={s.companyName}>NetRate Mortgage</Text>
              <Text style={s.subtitle}>Bank Statement Loan Quote</Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.headerDetail}>David Burson | NMLS #641790</Text>
            <Text style={s.headerDetail}>NetRate Mortgage LLC | NMLS #1111861</Text>
            <Text style={s.headerDetail}>303-444-5251 | david@netratemortgage.com</Text>
          </View>
        </View>
        <View style={s.infoBar}>
          <View>
            <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: INK }}>{borrowerName || 'Borrower'}</Text>
            <Text style={{ fontSize: 9, color: IM, marginTop: 2 }}>{purpLabel} | {propLabel} | {stateName}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <View style={s.badge}><Text style={s.badgeText}>{statementType} Bank Statements</Text></View>
            <Text style={{ fontSize: 8, color: IS, marginTop: 4 }}>Prepared {today}</Text>
          </View>
        </View>
        <View style={s.cardRow}>
          <View style={s.card}><Text style={s.cardLabel}>Loan Amount</Text><Text style={s.cardValue}>{fmtD(loanAmount)}</Text></View>
          <View style={s.card}><Text style={s.cardLabel}>Rate</Text><Text style={s.cardValue}>{activeRow?.rate.toFixed(3)}%</Text></View>
          <View style={[s.card, { borderLeftWidth: 3, borderLeftColor: GO }]}><Text style={s.cardLabel}>Monthly Payment</Text><Text style={s.cardValueGreen}>{fmtD(activeRow?.pitia || 0)}</Text></View>
        </View>
        <Text style={s.sectionTitle}>Loan Details</Text>
        {[['Purchase Price / Value', fmtD(loanAmount + (loanAmount / (ltv / 100) - loanAmount))], ['Down Payment', fmtD(loanAmount / (ltv / 100) - loanAmount)], ['LTV', ltv.toFixed(1) + '%'], ['FICO', String(fico)]].map(([l, v]) => (
          <View key={l} style={s.row}><Text style={s.rowLabel}>{l}</Text><Text style={s.rowValue}>{v}</Text></View>
        ))}
        <Text style={s.sectionTitle}>Income</Text>
        {[['Avg Monthly Deposits', fmtD(monthlyDeposits)], ['Expense Factor', expensePct + '%' + (statementType === 'personal' ? ' (personal — no deduction)' : '')], ['Monthly Qualifying Income', fmtD(monthlyQualIncome)], ['Annual Qualifying Income', fmtD(annualQualIncome)]].map(([l, v]) => (
          <View key={l} style={s.row}><Text style={s.rowLabel}>{l}</Text><Text style={s.rowValue}>{v}</Text></View>
        ))}
        <Text style={s.sectionTitle}>Monthly Payment Breakdown</Text>
        {[['Principal & Interest', fmtD(activeRow?.pi || 0)], ['Property Taxes', fmtD(monthlyTaxes)], ['Insurance', fmtD(monthlyInsurance)], ...(monthlyHoa > 0 ? [['HOA', fmtD(monthlyHoa)]] : []), ['Total PITIA', fmtD(activeRow?.pitia || 0)], ...(debt1Amount > 0 ? [[debt1Label || 'Debt 1', fmtD(debt1Amount)]] : []), ...(debt2Amount > 0 ? [[debt2Label || 'Debt 2', fmtD(debt2Amount)]] : [])].map(([l, v]) => (
          <View key={l} style={s.row}><Text style={s.rowLabel}>{l}</Text><Text style={s.rowValue}>{v}</Text></View>
        ))}
        <View style={s.totalBar}>
          <Text style={s.totalLabel}>DTI: {dti.toFixed(1)}% ({fmtD(totalDebts)} / {fmtD(monthlyQualIncome)})</Text>
          <Text style={s.totalValue}>{fmtD(activeRow?.pitia || 0)}/mo</Text>
        </View>
        <Text style={s.sectionTitle}>Pricing</Text>
        {[['Net Price', (activeRow?.netPrice || 100).toFixed(3)], ['Rebate / Cost', activeRow?.netDollar >= 0 ? fmtD(activeRow.netDollar) + ' rebate' : fmtD(Math.abs(activeRow?.netDollar || 0)) + ' cost']].map(([l, v]) => (
          <View key={l} style={s.row}><Text style={s.rowLabel}>{l}</Text><Text style={s.rowValue}>{v}</Text></View>
        ))}
        <Text style={s.disclaimer}>This quote is for estimation purposes only. Rates, terms and conditions subject to change without notice. Not a commitment to lend. Bank statement income is subject to lender underwriting review. Rocket Pro TPO NQM program, {SHEET_DATE}.</Text>
        <View style={s.footer} fixed>
          <Text style={s.footerText}>NetRate Mortgage LLC | NMLS #1111861 | Equal Housing Lender</Text>
          <Text style={s.footerText}>357 S McCaslin Blvd #200, Louisville, CO 80027</Text>
        </View>
      </Page>
    </Document>
  );
}


// ── Main Component ──
export default function BankStatementCalculator() {
  // Loan scenario
  const [purchasePrice, setPurchasePrice] = useState(500000);
  const [downPayment, setDownPayment] = useState(100000);
  const [manualPtsOverride, setManualPtsOverride] = useState({}); // { [rate]: points override }
  const [fico, setFico] = useState(740);
  const [propertyType, setPropertyType] = useState('sfr');
  const [state, setState] = useState('CO');
  const [purpose, setPurpose] = useState('purchase');
  // Income
  const [statementType, setStatementType] = useState('business');
  const [monthlyDeposits, setMonthlyDeposits] = useState(25000);
  const [expensePct, setExpensePct] = useState(50);
  const [hasCpaLetter, setHasCpaLetter] = useState(false);
  const [selfEmployedYears, setSelfEmployedYears] = useState(3);
  // Expenses
  const [monthlyTaxes, setMonthlyTaxes] = useState(400);
  const [monthlyInsurance, setMonthlyInsurance] = useState(175);
  const [monthlyHoa, setMonthlyHoa] = useState(0);
  // Debts
  const [debt1Label, setDebt1Label] = useState('Auto Loan');
  const [debt1Amount, setDebt1Amount] = useState(450);
  const [debt2Label, setDebt2Label] = useState('');
  const [debt2Amount, setDebt2Amount] = useState(0);
  // UI
  const [selectedRate, setSelectedRate] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [borrowerName, setBorrowerName] = useState('');

  // ── Derived ──
  const expRate = statementType === 'personal' ? 0 : expensePct / 100;
  const monthlyQualIncome = monthlyDeposits * (1 - expRate);
  const annualQualIncome = monthlyQualIncome * 12;
  const loanAmount = Math.max(0, purchasePrice - downPayment);
  const ltv = purchasePrice > 0 ? (loanAmount / purchasePrice) * 100 : 0;

  // Sync down payment when purchase price changes
  const setPurchasePriceAndSync = (val) => {
    setPurchasePrice(val);
    if (downPayment > val) setDownPayment(val);
  };
  const setDownPaymentFromLoan = (loan) => {
    setDownPayment(Math.max(0, purchasePrice - loan));
  };
  const setDownPaymentFromLtv = (ltvVal) => {
    const loan = purchasePrice * (ltvVal / 100);
    setDownPayment(Math.max(0, Math.round(purchasePrice - loan)));
  };
  const ltvIdx = getLtvBandIdx(ltv);
  const compCap = purpose === 'purchase' ? COMP_CAP_PURCHASE : COMP_CAP_REFI;
  const compDollar = Math.min(loanAmount * COMP_RATE, compCap);
  const compPts = loanAmount > 0 ? (compDollar / loanAmount) * 100 : 0;
  const totalOtherDebts = debt1Amount + debt2Amount;

  // LLPAs
  const ficoLtvAdj = getFicoLtvAdj(fico, ltvIdx);
  const bankStmtAdj = getStackedAdj(BANK_STMT_ADJ, ltvIdx) || 0;
  const propAdj = propertyType === 'condo' ? (getStackedAdj(CONDO_ADJ, ltvIdx) || 0)
    : propertyType === '2unit' || propertyType === '3-4unit' ? (getStackedAdj(MULTI_ADJ, ltvIdx) || 0) : 0;
  const purpAdj = purpose === 'cashout' ? (getStackedAdj(CASHOUT_ADJ, ltvIdx) || 0) : 0;
  const loanAmtAdj = getLoanAmtAdj(loanAmount);

  // Ineligible if FICO/LTV combo returns null
  const isEligible = ficoLtvAdj !== null;

  const rows = RATES.map(({ rate, base }) => {
    if (!isEligible) return { rate, base, pi: 0, pitia: 0, dti: 999, adjPrice: 0, netPrice: 0, netDollar: 0, ficoLtvAdj: 0, bankStmtAdj: 0, propAdj: 0, purpAdj: 0, loanAmtAdj: 0, dtiAdj: 0 };
    const pi = calcPI(loanAmount, rate);
    const pitia = pi + monthlyTaxes + monthlyInsurance + monthlyHoa;
    const totalMonthly = pitia + totalOtherDebts;
    const dti = monthlyQualIncome > 0 ? (totalMonthly / monthlyQualIncome) * 100 : 999;
    const dtiAdj = dti > 45 && dti <= 50 ? (getStackedAdj(DTI_45_50_ADJ, ltvIdx) || 0) : 0;
    const rawAdj = base + ficoLtvAdj + bankStmtAdj + propAdj + purpAdj + loanAmtAdj + dtiAdj;
    const adjPrice = Math.min(rawAdj, MAX_PREMIUM_CAP);
    // Manual points override: if set, use it instead of calculated net
    const hasOverride = manualPtsOverride[rate] !== undefined && manualPtsOverride[rate] !== '';
    const overridePts = hasOverride ? parseFloat(manualPtsOverride[rate]) : 0;
    const netPrice = hasOverride ? (100 + overridePts) : (adjPrice - compPts);
    const netDollar = (netPrice - 100) / 100 * loanAmount;
    return { rate, base, pi, pitia, dti, adjPrice, netPrice, netDollar, ficoLtvAdj, bankStmtAdj, propAdj, purpAdj, loanAmtAdj, dtiAdj, hasOverride };
  });

  const parRow = rows.reduce((best, r) => Math.abs(r.netPrice - 100) < Math.abs(best.netPrice - 100) ? r : best, rows[0]);
  const displayRows = rows.filter(r => Math.abs(r.netPrice - 100) < 3.5 && r.dti < 999);

  useEffect(() => { setSelectedRate(parRow.rate); }, [loanAmount, fico, propertyType, purpose, monthlyDeposits, statementType, expensePct, monthlyTaxes, monthlyInsurance, monthlyHoa, debt1Amount, debt2Amount]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeRow = rows.find(r => r.rate === selectedRate) || parRow;

  const guidelines = [
    { pass: activeRow.dti <= 43, warn: activeRow.dti <= 50, text: `DTI ${activeRow.dti.toFixed(1)}% — max 50%, preferred under 43%` },
    { pass: ltv <= 80, warn: ltv <= 85, text: `LTV ${ltv.toFixed(1)}% — max varies by FICO` },
    { pass: fico >= 700, warn: fico >= 660, text: `FICO ${fico} — min 660 required` },
    { pass: selfEmployedYears >= 2, warn: false, text: `Self-employed ${selfEmployedYears} yrs — min 2 required` },
    { pass: isEligible, warn: false, text: isEligible ? 'FICO/LTV eligible' : 'FICO/LTV combo ineligible for this program' },
    { pass: loanAmount >= 125000, warn: false, text: loanAmount >= 125000 ? 'Min loan amount met ($125K)' : 'Loan below $125K minimum' },
  ];

  const handleDownloadPDF = async () => {
    setPdfLoading(true);
    try {
      const rpdf = await import('@react-pdf/renderer');
      const blob = await rpdf.pdf(
        BankStatementLoanPDF({
          borrowerName, loanAmount, ltv, fico, propertyType, purpose, stateName: state,
          monthlyDeposits, statementType, expensePct, monthlyQualIncome, annualQualIncome,
          activeRow, monthlyTaxes, monthlyInsurance, monthlyHoa,
          debt1Label, debt1Amount, debt2Label, debt2Amount, dti: activeRow.dti,
          Document: rpdf.Document, Page: rpdf.Page, View: rpdf.View, Text: rpdf.Text, StyleSheet: rpdf.StyleSheet,
        })
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bank-Statement-Loan-${(borrowerName || 'Quote').replace(/\s+/g, '-')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { console.error('PDF generation failed:', err); }
    finally { setPdfLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <div className="bg-brand border-b border-brand-dark">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <span className="text-white font-bold text-base">Bank Statement Loan Calculator</span>
          <span className="bg-accent text-ink text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Non-QM</span>
          <span className="ml-auto text-white/60 text-xs hidden sm:block">Rocket Pro · 30yr NQM · {SHEET_DATE}</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[320px_1fr_210px] gap-5 items-start">

        {/* ── LEFT: Inputs ── */}
        <div className="flex flex-col gap-4">
          <div className={cardCls}>
            <SectionLabel>Loan Scenario</SectionLabel>
            <div className="mb-3">
              <label className={labelCls}>Purchase Price</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" value={purchasePrice} onChange={e => setPurchasePriceAndSync(+e.target.value || 0)} step={5000} className={inputCls + ' pl-6'} />
              </div>
            </div>
            <div className="mb-3">
              <label className={labelCls}>Down Payment</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" value={downPayment} onChange={e => setDownPayment(+e.target.value || 0)} step={1000} className={inputCls + ' pl-6'} />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">{purchasePrice > 0 ? (downPayment / purchasePrice * 100).toFixed(1) + '% down' : ''}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div><label className={labelCls}>Loan Amount</label>
                <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" value={loanAmount} onChange={e => setDownPaymentFromLoan(+e.target.value || 0)} step={1000} className={inputCls + ' pl-6'} /></div></div>
              <div><label className={labelCls}>LTV %</label>
                <input type="number" value={parseFloat(ltv.toFixed(1))} onChange={e => setDownPaymentFromLtv(+e.target.value || 0)} step={0.5} min={0} max={100} className={inputCls} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div><label className={labelCls}>FICO Score</label>
                <input type="number" value={fico} onChange={e => setFico(+e.target.value)} min={620} max={850} className={inputCls} /></div>
              <div><label className={labelCls}>Property Type</label>
                <select value={propertyType} onChange={e => setPropertyType(e.target.value)} className={inputCls}>
                  <option value="sfr">Single Family</option><option value="condo">Condo</option>
                  <option value="2unit">2-Unit</option><option value="3-4unit">3-4 Unit</option>
                </select></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className={labelCls}>State</label>
                <select value={state} onChange={e => setState(e.target.value)} className={inputCls}>
                  <option value="CO">Colorado</option><option value="CA">California</option>
                  <option value="TX">Texas</option><option value="OR">Oregon</option>
                </select></div>
              <div><label className={labelCls}>Purpose</label>
                <select value={purpose} onChange={e => setPurpose(e.target.value)} className={inputCls}>
                  <option value="purchase">Purchase</option><option value="refinance">Refinance</option>
                  <option value="cashout">Cash-Out</option>
                </select></div>
            </div>
          </div>

          {/* Income */}
          <div className={cardCls}>
            <SectionLabel>Income — Bank Statements</SectionLabel>
            <label className={labelCls}>Statement Type</label>
            <div className="grid grid-cols-2 gap-1 mb-3">
              {['business', 'personal'].map(t => (
                <button key={t} onClick={() => setStatementType(t)}
                  className={`py-2 rounded-lg text-sm font-semibold transition-colors ${statementType === t ? 'bg-brand text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {t === 'business' ? 'Business' : 'Personal'}
                </button>
              ))}
            </div>
            <div className="mb-3">
              <label className={labelCls}>Average Monthly Deposits</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" value={monthlyDeposits} onChange={e => setMonthlyDeposits(+e.target.value || 0)} step={1000} className={inputCls + ' pl-6'} />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">Total deposits ÷ 12 months from statements</p>
            </div>
            {statementType === 'business' && (
              <>
                <label className={labelCls}>Expense Factor</label>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xl font-bold text-brand tabular-nums">{expensePct}%</span>
                  <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                    <input type="checkbox" checked={hasCpaLetter}
                      onChange={e => { setHasCpaLetter(e.target.checked); if (!e.target.checked) setExpensePct(50); }}
                      className="rounded border-gray-300 text-brand focus:ring-brand" />CPA Letter
                  </label>
                </div>
                <input type="range" min={hasCpaLetter ? 30 : 50} max={70} step={5} value={expensePct}
                  onChange={e => setExpensePct(+e.target.value)} disabled={!hasCpaLetter}
                  className="w-full h-1.5 rounded-full outline-none cursor-pointer appearance-none
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
                    [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-brand
                    [&::-webkit-slider-thumb]:shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: `linear-gradient(to right, #2E6BA8 0%, #2E6BA8 ${((expensePct - 30) / 40 * 100)}%, #e5e7eb ${((expensePct - 30) / 40 * 100)}%, #e5e7eb 100%)` }} />
              </>
            )}
            <div className="mb-3 mt-3">
              <label className={labelCls}>Self-Employed Years</label>
              <input type="number" value={selfEmployedYears} onChange={e => setSelfEmployedYears(+e.target.value)} min={0} max={50} className={inputCls} />
            </div>
            <div className="bg-brand/5 border border-brand/10 rounded-xl px-3 py-2 mt-2">
              <div className="text-[10px] font-bold text-brand uppercase tracking-wider">Qualifying Income</div>
              <div className="flex justify-between items-baseline mt-1">
                <span className="text-xs text-gray-500">{fmtD(monthlyDeposits)} {statementType === 'business' ? `× ${100 - expensePct}%` : ''}</span>
                <span className="text-lg font-bold text-brand tabular-nums">{fmtD(monthlyQualIncome)}/mo</span>
              </div>
              <div className="text-right text-[11px] text-gray-400">{fmtD(annualQualIncome)}/yr</div>
            </div>
          </div>

          {/* Housing Expenses */}
          <div className={cardCls}>
            <SectionLabel>Monthly Housing Expenses</SectionLabel>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div><label className={labelCls}>Property Taxes</label>
                <div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                  <input type="number" value={monthlyTaxes} onChange={e => setMonthlyTaxes(+e.target.value || 0)} step={25} className={inputCls + ' pl-5 text-xs'} /></div>
                <p className="text-[10px] text-gray-400 mt-0.5">Annual ÷ 12</p></div>
              <div><label className={labelCls}>Insurance</label>
                <div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                  <input type="number" value={monthlyInsurance} onChange={e => setMonthlyInsurance(+e.target.value || 0)} step={10} className={inputCls + ' pl-5 text-xs'} /></div></div>
            </div>
            <div><label className={labelCls}>HOA (if any)</label>
              <div className="relative"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                <input type="number" value={monthlyHoa} onChange={e => setMonthlyHoa(+e.target.value || 0)} step={25} className={inputCls + ' pl-5 text-xs'} /></div></div>
          </div>

          {/* Debts */}
          <div className={cardCls}>
            <SectionLabel>Other Monthly Debts</SectionLabel>
            <div className="space-y-2">
              {[[debt1Label, debt1Amount, setDebt1Label, setDebt1Amount], [debt2Label, debt2Amount, setDebt2Label, setDebt2Amount]].map(([label, amt, setLabel, setAmt], i) => (
                <div key={i} className="grid grid-cols-[1fr_100px] gap-2">
                  <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder={`Debt ${i + 1} label`} className={inputCls + ' text-xs'} />
                  <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                    <input type="number" value={amt || ''} onChange={e => setAmt(+e.target.value || 0)} placeholder="0" className={inputCls + ' pl-5 text-xs'} />
                  </div>
                </div>
              ))}
            </div>
            {totalOtherDebts > 0 && (
              <div className="mt-2 text-xs text-gray-500 text-right">Total other debts: <span className="font-semibold text-gray-700">{fmtD(totalOtherDebts)}/mo</span></div>
            )}
          </div>
        </div>

        {/* ── CENTER: Payments + Rates ── */}
        <div className="flex flex-col gap-4">
          {/* Payment breakdown */}
          <div className={cardCls}>
            <SectionLabel>Monthly Payment — {activeRow.rate.toFixed(3)}%</SectionLabel>
            <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5 mb-2">
              {[{ val: activeRow.pi, color: '#2E6BA8' }, { val: monthlyTaxes, color: '#f59e0b' }, { val: monthlyInsurance, color: '#10b981' }, { val: monthlyHoa, color: '#8b5cf6' }].map(({ val, color }, i) => (
                <div key={i} style={{ width: (val / activeRow.pitia * 100).toFixed(1) + '%', background: color }}
                  className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-300" />
              ))}
            </div>
            <div className="flex flex-wrap gap-3 mb-4">
              {[{ color: '#2E6BA8', label: 'P&I' }, { color: '#f59e0b', label: 'Taxes' }, { color: '#10b981', label: 'Insurance' },
                ...(monthlyHoa > 0 ? [{ color: '#8b5cf6', label: 'HOA' }] : [])].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5 text-[11px] text-gray-500">
                  <div className="w-2 h-2 rounded-full" style={{ background: color }} />{label}
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {[{ dot: '#2E6BA8', label: 'Principal & Interest', val: fmtD(activeRow.pi) + '/mo' },
                { dot: '#f59e0b', label: 'Property Taxes', val: fmtD(monthlyTaxes) + '/mo' },
                { dot: '#10b981', label: 'Insurance', val: fmtD(monthlyInsurance) + '/mo' },
                ...(monthlyHoa > 0 ? [{ dot: '#8b5cf6', label: 'HOA', val: fmtD(monthlyHoa) + '/mo' }] : []),
              ].map(({ dot, label, val }) => (
                <div key={label} className="flex justify-between items-center py-2 border-b border-gray-50 text-sm">
                  <div className="flex items-center gap-2 text-gray-600"><div className="w-2 h-2 rounded-full" style={{ background: dot }} />{label}</div>
                  <span className="font-semibold text-gray-900 tabular-nums">{val}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 bg-brand/5 border border-brand/10 rounded-xl px-4 py-3 flex justify-between items-center">
              <div>
                <div className="text-xs font-bold text-brand uppercase tracking-wider">Total Monthly (PITIA)</div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  DTI: <span className={`font-bold ${activeRow.dti <= 43 ? 'text-green-600' : activeRow.dti <= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                    {activeRow.dti.toFixed(1)}%
                  </span> ({fmtD(activeRow.pitia + totalOtherDebts)} obligations ÷ {fmtD(monthlyQualIncome)} income)
                </div>
              </div>
              <span className="text-2xl font-bold text-brand tabular-nums">{fmtD(activeRow.pitia)}</span>
            </div>
          </div>

          {/* Rate table */}
          <div className={cardCls}>
            <SectionLabel>Rate Options · Rocket Pro NQM 30yr · 30-Day Lock</SectionLabel>
            <p className="text-[11px] text-gray-400 mb-3">Click any row to update the payment breakdown and DTI gauge.</p>
            {!isEligible ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 font-medium">
                This FICO/LTV combination is not eligible for the Rocket NQM program. Try increasing the down payment or check FICO requirements.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-100">
                      {['Rate', 'P&I', 'PITIA', 'DTI', 'Override Pts', 'Points', 'Net Cost'].map(h => (
                        <th key={h} className="text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider py-2 px-2 first:pl-0">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let shown50 = false, shown43 = false;
                      return displayRows.map(row => {
                        const markers = [];
                        if (!shown43 && row.dti > 43) { shown43 = true; markers.push(
                          <tr key="dti43"><td colSpan={7} className="bg-amber-50 text-amber-700 text-[11px] font-semibold px-2 py-1.5 border-y border-amber-200">
                            ▲ DTI 43% — preferred threshold
                          </td></tr>); }
                        if (!shown50 && row.dti > 50) { shown50 = true; markers.push(
                          <tr key="dti50"><td colSpan={7} className="bg-red-50 text-red-600 text-[11px] font-semibold px-2 py-1.5 border-y border-red-200">
                            ▲ DTI 50% maximum — rates below this line exceed max DTI
                          </td></tr>); }
                        const isPar = row.rate === parRow.rate;
                        const isSelected = row.rate === selectedRate;
                        const ptsDiff = row.netPrice - 100;
                        const isCredit = ptsDiff >= 0;
                        return [...markers,
                          <tr key={row.rate} onClick={() => setSelectedRate(row.rate)}
                            className={`cursor-pointer transition-colors border-b border-gray-50 ${isSelected ? 'bg-brand/5' : isPar ? 'bg-green-50/50' : 'hover:bg-gray-50'}`}>
                            <td className="py-2.5 px-2 pl-0">
                              <span className="font-bold text-gray-900 tabular-nums">{row.rate.toFixed(3)}%</span>
                              {isPar && <span className="ml-1 text-green-600 text-[10px] font-bold">★ par</span>}
                            </td>
                            <td className="py-2.5 px-2 tabular-nums text-gray-700">{fmtD(row.pi)}</td>
                            <td className="py-2.5 px-2 tabular-nums text-gray-700">{fmtD(row.pitia)}</td>
                            <td className="py-2.5 px-2">
                              <span className={`font-bold tabular-nums ${row.dti <= 43 ? 'text-green-600' : row.dti <= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                                {row.dti.toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-1 px-1" onClick={e => e.stopPropagation()}>
                              <input type="number" step={0.125}
                                value={manualPtsOverride[row.rate] ?? ''}
                                onChange={e => setManualPtsOverride(prev => ({ ...prev, [row.rate]: e.target.value }))}
                                placeholder="auto"
                                className="w-16 border border-gray-200 rounded px-1.5 py-1 text-xs text-center tabular-nums bg-white focus:border-brand focus:ring-1 focus:ring-brand/10 outline-none" />
                            </td>
                            <td className="py-2.5 px-2">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-md tabular-nums ${row.hasOverride ? 'bg-blue-50 text-blue-700' : isCredit ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                                {fmtPts(ptsDiff)}
                              </span>
                            </td>
                            <td className="py-2.5 px-2">
                              <span className={`font-semibold tabular-nums text-sm ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                                {isCredit ? fmtD(row.netDollar) + ' rebate' : fmtD(Math.abs(row.netDollar)) + ' cost'}
                              </span>
                            </td>
                          </tr>];
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-[11px] text-gray-400 mt-3">★ = closest to par after comp and adjustments. Rebate = credit toward closing costs.</p>
          </div>

          {/* Pricing math */}
          <div className={cardCls}>
            <SectionLabel>Pricing Math — {activeRow.rate.toFixed(3)}%</SectionLabel>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Base price (rate sheet)', val: activeRow.base.toFixed(4), color: 'text-gray-700' },
                { label: `FICO/LTV adj (${fico} / ${ltv.toFixed(0)}%)`, val: fmtPts(ficoLtvAdj || 0), color: (ficoLtvAdj || 0) >= 0 ? 'text-red-500' : 'text-green-600' },
                { label: 'Bank statement adj', val: fmtPts(bankStmtAdj), color: 'text-red-500' },
                ...(propAdj !== 0 ? [{ label: `Property type (${propertyType})`, val: fmtPts(propAdj), color: 'text-red-500' }] : []),
                ...(purpAdj !== 0 ? [{ label: `Purpose (${purpose})`, val: fmtPts(purpAdj), color: 'text-red-500' }] : []),
                { label: `Loan amount adj (${fmtD(loanAmount)})`, val: fmtPts(loanAmtAdj), color: loanAmtAdj >= 0 ? 'text-red-500' : 'text-green-600' },
                ...(activeRow.dtiAdj > 0 ? [{ label: `DTI 45-50% adj`, val: fmtPts(activeRow.dtiAdj), color: 'text-red-500' }] : []),
                { label: 'Adj price (capped at ' + MAX_PREMIUM_CAP.toFixed(3) + ')', val: activeRow.adjPrice.toFixed(4), color: 'text-gray-900 font-semibold' },
                { label: `Broker comp (${fmtD(compDollar)} / ${fmtD(loanAmount)})`, val: '−' + compPts.toFixed(3) + ' pts', color: 'text-red-500' },
              ].map(({ label, val, color }) => (
                <div key={label} className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-gray-500">{label}</span>
                  <span className={`tabular-nums font-medium ${color}`}>{val}</span>
                </div>
              ))}
              <div className="flex justify-between items-center pt-2">
                <span className="font-bold text-gray-900">Net price → {activeRow.netDollar >= 0 ? 'Rebate to borrower' : 'Discount (borrower pays)'}</span>
                <span className={`font-bold tabular-nums text-base ${activeRow.netDollar >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {activeRow.netPrice.toFixed(4)} → {activeRow.netDollar >= 0 ? fmtD(activeRow.netDollar) : fmtD(Math.abs(activeRow.netDollar))}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 mt-3">Comp: 2% capped at {fmtD(compCap)} ({purpose}). Premium cap: {MAX_PREMIUM_CAP.toFixed(3)}.</p>
          </div>
        </div>

        {/* ── RIGHT: Gauge + Summary ── */}
        <div className="flex flex-col gap-4">
          <div className={cardCls + ' text-center'}>
            <DTIGauge dti={activeRow.dti} />
            <div className="text-[11px] text-gray-400 mt-1 border-t border-gray-100 pt-2">
              <span className="font-semibold text-brand tabular-nums">{fmtD(activeRow.pitia + totalOtherDebts)}</span>
              <span className="text-gray-300 mx-1">÷</span>
              <span className="font-semibold text-brand tabular-nums">{fmtD(monthlyQualIncome)}</span>
            </div>
          </div>

          <div className={cardCls}>
            <SectionLabel>Scenario</SectionLabel>
            <div className="grid grid-cols-2 gap-1.5">
              {[['LTV', ltv.toFixed(1) + '%'], ['DTI', activeRow.dti.toFixed(1) + '%'], ['FICO', fico], ['Property', propertyType.toUpperCase()], ['State', state], ['Purpose', purpose === 'purchase' ? 'Purchase' : purpose === 'refinance' ? 'Refi' : 'Cash-Out']].map(([label, value]) => (
                <div key={label} className="bg-brand/10 border border-brand/10 rounded-lg px-2 py-1.5">
                  <div className="text-[9px] font-bold text-brand uppercase tracking-wider">{label}</div>
                  <div className="text-sm font-semibold text-gray-900 tabular-nums">{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className={tightCardCls}>
            <SectionLabel>Income Summary</SectionLabel>
            <div className="text-center space-y-1">
              <div className="text-sm font-bold text-gray-900 tabular-nums">{fmtD(monthlyDeposits)}/mo deposits</div>
              {statementType === 'business' && <div className="text-xs text-gray-400">× {100 - expensePct}% net of expenses</div>}
              <div className="text-lg font-bold text-go tabular-nums">{fmtD(monthlyQualIncome)}/mo</div>
              <div className="text-[11px] text-gray-400">{fmtD(annualQualIncome)}/yr qualifying</div>
            </div>
          </div>

          <div className={cardCls}>
            <SectionLabel>Generate Quote</SectionLabel>
            <div className="mb-2">
              <input type="text" value={borrowerName} onChange={e => setBorrowerName(e.target.value)}
                placeholder="Borrower name for PDF" className={inputCls + ' text-xs'} />
            </div>
            <button onClick={handleDownloadPDF} disabled={pdfLoading || !isEligible}
              className="w-full bg-go text-white rounded-nr-md py-2.5 font-bold text-sm hover:bg-go-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {pdfLoading ? 'Generating...' : 'Download PDF'}
            </button>
          </div>

          <div className={cardCls}>
            <SectionLabel>Eligibility</SectionLabel>
            <ul className="space-y-2">
              {guidelines.map((g, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <span className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${g.pass ? 'bg-green-100 text-green-700' : g.warn ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                    {g.pass ? '\u2713' : g.warn ? '!' : '\u2717'}
                  </span>
                  <span className="text-gray-600 leading-tight">{g.text}</span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-gray-400 mt-3">Rocket Pro NQM · {SHEET_DATE}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
