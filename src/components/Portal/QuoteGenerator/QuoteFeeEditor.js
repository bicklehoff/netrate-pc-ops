'use client';

import { useState } from 'react';
import { calculateEscrowSections } from '@/lib/quotes/escrow-calc';

export default function QuoteFeeEditor({ fees, onFeesChange, selectedRates, scenario, quoteId, onSaveDraft, loading, onSendToBorrower, onPreviewPDF, escrowsWaived }) {
  const [expanded, setExpanded] = useState({});
  const [showEscrowDetail, setShowEscrowDetail] = useState(true);

  const state = scenario?.state || 'CO';
  const isPurchase = scenario?.purpose === 'purchase';
  const isTX = state === 'TX';

  // ── Escrow state — seeded from fee object, fully editable ────────────────
  // If escrowsWaived was set on step 2, default isEscrowing to false
  const [isEscrowing,    setIsEscrowing]    = useState(() => {
    if (escrowsWaived) return false;
    return fees?.isEscrowing !== false;
  });
  const [fundingDate,    setFundingDate]    = useState(() => fees?.fundingDate || scenario?.fundingDate || scenario?.closingDate || '');
  const [annualTaxes,    setAnnualTaxes]    = useState(() => fees?.annualTaxes ?? Math.round((fees?.monthlyTax || 0) * 12));
  const [annualIns,      setAnnualIns]      = useState(() => {
    if (fees?.annualInsurance != null) return fees.annualInsurance;
    const insItem = fees?.sectionF?.items?.find(i => i.label.startsWith('Homeowner'));
    return insItem?.amount || 0;
  });
  const [hoiDate,        setHoiDate]        = useState(() => {
    if (fees?.hoiEffectiveDate) return fees.hoiEffectiveDate;
    if (isPurchase) return fees?.fundingDate || scenario?.fundingDate || scenario?.closingDate || '';
    return '';
  });
  const [hasFlood,       setHasFlood]       = useState(() => fees?.hasFlood ?? false);
  const [annualFlood,    setAnnualFlood]     = useState(() => fees?.annualFlood || 0);
  const [hasMud,         setHasMud]         = useState(() => fees?.hasMud ?? false);
  const [annualMud,      setAnnualMud]       = useState(() => fees?.annualMud || 0);
  const [hasHailWind,    setHasHailWind]    = useState(() => fees?.hasHailWind ?? false);
  const [annualHailWind, setAnnualHailWind] = useState(() => fees?.annualHailWind || 0);
  const [dueDateOverrides, setDueDateOverrides] = useState(() => fees?.dueDateOverrides || {});

  // Current escrow calc result for show-your-work display
  const [escrowDetail, setEscrowDetail] = useState(() => fees?.escrowCalc || null);

  // Derive first payment date for display
  const firstPaymentDateStr = fees?.firstPaymentDateStr || escrowDetail?.firstPaymentDateStr || '';
  const isInterestCredit = fees?.isInterestCredit ?? escrowDetail?.isInterestCredit ?? false;

  // ── Rebuild sections F and G client-side on any escrow input change ────────
  const rebuildEscrow = ({
    escrowing     = isEscrowing,
    funding       = fundingDate,
    taxes         = annualTaxes,
    ins           = annualIns,
    hoi           = hoiDate,
    flood         = hasFlood,
    floodAmt      = annualFlood,
    mud           = hasMud,
    mudAmt        = annualMud,
    hw            = hasHailWind,
    hwAmt         = annualHailWind,
    dueDates      = dueDateOverrides,
  } = {}) => {
    if (!fees) return;

    const escrow = calculateEscrowSections({
      fundingDate: funding,
      loanAmount:  Number(scenario?.loanAmount) || 0,
      annualRate:  Number(selectedRates[0]?.rate) || 0,
      state,
      purpose:     scenario?.purpose || 'purchase',
      isEscrowing: escrowing,
      annualTaxes: taxes,
      annualInsurance: ins,
      hoiEffectiveDate: hoi || null,
      hasFlood: flood, annualFlood: floodAmt,
      hasMud: mud,     annualMud: mudAmt,
      hasHailWind: hw, annualHailWind: hwAmt,
      overrideDueDates: dueDates,
    });

    setEscrowDetail(escrow);

    const sectionF = {
      label: 'Prepaid Items',
      items: escrow.sectionFItems,
      total: escrow.sectionFItems.reduce((s, i) => s + i.amount, 0),
    };
    const sectionG = {
      label: 'Initial Escrow',
      items: escrow.sectionGItems,
      total: escrow.sectionGItems.reduce((s, i) => s + i.amount, 0),
    };

    const updated = {
      ...fees,
      sectionF, sectionG,
      monthlyTax:       escrow.escrowMonthly.taxes,
      monthlyInsurance: escrow.escrowMonthly.insurance,
      isEscrowing: escrowing,
      fundingDate: funding,
      firstPaymentDateStr: escrow.firstPaymentDateStr,
      isInterestCredit: escrow.isInterestCredit,
      annualTaxes: taxes,    annualInsurance: ins,
      hoiEffectiveDate: hoi || null,
      hasFlood: flood,       annualFlood: floodAmt,
      hasMud: mud,           annualMud: mudAmt,
      hasHailWind: hw,       annualHailWind: hwAmt,
      dueDateOverrides: dueDates,
      escrowCalc: escrow,
    };
    updated.totalClosingCosts = ['sectionA', 'sectionB', 'sectionC', 'sectionE', 'sectionF', 'sectionG']
      .reduce((s, k) => s + (updated[k]?.total || 0), 0);
    onFeesChange(updated);
  };

  const updateDueDate = (key, newDateStr) => {
    const updated = { ...dueDateOverrides, [key]: newDateStr };
    setDueDateOverrides(updated);
    rebuildEscrow({ dueDates: updated });
  };

  const toggle = (section) => setExpanded(prev => ({ ...prev, [section]: !prev[section] }));

  const updateItem = (sectionKey, itemIndex, newAmount) => {
    const updated = { ...fees };
    const section = { ...updated[sectionKey] };
    const items = [...section.items];
    items[itemIndex] = { ...items[itemIndex], amount: Number(newAmount) || 0 };
    section.items = items;
    section.total = items.reduce((sum, i) => sum + i.amount, 0);
    updated[sectionKey] = section;
    updated.totalClosingCosts = ['sectionA', 'sectionB', 'sectionC', 'sectionE', 'sectionF', 'sectionG']
      .reduce((sum, k) => sum + (updated[k]?.total || 0), 0);
    onFeesChange(updated);
  };

  // Monthly payment calc
  const primaryRate = selectedRates[0];
  const monthlyPI  = primaryRate ? calculatePI(Number(scenario.loanAmount), primaryRate.rate, scenario.term || 30) : 0;
  const monthlyTax = fees?.monthlyTax || 0;
  const monthlyIns = fees?.monthlyInsurance || 0;
  const totalMonthly = monthlyPI + monthlyTax + monthlyIns;

  // Cash to close
  const downPayment  = isPurchase ? (Number(scenario.propertyValue) || 0) - (Number(scenario.loanAmount) || 0) : 0;
  const rebate       = primaryRate?.rebateDollars  || 0;
  const discount     = primaryRate?.discountDollars || 0;
  const cashToClose  = downPayment + (fees?.totalClosingCosts || 0) + discount - rebate;

  const sections = ['sectionA', 'sectionB', 'sectionC', 'sectionE', 'sectionF', 'sectionG'];

  // Escrow detail rows for show-your-work
  const escrowItems = (escrowDetail || fees?.escrowCalc)?.escrowItems || [];
  const respa = (escrowDetail || fees?.escrowCalc)?.respa || {};

  return (
    <div className="space-y-4">

      {/* Rate Summary Cards */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Selected Rates</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {selectedRates.map((r, i) => (
            <div key={i} className={`p-4 rounded-lg border ${i === 0 ? 'border-cyan-300 bg-cyan-50' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg font-mono font-bold">{r.rate.toFixed(3)}%</span>
                {i === 0 && <span className="text-[10px] font-medium text-cyan-700 bg-cyan-100 px-2 py-0.5 rounded-full">PRIMARY</span>}
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                <div>{r.program}</div>
                <div className="capitalize">{r.lender} | {r.investor} {r.tier}</div>
                <div className="font-mono">P&I: ${r.monthlyPI?.toLocaleString()}/mo</div>
                {r.rebateDollars  > 0 && <div className="text-green-600">Credit: ${r.rebateDollars.toLocaleString()}</div>}
                {r.discountDollars > 0 && <div className="text-red-600">Discount: ${r.discountDollars.toLocaleString()}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Escrow & Prepaid Panel */}
      <div className="bg-white rounded-xl border border-amber-200 shadow-sm">
        {/* Panel header */}
        <div className="px-5 py-4 border-b border-amber-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Escrow &amp; Prepaid</h3>
            <p className="text-xs text-gray-400 mt-0.5">All fields pre-populated — edit any value to recalculate</p>
          </div>
          {/* Escrow election toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className={`text-sm font-medium ${isEscrowing ? 'text-gray-700' : 'text-gray-400'}`}>
              {isEscrowing ? 'Escrowing' : 'Not Escrowing'}
            </span>
            <button
              type="button"
              onClick={() => {
                const v = !isEscrowing;
                setIsEscrowing(v);
                rebuildEscrow({ escrowing: v });
              }}
              className={`relative inline-flex h-6 w-11 rounded-full transition-colors ${isEscrowing ? 'bg-cyan-600' : 'bg-gray-300'}`}
            >
              <span className={`inline-block w-5 h-5 mt-0.5 rounded-full bg-white shadow transform transition-transform ${isEscrowing ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
          </label>
        </div>

        <div className="p-5 space-y-4">
          {/* Dates row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Funding Date</label>
              <input
                type="date"
                value={fundingDate}
                onChange={e => {
                  const v = e.target.value;
                  setFundingDate(v);
                  if (isPurchase && (!hoiDate || hoiDate === fundingDate)) {
                    setHoiDate(v);
                    rebuildEscrow({ funding: v, hoi: v });
                  } else {
                    rebuildEscrow({ funding: v });
                  }
                }}
                className="w-full rounded-lg border-gray-300 text-sm focus:ring-amber-400 focus:border-amber-400"
              />
              {firstPaymentDateStr && (
                <div className={`text-[10px] mt-0.5 font-medium ${isInterestCredit ? 'text-green-600' : 'text-gray-400'}`}>
                  {isInterestCredit ? 'Interest credit →' : 'Prepaid interest →'} First pmt: {firstPaymentDateStr}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                HOI Effective Date
                <span className="ml-1 font-normal text-gray-400">{isPurchase ? '(policy starts at funding)' : '(renewal date — 60-day rule)'}</span>
              </label>
              <input
                type="date"
                value={hoiDate}
                onChange={e => { setHoiDate(e.target.value); rebuildEscrow({ hoi: e.target.value }); }}
                className="w-full rounded-lg border-gray-300 text-sm focus:ring-amber-400 focus:border-amber-400"
              />
            </div>
          </div>

          {/* Annual amounts row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Annual Property Taxes</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                <input type="number" value={annualTaxes}
                  onChange={e => { const v = Number(e.target.value)||0; setAnnualTaxes(v); rebuildEscrow({ taxes: v }); }}
                  className="w-full pl-7 rounded-lg border-gray-300 text-sm font-mono focus:ring-amber-400 focus:border-amber-400"
                  placeholder="0" />
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">${Math.round(annualTaxes/12).toLocaleString()}/mo</div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Annual HOI</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                <input type="number" value={annualIns}
                  onChange={e => { const v = Number(e.target.value)||0; setAnnualIns(v); rebuildEscrow({ ins: v }); }}
                  className="w-full pl-7 rounded-lg border-gray-300 text-sm font-mono focus:ring-amber-400 focus:border-amber-400"
                  placeholder="0" />
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">${Math.round(annualIns/12).toLocaleString()}/mo</div>
            </div>
          </div>

          {/* Flood — visible for all states */}
          <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
            <label className="flex items-center gap-2 cursor-pointer shrink-0">
              <input type="checkbox" checked={hasFlood}
                onChange={e => { const v = e.target.checked; setHasFlood(v); rebuildEscrow({ flood: v }); }}
                className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" />
              <span className="text-xs font-medium text-gray-600 w-24">Flood Insurance</span>
            </label>
            {hasFlood ? (
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                <input type="number" value={annualFlood}
                  onChange={e => { const v = Number(e.target.value)||0; setAnnualFlood(v); rebuildEscrow({ floodAmt: v }); }}
                  className="w-full pl-7 rounded-lg border-gray-300 text-sm font-mono focus:ring-amber-400 focus:border-amber-400"
                  placeholder="Annual flood premium" />
              </div>
            ) : (
              <span className="text-xs text-gray-400">Check if property is in a flood zone</span>
            )}
          </div>

          {/* TX-only: MUD + Hail/Wind */}
          {isTX && (
            <div className="space-y-2 pt-2 border-t border-gray-100">
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Texas Extras</div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer shrink-0">
                  <input type="checkbox" checked={hasMud}
                    onChange={e => { const v = e.target.checked; setHasMud(v); rebuildEscrow({ mud: v }); }}
                    className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" />
                  <span className="text-xs font-medium text-gray-600 w-24">MUD Tax</span>
                </label>
                {hasMud && (
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                    <input type="number" value={annualMud}
                      onChange={e => { const v = Number(e.target.value)||0; setAnnualMud(v); rebuildEscrow({ mudAmt: v }); }}
                      className="w-full pl-7 rounded-lg border-gray-300 text-sm font-mono focus:ring-amber-400 focus:border-amber-400"
                      placeholder="Annual MUD tax" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer shrink-0">
                  <input type="checkbox" checked={hasHailWind}
                    onChange={e => { const v = e.target.checked; setHasHailWind(v); rebuildEscrow({ hw: v }); }}
                    className="rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" />
                  <span className="text-xs font-medium text-gray-600 w-24">Hail/Wind</span>
                </label>
                {hasHailWind && (
                  <div className="flex-1 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                    <input type="number" value={annualHailWind}
                      onChange={e => { const v = Number(e.target.value)||0; setAnnualHailWind(v); rebuildEscrow({ hwAmt: v }); }}
                      className="w-full pl-7 rounded-lg border-gray-300 text-sm font-mono focus:ring-amber-400 focus:border-amber-400"
                      placeholder="Annual hail/wind premium" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Not escrowing notice */}
          {!isEscrowing && (
            <div className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
              Escrows waived — Section G will be empty. Borrower pays taxes &amp; insurance directly.
            </div>
          )}

          {/* ── Show Your Work ─────────────────────────────────────────────────── */}
          {isEscrowing && escrowItems.length > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowEscrowDetail(v => !v)}
                className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700 mb-2"
              >
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
                        <th className="px-3 py-2 text-center font-medium">Next Due Date</th>
                        <th className="px-3 py-2 text-right font-medium">Installment</th>
                        <th className="px-3 py-2 text-right font-medium">Mo. Before Due</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {escrowItems.map((item) => (
                        <tr key={item.key} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-700">{item.label}</td>
                          <td className="px-3 py-2 text-right font-mono">${item.monthly.toLocaleString()}</td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="date"
                              value={dueDateOverrides[item.key] || item.dateStr}
                              onChange={e => updateDueDate(item.key, e.target.value)}
                              className="rounded border-gray-300 text-xs focus:ring-amber-400 focus:border-amber-400 py-0.5 px-1.5"
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-mono">${item.installment.toLocaleString()}</td>
                          <td className="px-3 py-2 text-right font-mono text-gray-500">
                            {item.monthsFromFirstPmt != null ? item.monthsFromFirstPmt : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* RESPA summary row */}
                  {respa.initialDeposit != null && (
                    <div className="px-4 py-2.5 bg-gray-900 text-xs text-white flex items-center justify-between gap-4 flex-wrap">
                      <span>Total monthly: <span className="font-mono font-bold">${(respa.totalMonthly || 0).toLocaleString()}</span></span>
                      <span>2-month cushion: <span className="font-mono font-bold">${(respa.cushion || 0).toLocaleString()}</span></span>
                      <span className="text-cyan-300 font-bold">RESPA Initial Deposit: <span className="font-mono">${(respa.initialDeposit || 0).toLocaleString()}</span></span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Fee Sections */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Fee Breakdown</h3>
          <p className="text-xs text-gray-500 mt-0.5">Edit any line item — totals update automatically</p>
        </div>
        <div className="divide-y divide-gray-100">
          {sections.map(key => {
            const section = fees?.[key];
            if (!section || section.items.length === 0) return null;
            const isOpen = expanded[key] !== false;

            return (
              <div key={key}>
                <button
                  onClick={() => toggle(key)}
                  className="w-full px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-700">{section.label}</span>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-mono font-medium ${section.total < 0 ? 'text-green-600' : ''}`}>
                      {section.total < 0 ? '-' : ''}${Math.abs(section.total || 0).toLocaleString()}
                    </span>
                    <span className="text-gray-400 text-xs">{isOpen ? '▲' : '▼'}</span>
                  </div>
                </button>
                {isOpen && (
                  <div className="px-6 pb-3 space-y-1">
                    {section.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between gap-4">
                        <span className={`text-xs flex-1 ${item.amount < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                          {item.label}
                        </span>
                        <div className="relative w-28">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
                          <input
                            type="number"
                            value={item.amount}
                            onChange={e => updateItem(key, i, e.target.value)}
                            className={`w-full pl-5 pr-2 py-1 text-xs text-right font-mono rounded border-gray-200 focus:ring-cyan-500 focus:border-cyan-500 ${item.amount < 0 ? 'text-green-600' : ''}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Totals */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">Total Closing Costs</span>
            <span className="font-mono font-medium">${(fees?.totalClosingCosts || 0).toLocaleString()}</span>
          </div>
          {isPurchase && (
            <>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Down Payment</span>
                <span className="font-mono">${downPayment.toLocaleString()}</span>
              </div>
              {rebate > 0 && (
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-green-600">Lender Credit</span>
                  <span className="font-mono text-green-600">-${rebate.toLocaleString()}</span>
                </div>
              )}
              {discount > 0 && (
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-red-600">Discount Points</span>
                  <span className="font-mono text-red-600">+${discount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-300">
                <span>Estimated Cash to Close</span>
                <span className="font-mono">${cashToClose.toLocaleString()}</span>
              </div>
            </>
          )}
          <div className="flex justify-between text-sm font-bold pt-2 mt-2 border-t border-gray-300">
            <span>Monthly Payment (PITI)</span>
            <span className="font-mono">${totalMonthly.toLocaleString()}/mo</span>
          </div>
          <div className="text-[10px] text-gray-400 mt-1">
            P&I: ${monthlyPI.toLocaleString()} + Tax: ${monthlyTax.toLocaleString()} + Ins: ${monthlyIns.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-400">Quote ID: {quoteId ? quoteId.slice(0, 8) : 'N/A'}</div>
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
            disabled={loading || !scenario.borrowerEmail || selectedRates.length === 0}
            className="px-5 py-2 bg-cyan-600 text-white rounded-lg text-sm font-bold hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title={!scenario.borrowerEmail ? 'Add borrower email to send' : 'Send quote with PDF to borrower'}>
            {loading ? 'Sending...' : 'Send to Borrower'}
          </button>
        </div>
      </div>
    </div>
  );
}

function calculatePI(principal, annualRate, termYears) {
  const r = annualRate / 100 / 12;
  const n = termYears * 12;
  if (r === 0) return Math.round(principal / n);
  return Math.round(principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
}
