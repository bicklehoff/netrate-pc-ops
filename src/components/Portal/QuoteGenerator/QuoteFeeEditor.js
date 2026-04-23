'use client';

import { useState } from 'react';
import { calculateEscrowSections } from '@/lib/quotes/escrow-calc';

const PRESET_CREDITS = [
  { label: 'Realtor Commission Credit', amount: 0 },
  { label: 'Seller Credit', amount: 0 },
  { label: 'Tax Prorate Credit', amount: 0 },
];

export default function QuoteFeeEditor({ fees, onFeesChange, selectedRates, scenario, quoteId, onSaveDraft, loading, onSendToBorrower, onPreviewPDF, escrowsWaived }) {
  const [expanded, setExpanded] = useState({});
  const [showEscrowDetail, setShowEscrowDetail] = useState(true);

  const state = scenario?.state || 'CO';
  const isPurchase = scenario?.purpose === 'purchase';
  const isTX = state === 'TX';
  const isEscrowing = !escrowsWaived;

  // ── Escrow inputs (escrow election is now on page 1 via escrowsWaived) ─────
  const [fundingDate,    setFundingDate]    = useState(() => fees?.funding_date || scenario?.funding_date || scenario?.closing_date || '');
  const [annualTaxes,    setAnnualTaxes]    = useState(() => fees?.annualTaxes ?? 0);
  const [annualIns,      setAnnualIns]      = useState(() => fees?.annualInsurance ?? 0);
  const [hoiDate,        setHoiDate]        = useState(() => {
    if (fees?.hoiEffectiveDate) return fees.hoiEffectiveDate;
    if (isPurchase) return fees?.funding_date || scenario?.funding_date || scenario?.closing_date || '';
    return '';
  });
  const [hasFlood,       setHasFlood]       = useState(() => fees?.hasFlood ?? false);
  const [annualFlood,    setAnnualFlood]     = useState(() => fees?.annualFlood ?? 0);
  const [hasMud,         setHasMud]         = useState(() => fees?.hasMud ?? false);
  const [annualMud,      setAnnualMud]       = useState(() => fees?.annualMud ?? 0);
  const [hasHailWind,    setHasHailWind]    = useState(() => fees?.hasHailWind ?? false);
  const [annualHailWind, setAnnualHailWind] = useState(() => fees?.annualHailWind ?? 0);
  const [dueDateOverrides, setDueDateOverrides] = useState(() => fees?.dueDateOverrides || {});

  const [escrowDetail, setEscrowDetail] = useState(() => fees?.escrowCalc || null);
  const firstPaymentDateStr = fees?.firstPaymentDateStr || escrowDetail?.firstPaymentDateStr || '';
  const isInterestCredit    = fees?.isInterestCredit    ?? escrowDetail?.isInterestCredit    ?? false;

  // ── Credits (realtor, seller, tax prorate, custom) ────────────────────────
  const [credits, setCredits] = useState(() => fees?.credits || []);
  const [showCreditAdd, setShowCreditAdd] = useState(false);
  const [newCreditLabel, setNewCreditLabel] = useState('');
  const [newCreditAmount, setNewCreditAmount] = useState('');

  // ── Fee section add/remove ─────────────────────────────────────────────────
  const [addingToSection, setAddingToSection] = useState(null);
  const [newFeeLabel, setNewFeeLabel] = useState('');
  const [newFeeAmount, setNewFeeAmount] = useState('');

  // ── Rebuild Sections F + G on escrow input change ─────────────────────────
  const rebuildEscrow = ({
    funding  = fundingDate,
    taxes    = annualTaxes,
    ins      = annualIns,
    hoi      = hoiDate,
    flood    = hasFlood,  floodAmt = annualFlood,
    mud      = hasMud,    mudAmt   = annualMud,
    hw       = hasHailWind, hwAmt  = annualHailWind,
    dueDates = dueDateOverrides,
  } = {}) => {
    if (!fees) return;
    const escrow = calculateEscrowSections({
      funding_date: funding,
      loan_amount: Number(scenario?.loan_amount) || 0,
      annualRate: Number(selectedRates[0]?.rate) || 0,
      state, purpose: scenario?.purpose || 'purchase',
      isEscrowing,
      annualTaxes: taxes, annualInsurance: ins,
      hoiEffectiveDate: hoi || null,
      hasFlood: flood,    annualFlood: floodAmt,
      hasMud: mud,        annualMud: mudAmt,
      hasHailWind: hw,    annualHailWind: hwAmt,
      overrideDueDates: dueDates,
    });
    setEscrowDetail(escrow);
    const sF = { label: 'Prepaid Items',   items: escrow.sectionFItems, total: escrow.sectionFItems.reduce((s,i)=>s+i.amount,0) };
    const sG = { label: 'Initial Escrow',  items: escrow.sectionGItems, total: escrow.sectionGItems.reduce((s,i)=>s+i.amount,0) };
    const updated = {
      ...fees, sectionF: sF, sectionG: sG,
      monthlyTax: escrow.escrowMonthly.taxes,
      monthlyInsurance: escrow.escrowMonthly.insurance,
      isEscrowing, funding_date: funding,
      firstPaymentDateStr: escrow.firstPaymentDateStr,
      isInterestCredit: escrow.isInterestCredit,
      annualTaxes: taxes, annualInsurance: ins, hoiEffectiveDate: hoi || null,
      hasFlood: flood, annualFlood: floodAmt,
      hasMud: mud,     annualMud: mudAmt,
      hasHailWind: hw, annualHailWind: hwAmt,
      dueDateOverrides: dueDates, escrowCalc: escrow,
    };
    updated.sectionD = ['sectionA','sectionB','sectionC'].reduce((s,k) => s + (updated[k]?.total||0), 0);
    updated.sectionI = ['sectionE','sectionF','sectionG','sectionH'].reduce((s,k) => s + (updated[k]?.total||0), 0);
    updated.totalClosingCosts = updated.sectionD + updated.sectionI;
    onFeesChange(updated);
  };

  const updateDueDate = (key, v) => {
    const d = { ...dueDateOverrides, [key]: v };
    setDueDateOverrides(d);
    rebuildEscrow({ dueDates: d });
  };

  // ── Fee section helpers ───────────────────────────────────────────────────
  const toggle = (section) => setExpanded(prev => ({ ...prev, [section]: !prev[section] }));

  const updateItem = (sectionKey, idx, newAmount) => {
    const updated = { ...fees };
    const section = { ...updated[sectionKey], items: [...updated[sectionKey].items] };
    section.items[idx] = { ...section.items[idx], amount: Number(newAmount) || 0 };
    section.total = section.items.reduce((s,i) => s + i.amount, 0);
    updated[sectionKey] = section;
    updated.sectionD = ['sectionA','sectionB','sectionC'].reduce((s,k) => s + (updated[k]?.total||0), 0);
    updated.sectionI = ['sectionE','sectionF','sectionG','sectionH'].reduce((s,k) => s + (updated[k]?.total||0), 0);
    updated.totalClosingCosts = updated.sectionD + updated.sectionI;
    onFeesChange(updated);
  };

  const removeItem = (sectionKey, idx) => {
    const updated = { ...fees };
    const section = { ...updated[sectionKey], items: updated[sectionKey].items.filter((_,i) => i !== idx) };
    section.total = section.items.reduce((s,i) => s + i.amount, 0);
    updated[sectionKey] = section;
    updated.sectionD = ['sectionA','sectionB','sectionC'].reduce((s,k) => s + (updated[k]?.total||0), 0);
    updated.sectionI = ['sectionE','sectionF','sectionG','sectionH'].reduce((s,k) => s + (updated[k]?.total||0), 0);
    updated.totalClosingCosts = updated.sectionD + updated.sectionI;
    onFeesChange(updated);
  };

  const addItem = (sectionKey) => {
    if (!newFeeLabel.trim()) return;
    const updated = { ...fees };
    const section = { ...updated[sectionKey], items: [...updated[sectionKey].items, { label: newFeeLabel.trim(), amount: Number(newFeeAmount) || 0 }] };
    section.total = section.items.reduce((s,i) => s + i.amount, 0);
    updated[sectionKey] = section;
    updated.sectionD = ['sectionA','sectionB','sectionC'].reduce((s,k) => s + (updated[k]?.total||0), 0);
    updated.sectionI = ['sectionE','sectionF','sectionG','sectionH'].reduce((s,k) => s + (updated[k]?.total||0), 0);
    updated.totalClosingCosts = updated.sectionD + updated.sectionI;
    onFeesChange(updated);
    setNewFeeLabel(''); setNewFeeAmount(''); setAddingToSection(null);
  };

  // ── Credits helpers ────────────────────────────────────────────────────────
  const addCredit = (label, amount) => {
    const c = [...credits, { label, amount: Number(amount) || 0 }];
    setCredits(c);
    onFeesChange({ ...fees, credits: c });
    setNewCreditLabel(''); setNewCreditAmount(''); setShowCreditAdd(false);
  };
  const updateCredit = (idx, field, val) => {
    const c = credits.map((cr,i) => i === idx ? { ...cr, [field]: field === 'amount' ? Number(val)||0 : val } : cr);
    setCredits(c);
    onFeesChange({ ...fees, credits: c });
  };
  const removeCredit = (idx) => {
    const c = credits.filter((_,i) => i !== idx);
    setCredits(c);
    onFeesChange({ ...fees, credits: c });
  };

  const creditTotal = credits.reduce((s,c) => s + (c.amount || 0), 0);

  // ── Payment / CTC calcs ────────────────────────────────────────────────────
  const loanAmount = Number(scenario?.loan_amount) || 0;
  const downPayment = isPurchase ? (Number(scenario?.property_value)||0) - loanAmount : 0;
  const fixedFees = ['sectionA','sectionB','sectionC','sectionE','sectionG','sectionH']
    .reduce((s,k) => s + (fees?.[k]?.total||0), 0);
  const otherFItems = (fees?.sectionF?.items||[])
    .filter(i => !i.label.includes('Interest') && !i.label.includes('Credit'))
    .reduce((s,i) => s + i.amount, 0);

  // Per-rate comparison values
  const fundingDay = fundingDate ? new Date(fundingDate + 'T12:00:00').getDate() : 0;
  const fundingDim = fundingDate ? new Date(
    new Date(fundingDate + 'T12:00:00').getFullYear(),
    new Date(fundingDate + 'T12:00:00').getMonth() + 1, 0
  ).getDate() : 30;

  const perRateCalc = selectedRates.map(r => {
    const perDiem = Math.round(loanAmount * (r.rate / 100) / 365 * 100) / 100;
    let interestDays = 0, interestAmount = 0, isCredit = false;
    if (fundingDay > 0) {
      isCredit = fundingDay <= 6;
      interestDays = isCredit ? fundingDay : (fundingDim - fundingDay);
      interestAmount = isCredit
        ? -Math.round(perDiem * interestDays * 100) / 100
        :  Math.round(perDiem * interestDays * 100) / 100;
    }
    const totalF = interestAmount + otherFItems;
    const totalCosts = fixedFees + totalF;
    const ctc = downPayment + totalCosts + (r.discountDollars||0) - (r.rebateDollars||0) - creditTotal;
    return { rate: r.rate, perDiem, interestDays, interestAmount, isCredit,
             rebate: r.rebateDollars||0, discount: r.discountDollars||0, ctc: Math.round(ctc) };
  });

  const primaryRate = selectedRates[0];
  const monthlyPI  = primaryRate ? calcPI(loanAmount, primaryRate.rate, scenario?.term||30) : 0;
  const monthlyTax = fees?.monthlyTax || 0;
  const monthlyIns = fees?.monthlyInsurance || 0;

  const sections = ['sectionA','sectionB','sectionC','sectionE','sectionF','sectionG','sectionH'];
  const editableSections = new Set(['sectionA','sectionB','sectionC','sectionE','sectionH']);

  const escrowItems = (escrowDetail || fees?.escrowCalc)?.escrowItems || [];
  const respa = (escrowDetail || fees?.escrowCalc)?.respa || {};

  return (
    <div className="space-y-4">

      {/* ── Multi-rate comparison ─────────────────────────────────────────── */}
      <div className="bg-gray-900 rounded-xl p-5 shadow-sm">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Rate Comparison</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs">
                <th className="text-left pb-2 font-medium pr-6"></th>
                {selectedRates.map((r,i) => (
                  <th key={i} className={`text-right pb-2 font-medium ${i===0 ? 'text-cyan-400' : 'text-gray-400'}`}>
                    {r.rate.toFixed(3)}%
                    {i===0 && <span className="ml-1 text-[9px] bg-cyan-900 text-cyan-300 px-1 rounded">PRIMARY</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              <tr>
                <td className="py-1.5 text-gray-400 text-xs pr-6">Program</td>
                {selectedRates.map((r,i) => <td key={i} className="py-1.5 text-right text-xs text-gray-300">{r.program?.split(' ').slice(0,3).join(' ')}</td>)}
              </tr>
              <tr>
                <td className="py-1.5 text-gray-400 text-xs pr-6">Price (Credit / Cost)</td>
                {selectedRates.map((r,i) => (
                  <td key={i} className={`py-1.5 text-right font-mono text-xs ${r.rebateDollars > 0 ? 'text-green-400' : r.discountDollars > 0 ? 'text-red-400' : 'text-gray-300'}`}>
                    {r.rebateDollars > 0 ? `+$${r.rebateDollars.toLocaleString()}` : r.discountDollars > 0 ? `-$${r.discountDollars.toLocaleString()}` : 'PAR'}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-1.5 text-gray-400 text-xs pr-6">Daily Interest (per diem)</td>
                {perRateCalc.map((rc,i) => (
                  <td key={i} className="py-1.5 text-right font-mono text-xs text-gray-300">
                    ${rc.perDiem}/day
                    {rc.interestDays > 0 && <span className={`ml-1 text-[9px] ${rc.isCredit ? 'text-green-400' : 'text-amber-400'}`}>
                      {rc.isCredit ? `${rc.interestDays}d credit` : `${rc.interestDays}d charge`}
                    </span>}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-1.5 text-gray-400 text-xs pr-6">Prepaid Interest</td>
                {perRateCalc.map((rc,i) => (
                  <td key={i} className={`py-1.5 text-right font-mono text-xs ${rc.isCredit ? 'text-green-400' : 'text-gray-300'}`}>
                    {rc.isCredit ? '-' : '+'}${Math.abs(rc.interestAmount).toLocaleString()}
                  </td>
                ))}
              </tr>
              {isPurchase && (
                <tr className="border-t border-gray-700">
                  <td className="py-2 text-white text-xs font-bold pr-6">Est. Cash to Close</td>
                  {perRateCalc.map((rc,i) => (
                    <td key={i} className={`py-2 text-right font-mono font-bold ${i===0 ? 'text-cyan-300' : 'text-white'}`}>
                      ${rc.ctc.toLocaleString()}
                    </td>
                  ))}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Escrow & Prepaid Panel ────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-amber-200 shadow-sm">
        <div className="px-5 py-4 border-b border-amber-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Escrow &amp; Prepaid</h3>
            <p className="text-xs text-gray-400 mt-0.5">All fields pre-populated — edit any value to recalculate</p>
          </div>
          {escrowsWaived
            ? <span className="px-2.5 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs font-semibold border border-orange-200">Escrows Waived — Section G empty</span>
            : <span className="px-2.5 py-1 bg-cyan-50 text-cyan-700 rounded-lg text-xs font-semibold border border-cyan-200">Escrowing</span>
          }
        </div>

        <div className="p-5 space-y-4">
          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Funding Date</label>
              <input type="date" value={fundingDate}
                onChange={e => {
                  const v = e.target.value;
                  setFundingDate(v);
                  if (isPurchase && (!hoiDate || hoiDate === fundingDate)) { setHoiDate(v); rebuildEscrow({ funding: v, hoi: v }); }
                  else rebuildEscrow({ funding: v });
                }}
                className="w-full rounded-lg border-gray-300 text-sm focus:ring-amber-400 focus:border-amber-400" />
              {firstPaymentDateStr && (
                <div className={`text-[10px] mt-0.5 font-medium ${isInterestCredit ? 'text-green-600' : 'text-gray-400'}`}>
                  {isInterestCredit ? 'Interest credit →' : 'Prepaid interest →'} First pmt: {firstPaymentDateStr}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                HOI Effective Date
                <span className="ml-1 font-normal text-gray-400">{isPurchase ? '(policy starts at funding)' : '(renewal — 60-day rule)'}</span>
              </label>
              <input type="date" value={hoiDate}
                onChange={e => { setHoiDate(e.target.value); rebuildEscrow({ hoi: e.target.value }); }}
                className="w-full rounded-lg border-gray-300 text-sm focus:ring-amber-400 focus:border-amber-400" />
            </div>
          </div>

          {/* Annual amounts */}
          <div className="grid grid-cols-2 gap-4">
            <NumInput label="Annual Property Taxes" value={annualTaxes}
              onChange={v => { setAnnualTaxes(v); rebuildEscrow({ taxes: v }); }}
              sub={`$${Math.round(annualTaxes/12).toLocaleString()}/mo`} />
            <NumInput label="Annual HOI" value={annualIns}
              onChange={v => { setAnnualIns(v); rebuildEscrow({ ins: v }); }}
              sub={`$${Math.round(annualIns/12).toLocaleString()}/mo`} />
          </div>

          {/* Flood — all states */}
          <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
            <label className="flex items-center gap-2 cursor-pointer shrink-0">
              <input type="checkbox" checked={hasFlood}
                onChange={e => { const v = e.target.checked; setHasFlood(v); rebuildEscrow({ flood: v }); }}
                className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" />
              <span className="text-xs font-medium text-gray-600 w-28">Flood Insurance</span>
            </label>
            {hasFlood
              ? <NumInput value={annualFlood} onChange={v => { setAnnualFlood(v); rebuildEscrow({ floodAmt: v }); }} placeholder="Annual flood premium" className="flex-1" />
              : <span className="text-xs text-gray-400">Check if property is in a flood zone</span>
            }
          </div>

          {/* TX extras */}
          {isTX && (
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Texas Extras</div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer shrink-0">
                  <input type="checkbox" checked={hasMud}
                    onChange={e => { const v = e.target.checked; setHasMud(v); rebuildEscrow({ mud: v }); }}
                    className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" />
                  <span className="text-xs font-medium text-gray-600 w-28">MUD Tax</span>
                </label>
                {hasMud && <NumInput value={annualMud} onChange={v => { setAnnualMud(v); rebuildEscrow({ mudAmt: v }); }} placeholder="Annual MUD tax" className="flex-1" />}
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer shrink-0">
                  <input type="checkbox" checked={hasHailWind}
                    onChange={e => { const v = e.target.checked; setHasHailWind(v); rebuildEscrow({ hw: v }); }}
                    className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" />
                  <span className="text-xs font-medium text-gray-600 w-28">Hail/Wind</span>
                </label>
                {hasHailWind && <NumInput value={annualHailWind} onChange={v => { setAnnualHailWind(v); rebuildEscrow({ hwAmt: v }); }} placeholder="Annual hail/wind premium" className="flex-1" />}
              </div>
            </div>
          )}

          {/* Show Your Work */}
          {isEscrowing && escrowItems.length > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <button type="button" onClick={() => setShowEscrowDetail(v => !v)}
                className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 mb-2">
                <span>Show Your Work</span>
                <span className="text-gray-400">{showEscrowDetail ? '▲' : '▼'}</span>
              </button>
              {showEscrowDetail && (
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">Item</th>
                        <th className="px-3 py-2 text-right font-medium">Monthly</th>
                        <th className="px-3 py-2 text-center font-medium">Next Due</th>
                        <th className="px-3 py-2 text-right font-medium">Installment</th>
                        <th className="px-3 py-2 text-right font-medium">Mo. Before Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {escrowItems.map(item => (
                        <tr key={item.key} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-700">{item.label}</td>
                          <td className="px-3 py-2 text-right font-mono">${item.monthly.toLocaleString()}</td>
                          <td className="px-3 py-2 text-center">
                            <input type="date" value={dueDateOverrides[item.key] || item.dateStr}
                              onChange={e => updateDueDate(item.key, e.target.value)}
                              className="rounded border-gray-300 text-xs focus:ring-amber-400 focus:border-amber-400 py-0.5 px-1.5" />
                          </td>
                          <td className="px-3 py-2 text-right font-mono">${item.installment.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right font-mono text-gray-500">
                            {item.monthsFromFirstPmt != null ? item.monthsFromFirstPmt : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {respa.initialDeposit != null && (
                    <div className="px-4 py-2.5 bg-gray-900 text-xs text-white flex flex-wrap items-center justify-between gap-4">
                      <span>Total monthly: <span className="font-mono font-bold">${(respa.totalMonthly||0).toLocaleString()}</span></span>
                      <span>2-month cushion: <span className="font-mono font-bold">${(respa.cushion||0).toLocaleString()}</span></span>
                      <span className="text-cyan-300 font-bold">RESPA Initial Deposit: <span className="font-mono">${(respa.initialDeposit||0).toLocaleString()}</span></span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Fee Breakdown ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Fee Breakdown</h3>
          <p className="text-xs text-gray-500 mt-0.5">Edit amounts · remove items · add custom fees</p>
        </div>
        <div className="divide-y divide-gray-100">
          {sections.map(key => {
            let section = fees?.[key];
            // Initialize sectionH for older quotes that don't have it
            if (!section && key === 'sectionH') {
              section = { label: 'H. Other', items: [], total: 0 };
            }
            if (!section) return null;
            if (section.items.length === 0 && !editableSections.has(key)) return null;
            const isOpen = expanded[key] !== false;
            const canEdit = editableSections.has(key);

            return (
              <div key={key}>
                <button onClick={() => toggle(key)}
                  className="w-full px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <span className="text-sm font-medium text-gray-700">{section.label}</span>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-mono font-medium ${section.total < 0 ? 'text-green-600' : ''}`}>
                      {section.total < 0 ? '-' : ''}${Math.abs(section.total||0).toLocaleString()}
                    </span>
                    <span className="text-gray-400 text-xs">{isOpen ? '▲' : '▼'}</span>
                  </div>
                </button>
                {isOpen && (
                  <div className="px-6 pb-3 space-y-1">
                    {section.items.map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className={`text-xs flex-1 ${item.amount < 0 ? 'text-green-600' : 'text-gray-600'}`}>{item.label}</span>
                        <div className="relative w-28">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                          <input type="number" value={item.amount}
                            onFocus={e => e.target.select()}
                            onChange={e => updateItem(key, i, e.target.value)}
                            className={`w-full pl-5 pr-2 py-1 text-xs text-right font-mono rounded border-gray-200 focus:ring-cyan-500 focus:border-cyan-500 ${item.amount < 0 ? 'text-green-600' : ''}`} />
                        </div>
                        {canEdit && (
                          <button onClick={() => removeItem(key, i)}
                            className="text-gray-300 hover:text-red-400 text-xs font-bold px-1 transition-colors" title="Remove">✕</button>
                        )}
                      </div>
                    ))}
                    {/* Add fee to section */}
                    {canEdit && (
                      addingToSection === key ? (
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
                          <input type="text" value={newFeeLabel} onChange={e => setNewFeeLabel(e.target.value)}
                            placeholder="Fee description"
                            className="flex-1 text-xs rounded border-gray-300 focus:ring-cyan-500 focus:border-cyan-500 py-1" />
                          <div className="relative w-24">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                            <input type="number" value={newFeeAmount} onChange={e => setNewFeeAmount(e.target.value)}
                              onFocus={e => e.target.select()} placeholder="0"
                              className="w-full pl-5 py-1 text-xs font-mono rounded border-gray-300 focus:ring-cyan-500 focus:border-cyan-500" />
                          </div>
                          <button onClick={() => addItem(key)} className="text-xs px-2 py-1 bg-cyan-600 text-white rounded hover:bg-cyan-700">Add</button>
                          <button onClick={() => { setAddingToSection(null); setNewFeeLabel(''); setNewFeeAmount(''); }} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setAddingToSection(key)}
                          className="mt-2 text-xs text-cyan-600 hover:text-cyan-700 font-medium flex items-center gap-1">
                          <span className="text-base leading-none">+</span> Add fee
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Credits ──────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-green-200 shadow-sm">
        <div className="px-6 py-4 border-b border-green-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Credits</h3>
            <p className="text-xs text-gray-400 mt-0.5">Realtor credit, seller credit, tax prorate — reduce cash to close</p>
          </div>
          {creditTotal > 0 && (
            <span className="text-sm font-mono font-semibold text-green-600">-${creditTotal.toLocaleString()}</span>
          )}
        </div>
        <div className="px-6 py-3 space-y-2">
          {credits.map((cr, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="text" value={cr.label}
                onChange={e => updateCredit(i, 'label', e.target.value)}
                className="flex-1 text-xs rounded border-gray-300 focus:ring-green-400 focus:border-green-400 py-1.5" />
              <div className="relative w-32">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                <input type="number" value={cr.amount || ''}
                  onFocus={e => e.target.select()}
                  onChange={e => updateCredit(i, 'amount', e.target.value)}
                  placeholder="0"
                  className="w-full pl-5 py-1.5 text-xs font-mono text-green-700 rounded border-gray-300 focus:ring-green-400 focus:border-green-400" />
              </div>
              <button onClick={() => removeCredit(i)} className="text-gray-300 hover:text-red-400 text-xs font-bold px-1">✕</button>
            </div>
          ))}

          {/* Add credit */}
          {showCreditAdd ? (
            <div className="pt-2 border-t border-gray-100 space-y-2">
              <div className="flex flex-wrap gap-2">
                {PRESET_CREDITS.map(p => (
                  <button key={p.label} onClick={() => addCredit(p.label, 0)}
                    className="px-2.5 py-1 text-xs bg-green-50 text-green-700 rounded-lg border border-green-200 hover:bg-green-100">
                    + {p.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input type="text" value={newCreditLabel} onChange={e => setNewCreditLabel(e.target.value)}
                  placeholder="Custom credit label"
                  className="flex-1 text-xs rounded border-gray-300 focus:ring-green-400 focus:border-green-400 py-1" />
                <div className="relative w-28">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                  <input type="number" value={newCreditAmount} onChange={e => setNewCreditAmount(e.target.value)}
                    onFocus={e => e.target.select()} placeholder="0"
                    className="w-full pl-5 py-1 text-xs font-mono rounded border-gray-300 focus:ring-green-400 focus:border-green-400" />
                </div>
                <button onClick={() => addCredit(newCreditLabel, newCreditAmount)} disabled={!newCreditLabel.trim()}
                  className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-40">Add</button>
                <button onClick={() => { setShowCreditAdd(false); setNewCreditLabel(''); setNewCreditAmount(''); }}
                  className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowCreditAdd(true)}
              className="text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-1">
              <span className="text-base leading-none">+</span> Add credit
            </button>
          )}
        </div>
      </div>

      {/* ── Totals ─────────────────────────────────────────────────────────── */}
      <div className="bg-gray-900 rounded-xl px-6 py-5 text-white">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Per-rate CTC */}
          {isPurchase && (
            <div className="md:col-span-2">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Cash to Close by Rate</div>
              <div className="space-y-1">
                {perRateCalc.map((rc,i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className={`font-mono text-sm ${i===0 ? 'text-cyan-300 font-bold' : 'text-gray-400'}`}>{selectedRates[i].rate.toFixed(3)}%</span>
                    <span className={`font-mono text-sm ${i===0 ? 'text-cyan-300 font-bold' : 'text-gray-300'}`}>${rc.ctc.toLocaleString()}</span>
                  </div>
                ))}
                {creditTotal > 0 && (
                  <div className="flex justify-between items-center pt-1 border-t border-gray-700 text-xs text-green-400">
                    <span>Credits applied</span>
                    <span className="font-mono">-${creditTotal.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Monthly PITI */}
          <div>
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Monthly PITI</div>
            <div className="text-2xl font-mono font-bold text-cyan-300">${(monthlyPI + monthlyTax + monthlyIns).toLocaleString()}</div>
            <div className="text-[10px] text-gray-500 mt-1">
              P&I ${monthlyPI.toLocaleString()} + Tax ${monthlyTax.toLocaleString()} + Ins ${monthlyIns.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* ── Actions ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-400">Quote ID: {quoteId ? quoteId.slice(0,8) : 'N/A'}</div>
        <div className="flex gap-3">
          <button onClick={onSaveDraft} disabled={loading}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors">
            Save Draft
          </button>
          <button onClick={onPreviewPDF} disabled={loading || selectedRates.length === 0}
            className="px-4 py-2 border border-cyan-300 text-cyan-700 bg-cyan-50 rounded-lg text-sm font-medium hover:bg-cyan-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            Preview PDF
          </button>
          <button onClick={onSendToBorrower}
            disabled={loading || !scenario.contact_email || selectedRates.length === 0}
            className="px-5 py-2 bg-cyan-600 text-white rounded-lg text-sm font-bold hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title={!scenario.contact_email ? 'Add contact email to send' : 'Send quote with PDF to borrower'}>
            {loading ? 'Sending...' : 'Send to Borrower'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Numeric input that shows empty (not 0) as placeholder, auto-selects on focus
function NumInput({ label, value, onChange, sub, placeholder = '0', className = '' }) {
  return (
    <div className={className}>
      {label && <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
        <input
          type="number"
          value={value || ''}
          onChange={e => onChange(e.target.value === '' ? 0 : Number(e.target.value))}
          onFocus={e => e.target.select()}
          placeholder={placeholder}
          className="w-full pl-7 rounded-lg border-gray-300 text-sm font-mono focus:ring-amber-400 focus:border-amber-400"
        />
      </div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function calcPI(principal, annualRate, termYears) {
  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  if (r === 0) return Math.round(principal / n);
  return Math.round(principal * (r * Math.pow(1+r,n)) / (Math.pow(1+r,n) - 1));
}
