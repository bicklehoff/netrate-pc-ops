'use client';

import { useState } from 'react';

// ── Helpers ──
function fmtD(n) { return '$' + Math.round(n).toLocaleString(); }
function fmtD2(n) { return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

const NMLS_CO = '1111861';
const NMLS_MLO = '641790';

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

// ── Income Gauge ──
function IncomeGauge({ monthly }) {
  const cx = 100, cy = 90, r = 72;
  const arcLen = Math.PI * r;
  // Scale: 0 = $0, 1.0 = $25,000/mo
  const fillPct = Math.min(1, Math.max(0, monthly / 25000));
  const fillLen = fillPct * arcLen;
  const color = monthly >= 10000 ? '#059669' : monthly >= 5000 ? '#d97706' : '#dc2626';
  const status = monthly >= 15000 ? 'Strong' : monthly >= 10000 ? 'Good' : monthly >= 5000 ? 'Moderate' : 'Low';

  const arcPoint = (f, radius) => {
    const theta = (1 - f) * Math.PI;
    return { x: cx + radius * Math.cos(theta), y: cy - radius * Math.sin(theta) };
  };
  const ticks = [0.20, 0.40, 0.60];

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
      <text x={cx} y={cy - 18} textAnchor="middle" fontSize="28" fontWeight="700"
        fill={color} fontFamily="Inter,sans-serif" style={{ transition: 'fill 0.3s ease' }}>
        {fmtD(monthly)}
      </text>
      <text x={cx} y={cy + 2} textAnchor="middle" fontSize="9" fontWeight="600"
        fill="#9ca3af" fontFamily="Inter,sans-serif" letterSpacing="2">MONTHLY INCOME</text>
      <text x={cx} y={cy + 17} textAnchor="middle" fontSize="11" fontWeight="600"
        fill={color} fontFamily="Inter,sans-serif" style={{ transition: 'fill 0.3s ease' }}>{status}</text>
    </svg>
  );
}

// ── Deposit Trend Chart ──
function DepositTrendChart({ deposits, monthCount }) {
  const active = deposits.slice(0, monthCount);
  const nets = active.map(d => d.amount - d.excluded);
  const maxVal = Math.max(...nets, 1);
  const avg = nets.reduce((a, b) => a + b, 0) / monthCount;
  const w = 400, h = 120, pad = 4;
  const barW = (w - pad * 2) / monthCount - 2;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      {/* Avg line */}
      <line x1={pad} y1={h - (avg / maxVal) * (h - 20) - 10} x2={w - pad} y2={h - (avg / maxVal) * (h - 20) - 10}
        stroke="#2E6BA8" strokeWidth="1" strokeDasharray="4 3" opacity="0.5" />
      <text x={w - pad - 2} y={h - (avg / maxVal) * (h - 20) - 14} textAnchor="end"
        fontSize="8" fill="#2E6BA8" fontFamily="Inter,sans-serif" opacity="0.7">avg</text>
      {nets.map((val, i) => {
        const barH = Math.max(2, (val / maxVal) * (h - 24));
        const x = pad + i * ((w - pad * 2) / monthCount) + 1;
        const y = h - barH - 10;
        const isAboveAvg = val >= avg;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx="2"
              fill={isAboveAvg ? '#059669' : '#2E6BA8'} opacity={val > 0 ? 0.7 : 0.15} />
            <text x={x + barW / 2} y={h - 1} textAnchor="middle" fontSize="7"
              fill="#9ca3af" fontFamily="Inter,sans-serif">{i + 1}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── PDF Component (react-pdf/renderer) ──
function BankStatementPDF({ borrowerName, businessName, statementType, months, deposits, expensePct, hasCpaLetter, Document, Page, View, Text, StyleSheet }) {
  const BRAND = '#2E6BA8';
  const BRAND_DARK = '#24578C';
  const GO = '#059669';
  const INK = '#1A1F2E';
  const INK_MID = '#4A5C6E';
  const INK_SUBTLE = '#7A8E9E';
  const SURFACE = '#F5F4F1';
  const SURFACE_LOW = '#f2f4f6';
  const WHITE = '#ffffff';
  const ACCENT = '#FFC220';

  const s = StyleSheet.create({
    page: { padding: 40, fontFamily: 'Helvetica', fontSize: 9, color: INK, backgroundColor: WHITE },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: INK_SUBTLE + '30', marginBottom: 16 },
    logoBlock: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    logoIcon: { width: 28, height: 28, backgroundColor: BRAND, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
    logoIconText: { fontFamily: 'Helvetica-Bold', fontSize: 15, color: WHITE, textAlign: 'center', marginTop: 3 },
    companyName: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: BRAND_DARK },
    subtitle: { fontSize: 7, letterSpacing: 2, textTransform: 'uppercase', color: INK_SUBTLE, marginTop: 1 },
    headerDetail: { fontSize: 8, color: INK_SUBTLE, marginTop: 1 },
    badge: { backgroundColor: SURFACE_LOW, borderRadius: 10, paddingVertical: 3, paddingHorizontal: 10 },
    badgeText: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: INK_SUBTLE, textTransform: 'uppercase', letterSpacing: 1 },
    infoBar: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    cardRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    card: { flex: 1, backgroundColor: SURFACE_LOW, borderRadius: 8, padding: 12 },
    cardLabel: { fontSize: 7, textTransform: 'uppercase', letterSpacing: 1.5, color: INK_SUBTLE, marginBottom: 2 },
    cardValue: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: INK },
    cardValueGreen: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: GO },
    sectionTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: BRAND_DARK, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 6, marginTop: 14 },
    tableHeader: { flexDirection: 'row', backgroundColor: SURFACE_LOW, borderRadius: 6, paddingVertical: 5, paddingHorizontal: 8, marginBottom: 2 },
    tableRow: { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 8 },
    tableRowAlt: { backgroundColor: SURFACE },
    calcRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: SURFACE_LOW },
    calcLabel: { fontSize: 9, color: INK_MID },
    calcValue: { fontSize: 9.5, fontFamily: 'Helvetica-Bold', color: INK },
    totalBar: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: GO, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginTop: 8 },
    totalLabel: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: WHITE },
    totalValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: WHITE },
    footer: { position: 'absolute', bottom: 24, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 0.5, borderTopColor: INK_SUBTLE + '30', paddingTop: 6 },
    footerText: { fontSize: 7, color: INK_SUBTLE },
    disclaimer: { fontSize: 7, color: INK_SUBTLE, lineHeight: 1.5, marginTop: 12 },
    accentBar: { width: 3, backgroundColor: ACCENT, borderRadius: 2, marginRight: 6 },
  });

  const nets = deposits.map(d => d.amount - d.excluded);
  const totalNet = nets.reduce((a, b) => a + b, 0);
  const avgMonthly = months > 0 ? totalNet / months : 0;
  const expRate = statementType === 'personal' ? 0 : expensePct / 100;
  const monthlyQual = avgMonthly * (1 - expRate);
  const annualQual = monthlyQual * 12;
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <Document>
      <Page size="LETTER" style={s.page}>
        {/* Header */}
        <View style={s.headerRow}>
          <View style={s.logoBlock}>
            <View style={s.logoIcon}><Text style={s.logoIconText}>N</Text></View>
            <View>
              <Text style={s.companyName}>NetRate Mortgage</Text>
              <Text style={s.subtitle}>Bank Statement Income Analysis</Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.headerDetail}>David Burson | NMLS #{NMLS_MLO}</Text>
            <Text style={s.headerDetail}>NetRate Mortgage LLC | NMLS #{NMLS_CO}</Text>
            <Text style={s.headerDetail}>303-444-5251 | david@netratemortgage.com</Text>
          </View>
        </View>

        {/* Info bar */}
        <View style={s.infoBar}>
          <View>
            <Text style={{ fontSize: 12, fontFamily: 'Helvetica-Bold', color: INK }}>{borrowerName || 'Borrower'}</Text>
            {businessName ? <Text style={{ fontSize: 9, color: INK_MID, marginTop: 2 }}>{businessName}</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <View style={s.badge}><Text style={s.badgeText}>{statementType} Statements | {months} Months</Text></View>
            <Text style={{ fontSize: 8, color: INK_SUBTLE, marginTop: 4 }}>Prepared {today}</Text>
          </View>
        </View>

        {/* Summary cards */}
        <View style={s.cardRow}>
          <View style={s.card}>
            <Text style={s.cardLabel}>Total Deposits</Text>
            <Text style={s.cardValue}>{fmtD(totalNet)}</Text>
          </View>
          <View style={s.card}>
            <Text style={s.cardLabel}>Avg Monthly Deposits</Text>
            <Text style={s.cardValue}>{fmtD(avgMonthly)}</Text>
          </View>
          <View style={[s.card, { borderLeftWidth: 3, borderLeftColor: GO }]}>
            <Text style={s.cardLabel}>Monthly Qualifying Income</Text>
            <Text style={s.cardValueGreen}>{fmtD(monthlyQual)}</Text>
          </View>
        </View>

        {/* Monthly deposits table */}
        <Text style={s.sectionTitle}>Monthly Deposits</Text>
        <View style={s.tableHeader}>
          <Text style={{ width: '15%', fontSize: 7, fontFamily: 'Helvetica-Bold', color: INK_SUBTLE }}>Month</Text>
          <Text style={{ width: '25%', fontSize: 7, fontFamily: 'Helvetica-Bold', color: INK_SUBTLE, textAlign: 'right' }}>Deposits</Text>
          <Text style={{ width: '25%', fontSize: 7, fontFamily: 'Helvetica-Bold', color: INK_SUBTLE, textAlign: 'right' }}>Excluded</Text>
          <Text style={{ width: '35%', fontSize: 7, fontFamily: 'Helvetica-Bold', color: INK_SUBTLE, textAlign: 'right' }}>Net Deposits</Text>
        </View>
        {deposits.map((d, i) => (
          <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
            <Text style={{ width: '15%', fontSize: 8.5, color: INK_MID }}>Mo {i + 1}</Text>
            <Text style={{ width: '25%', fontSize: 8.5, color: INK, textAlign: 'right' }}>{fmtD2(d.amount)}</Text>
            <Text style={{ width: '25%', fontSize: 8.5, color: d.excluded > 0 ? '#dc2626' : INK_SUBTLE, textAlign: 'right' }}>
              {d.excluded > 0 ? `(${fmtD2(d.excluded)})` : '-'}
            </Text>
            <Text style={{ width: '35%', fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: INK, textAlign: 'right' }}>{fmtD2(nets[i])}</Text>
          </View>
        ))}

        {/* Calculation breakdown */}
        <Text style={s.sectionTitle}>Income Calculation</Text>
        {[
          ['Total net deposits', fmtD(totalNet)],
          ['Number of months', String(months)],
          ['Average monthly deposits', fmtD(avgMonthly)],
          ...(statementType === 'business' ? [
            [`Expense deduction (${expensePct}%)${hasCpaLetter ? ' — CPA letter' : ''}`, `- ${fmtD(avgMonthly * expRate)}`],
          ] : []),
          ['Monthly qualifying income', fmtD(monthlyQual)],
        ].map(([label, val], i) => (
          <View key={i} style={s.calcRow}>
            <Text style={s.calcLabel}>{label}</Text>
            <Text style={s.calcValue}>{val}</Text>
          </View>
        ))}

        <View style={s.totalBar}>
          <Text style={s.totalLabel}>Annual Qualifying Income</Text>
          <Text style={s.totalValue}>{fmtD(annualQual)}</Text>
        </View>

        {/* Disclaimer */}
        <Text style={s.disclaimer}>
          This analysis is for estimation purposes only. Actual qualifying income may vary based on lender underwriting guidelines.
          Bank statement income calculations are subject to review of actual bank statements by the lender. Not a commitment to lend.
        </Text>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>NetRate Mortgage LLC | NMLS #{NMLS_CO} | Equal Housing Lender</Text>
          <Text style={s.footerText}>357 S McCaslin Blvd #200, Louisville, CO 80027</Text>
        </View>
      </Page>
    </Document>
  );
}


// ── Main Component ──
export default function BankStatementCalculator() {
  const [borrowerName, setBorrowerName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [statementType, setStatementType] = useState('business');
  const [monthCount, setMonthCount] = useState(12);
  const [deposits, setDeposits] = useState(() => Array(24).fill(null).map(() => ({ amount: 0, excluded: 0 })));
  const [expensePct, setExpensePct] = useState(50);
  const [hasCpaLetter, setHasCpaLetter] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const active = deposits.slice(0, monthCount);
  const nets = active.map(d => d.amount - d.excluded);
  const totalNet = nets.reduce((a, b) => a + b, 0);
  const avgMonthly = monthCount > 0 ? totalNet / monthCount : 0;
  const expRate = statementType === 'personal' ? 0 : expensePct / 100;
  const monthlyQual = avgMonthly * (1 - expRate);
  const annualQual = monthlyQual * 12;
  const filledMonths = active.filter(d => d.amount > 0).length;
  const avgNet = nets.reduce((a, b) => a + b, 0) / monthCount;

  const updateDeposit = (index, field, value) => {
    setDeposits(prev => prev.map((d, i) => i === index ? { ...d, [field]: parseFloat(value) || 0 } : d));
  };

  const clearAll = () => setDeposits(Array(24).fill(null).map(() => ({ amount: 0, excluded: 0 })));

  const fillSample = () => {
    const sample = statementType === 'business'
      ? [48237, 32706, 57732, 41767, 62803, 44630, 76309, 159869, 265515, 269890, 92301, 85000]
      : [4200, 4500, 4100, 4800, 4300, 4600, 5100, 4900, 4700, 5200, 4400, 5000];
    setDeposits(prev => prev.map((d, i) => i < sample.length ? { amount: sample[i], excluded: 0 } : d));
  };

  const handleDownloadPDF = async () => {
    setPdfLoading(true);
    try {
      const rpdf = await import('@react-pdf/renderer');
      const blob = await rpdf.pdf(
        BankStatementPDF({
          borrowerName: borrowerName || 'Borrower',
          businessName,
          statementType,
          months: monthCount,
          deposits: active,
          expensePct,
          hasCpaLetter,
          Document: rpdf.Document,
          Page: rpdf.Page,
          View: rpdf.View,
          Text: rpdf.Text,
          StyleSheet: rpdf.StyleSheet,
        })
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Bank-Statement-Income-${(borrowerName || 'Quote').replace(/\s+/g, '-')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setPdfLoading(false);
    }
  };

  // Guidelines checks
  const guidelines = [
    { pass: filledMonths === monthCount, warn: filledMonths > 0, text: `${filledMonths}/${monthCount} months entered` },
    { pass: statementType === 'business' ? expensePct >= 30 && expensePct <= 50 : true, warn: true, text: statementType === 'business' ? `${expensePct}% expense factor${hasCpaLetter ? ' (CPA letter)' : ' (standard)'}` : 'Personal — no expense deduction' },
    ...(statementType === 'business' && expensePct < 50 && !hasCpaLetter ? [{ pass: false, warn: false, text: 'CPA letter required for custom expense %' }] : []),
    ...(filledMonths > 2 ? [{
      pass: nets.filter(n => n > 0).every(n => n < avgNet * 2.5 && n > avgNet * 0.2),
      warn: true,
      text: nets.filter(n => n > 0).every(n => n < avgNet * 2.5 && n > avgNet * 0.2)
        ? 'Deposits reasonably consistent' : 'Large deposit variance — lender may request LOE'
    }] : []),
    { pass: !!borrowerName, warn: false, text: borrowerName ? `Borrower: ${borrowerName}` : 'Enter borrower name for PDF' },
  ];

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      {/* Header */}
      <div className="bg-brand border-b border-brand-dark">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <span className="text-white font-bold text-base">Bank Statement Income Calculator</span>
          <span className="bg-accent text-ink text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Non-QM</span>
          <span className="ml-auto text-white/60 text-xs hidden sm:block">AmWest Bank Statement Advantage Guidelines</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-[320px_1fr_210px] gap-5 items-start">

        {/* ── LEFT: Inputs ── */}
        <div className="flex flex-col gap-4">

          {/* Borrower info */}
          <div className={cardCls}>
            <SectionLabel>Borrower Info</SectionLabel>
            <div className="mb-3">
              <label className={labelCls}>Borrower Name</label>
              <input type="text" value={borrowerName} onChange={e => setBorrowerName(e.target.value)}
                placeholder="Cameron Hall" className={inputCls} />
            </div>
            {statementType === 'business' && (
              <div>
                <label className={labelCls}>Business Name</label>
                <input type="text" value={businessName} onChange={e => setBusinessName(e.target.value)}
                  placeholder="Shockwave Pro USA LLC" className={inputCls} />
              </div>
            )}
          </div>

          {/* Statement config */}
          <div className={cardCls}>
            <SectionLabel>Statement Configuration</SectionLabel>

            <label className={labelCls}>Statement Type</label>
            <div className="grid grid-cols-2 gap-1 mb-4">
              {['business', 'personal'].map(t => (
                <button key={t} onClick={() => setStatementType(t)}
                  className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
                    statementType === t ? 'bg-brand text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {t === 'business' ? 'Business' : 'Personal'}
                </button>
              ))}
            </div>

            <label className={labelCls}>Number of Months</label>
            <div className="grid grid-cols-2 gap-1 mb-4">
              {[12, 24].map(m => (
                <button key={m} onClick={() => setMonthCount(m)}
                  className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
                    monthCount === m ? 'bg-brand text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {m} Months
                </button>
              ))}
            </div>

            {statementType === 'business' && (
              <>
                <label className={labelCls}>Expense Factor</label>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xl font-bold text-brand tabular-nums">{expensePct}%</span>
                  <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                    <input type="checkbox" checked={hasCpaLetter}
                      onChange={e => { setHasCpaLetter(e.target.checked); if (!e.target.checked) setExpensePct(50); }}
                      className="rounded border-gray-300 text-brand focus:ring-brand" />
                    CPA Letter
                  </label>
                </div>
                <input type="range" min={hasCpaLetter ? 30 : 50} max={70} step={5} value={expensePct}
                  onChange={e => setExpensePct(+e.target.value)}
                  disabled={!hasCpaLetter}
                  className="w-full h-1.5 rounded-full outline-none cursor-pointer appearance-none
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
                    [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-brand
                    [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer
                    disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: `linear-gradient(to right, #2E6BA8 0%, #2E6BA8 ${((expensePct - 30) / 40 * 100)}%, #e5e7eb ${((expensePct - 30) / 40 * 100)}%, #e5e7eb 100%)`
                  }} />
                <div className="flex justify-between text-[11px] text-gray-400 mt-1">
                  <span>{hasCpaLetter ? '30% (min w/ CPA)' : '50% (standard)'}</span>
                  <span>70%</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-2">
                  {hasCpaLetter ? 'CPA letter on file — custom expense ratio' : 'Standard 50% deduction. Check "CPA Letter" to adjust.'}
                </p>
              </>
            )}
            {statementType === 'personal' && (
              <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500">
                No expense deduction on personal statements
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className={tightCardCls}>
            <div className="flex gap-2">
              <button onClick={fillSample}
                className="flex-1 text-xs font-semibold text-brand bg-brand/5 border border-brand/10 rounded-lg py-2 hover:bg-brand/10 transition-colors">
                Fill Sample
              </button>
              <button onClick={clearAll}
                className="flex-1 text-xs font-semibold text-gray-500 bg-gray-50 border border-gray-200 rounded-lg py-2 hover:bg-gray-100 transition-colors">
                Clear All
              </button>
            </div>
          </div>
        </div>

        {/* ── CENTER: Deposits & Results ── */}
        <div className="flex flex-col gap-4">

          {/* Monthly deposits table */}
          <div className={cardCls}>
            <SectionLabel>Monthly Deposits</SectionLabel>
            <p className="text-[11px] text-gray-400 mb-3">Enter total deposits from each statement. Use &quot;Exclude&quot; for transfers, personal infusions, or non-business deposits.</p>

            <div className={monthCount === 24 ? 'grid grid-cols-1 xl:grid-cols-2 gap-4' : ''}>
              {[0, ...(monthCount === 24 ? [12] : [])].map(offset => (
                <div key={offset}>
                  {/* Table header */}
                  <div className="grid grid-cols-[50px_1fr_1fr_1fr] gap-1 mb-1">
                    <span className="text-[10px] font-semibold text-gray-400 uppercase">Mo</span>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase text-right">Deposits</span>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase text-right">Exclude</span>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase text-right">Net</span>
                  </div>
                  {Array.from({ length: Math.min(12, monthCount - offset) }, (_, i) => i + offset).map(idx => {
                    const net = deposits[idx].amount - deposits[idx].excluded;
                    return (
                      <div key={idx} className={`grid grid-cols-[50px_1fr_1fr_1fr] gap-1 items-center py-1 ${idx % 2 === 0 ? '' : 'bg-gray-50/50 rounded'}`}>
                        <span className="text-xs text-gray-500 font-medium tabular-nums">{idx + 1}</span>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                          <input type="number" value={deposits[idx].amount || ''}
                            onChange={e => updateDeposit(idx, 'amount', e.target.value)}
                            placeholder="0"
                            className="w-full border border-gray-200 rounded px-2 py-1.5 pl-5 text-xs text-right bg-white focus:border-brand focus:ring-1 focus:ring-brand/10 outline-none tabular-nums" />
                        </div>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">$</span>
                          <input type="number" value={deposits[idx].excluded || ''}
                            onChange={e => updateDeposit(idx, 'excluded', e.target.value)}
                            placeholder="0"
                            className="w-full border border-gray-200 rounded px-2 py-1.5 pl-5 text-xs text-right bg-white focus:border-red-400 focus:ring-1 focus:ring-red-400/10 outline-none tabular-nums" />
                        </div>
                        <span className={`text-xs font-semibold text-right tabular-nums ${net > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                          {fmtD(net)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="mt-3 pt-3 border-t border-gray-200 grid grid-cols-[50px_1fr_1fr_1fr] gap-1 items-center">
              <span className="text-xs font-bold text-gray-700">Total</span>
              <span className="text-xs font-bold text-right tabular-nums text-gray-700">
                {fmtD(active.reduce((s, d) => s + d.amount, 0))}
              </span>
              <span className="text-xs font-bold text-right tabular-nums text-red-500">
                {active.reduce((s, d) => s + d.excluded, 0) > 0 ? `(${fmtD(active.reduce((s, d) => s + d.excluded, 0))})` : '-'}
              </span>
              <span className="text-xs font-bold text-right tabular-nums text-gray-900">{fmtD(totalNet)}</span>
            </div>
          </div>

          {/* Deposit trend chart */}
          {filledMonths > 0 && (
            <div className={tightCardCls}>
              <SectionLabel>Deposit Trend</SectionLabel>
              <DepositTrendChart deposits={deposits} monthCount={monthCount} />
              <div className="flex justify-between text-[11px] text-gray-400 mt-1">
                <span>Month 1</span>
                <span className="text-brand font-medium">Avg: {fmtD(avgNet)}/mo</span>
                <span>Month {monthCount}</span>
              </div>
            </div>
          )}

          {/* Income calculation breakdown */}
          <div className={cardCls}>
            <SectionLabel>Income Calculation</SectionLabel>
            <div className="space-y-2 text-sm">
              {[
                { label: `Total net deposits (${monthCount} months)`, val: fmtD(totalNet), color: 'text-gray-700' },
                { label: 'Number of months', val: String(monthCount), color: 'text-gray-700' },
                { label: 'Average monthly deposits', val: fmtD(avgMonthly), color: 'text-gray-900 font-semibold' },
                ...(statementType === 'business' ? [
                  { label: `Expense deduction (${expensePct}%)${hasCpaLetter ? ' — CPA letter' : ''}`, val: `- ${fmtD(avgMonthly * expRate)}`, color: 'text-red-500' },
                ] : []),
                { label: 'Monthly qualifying income', val: fmtD(monthlyQual), color: 'text-brand font-bold' },
              ].map(({ label, val, color }) => (
                <div key={label} className="flex justify-between items-center py-2 border-b border-gray-50">
                  <span className="text-gray-500">{label}</span>
                  <span className={`tabular-nums font-medium ${color}`}>{val}</span>
                </div>
              ))}
            </div>

            <div className="mt-3 bg-go/5 border border-go/10 rounded-xl px-4 py-3 flex justify-between items-center">
              <div>
                <div className="text-xs font-bold text-go uppercase tracking-wider">Annual Qualifying Income</div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  {fmtD(avgMonthly)} avg deposits {statementType === 'business' ? `x ${(100 - expensePct)}% net` : ''} x 12
                </div>
              </div>
              <span className="text-2xl font-bold text-go tabular-nums">{fmtD(annualQual)}</span>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Gauge + Summary ── */}
        <div className="flex flex-col gap-4">

          {/* Income Gauge */}
          <div className={cardCls + ' text-center'}>
            <IncomeGauge monthly={monthlyQual} />
            <div className="text-[11px] text-gray-400 mt-1 border-t border-gray-100 pt-2">
              <span className="font-semibold text-brand tabular-nums">{fmtD(avgMonthly)}</span>
              {statementType === 'business' && (
                <>
                  <span className="text-gray-300 mx-1">x</span>
                  <span className="font-semibold text-brand tabular-nums">{100 - expensePct}%</span>
                </>
              )}
            </div>
          </div>

          {/* Scenario chips */}
          <div className={cardCls}>
            <SectionLabel>Scenario</SectionLabel>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                ['Type', statementType === 'business' ? 'Business' : 'Personal'],
                ['Months', monthCount],
                ['Expense', statementType === 'business' ? expensePct + '%' : 'N/A'],
                ['CPA Letter', hasCpaLetter ? 'Yes' : 'No'],
                ['Filled', `${filledMonths}/${monthCount}`],
                ['Annual', fmtD(annualQual)],
              ].map(([label, value]) => (
                <div key={label} className="bg-brand/10 border border-brand/10 rounded-lg px-2 py-1.5">
                  <div className="text-[9px] font-bold text-brand uppercase tracking-wider">{label}</div>
                  <div className="text-sm font-semibold text-gray-900 tabular-nums">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Download PDF */}
          <div className={cardCls}>
            <SectionLabel>Generate Quote</SectionLabel>
            {borrowerName && (
              <p className="text-xs text-gray-500 mb-2">For: <span className="font-semibold text-gray-700">{borrowerName}</span></p>
            )}
            <button onClick={handleDownloadPDF} disabled={pdfLoading || filledMonths === 0}
              className="w-full bg-go text-white rounded-nr-md py-2.5 font-bold text-sm hover:bg-go-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {pdfLoading ? 'Generating...' : 'Download PDF'}
            </button>
            {filledMonths === 0 && (
              <p className="text-[11px] text-gray-400 mt-2 text-center">Enter deposits to enable PDF</p>
            )}
          </div>

          {/* Guidelines */}
          <div className={cardCls}>
            <SectionLabel>Guidelines Check</SectionLabel>
            <ul className="space-y-2">
              {guidelines.map((g, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <span className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
                    g.pass ? 'bg-green-100 text-green-700' : g.warn ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'
                  }`}>
                    {g.pass ? '\u2713' : g.warn ? '!' : '\u2717'}
                  </span>
                  <span className="text-gray-600 leading-tight">{g.text}</span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-gray-400 mt-3">AmWest Bank Statement Advantage</p>
          </div>

        </div>
      </div>
    </div>
  );
}
