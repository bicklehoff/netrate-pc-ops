// ApplicationSection — "Precision Curator" 1003 Master Worksheet
// 4-column extreme density layout matching Stitch mockup.
// No collapsible cards. Everything visible. Background-shift panels.

'use client';

import { useState, useEffect, useCallback } from 'react';

// ─── Formatters ───

function fmt$(v) { if (v == null || v === '') return '—'; return `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2 })}`; }
function fmt$0(v) { if (v == null || v === '') return '—'; return `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 0 })}`; }
function fmtPct(v) { if (v == null) return '—'; return `${Number(v).toFixed(3)}%`; }
function fmtAddr(a) { if (!a) return '—'; return [a.street, a.city, a.state, a.zip].filter(Boolean).join(', ') || '—'; }
function fmtShortDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); }

// ─── Main Component ───

export default function ApplicationSection({ loan }) {
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [borrowerTab, setBorrowerTab] = useState(0); // 0=primary, 1=co-borrower
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/portal/mlo/loans/${loan.id}/application`);
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setApp(json.application);
    } catch { /* */ } finally { setLoading(false); }
  }, [loan.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand" /></div>;
  if (!app) return <p className="text-xs text-gray-400 text-center py-12">No application data available</p>;

  const borrowers = app.loanBorrowers || [];
  const primary = borrowers[0];
  const coBorrower = borrowers[1];
  const activeBorrower = borrowers[borrowerTab] || primary;
  const assets = app.assets || [];
  const liabilities = app.liabilities || [];
  const reos = app.reos || [];
  const tx = app.transaction || {};
  const primInc = primary?.income || {};
  const coInc = coBorrower?.income || {};
  const decl = primary?.declaration || {};

  // Totals
  const totalAssets = assets.reduce((s, a) => s + (a.balance || 0), 0);
  const totalLiabPmt = liabilities.reduce((s, l) => s + (l.monthlyPayment || 0), 0);
  const incFields = ['baseMonthly', 'overtimeMonthly', 'bonusMonthly', 'commissionMonthly', 'dividendsMonthly', 'interestMonthly', 'rentalIncomeMonthly', 'otherMonthly'];
  const primTotal = incFields.reduce((s, f) => s + (primInc[f] || 0), 0);
  const coTotal = incFields.reduce((s, f) => s + (coInc[f] || 0), 0);
  const grossTotal = primTotal + coTotal;

  // Borrower names
  const primName = primary?.borrower ? `${primary.borrower.last_name?.toUpperCase()}, ${primary.borrower.first_name?.toUpperCase()}` : '—';
  const coName = coBorrower?.borrower ? ` & ${coBorrower.borrower.first_name?.toUpperCase()}` : '';

  // Labels
  const purposeMap = { purchase: 'Purchase', refinance: 'Refinance' };
  const typeMap = { conventional: 'Conv.', fha: 'FHA', va: 'VA', usda: 'USDA', jumbo: 'Jumbo' };
  const occMap = { primary: 'Primary', secondary: 'Second Home', investment: 'Investment' };
  const propMap = { sfr: 'SFR', condo: 'Condo', townhome: 'Townhome', pud: 'PUD', multi_unit: 'Multi-Unit', manufactured: 'Mfg' };
  const amortMap = { fixed: 'Fixed', arm: 'ARM', balloon: 'Balloon' };
  const housingMap = { own: 'Own', rent: 'Rent', free: 'Living Rent Free' };
  const citizenMap = { us_citizen: 'U.S. Citizen', permanent_resident: 'Perm. Resident', non_permanent_resident: 'Non-Perm. Resident' };

  const loanDesc = `${typeMap[loan.loan_type] || loan.loan_type || '—'}. ${loan.loan_term || 360/12}Y ${amortMap[app.amortizationType] || 'Fixed'} / ${purposeMap[loan.purpose] || loan.purpose || '—'}`;

  // LTV calc
  const loanAmt = Number(loan.loan_amount) || 0;
  const propVal = Number(loan.purchase_price) || Number(loan.estimated_value) || Number(loan.appraisedValue) || 0;
  const ltv = propVal > 0 ? ((loanAmt / propVal) * 100).toFixed(1) : '—';

  // Ratios
  const piPayment = Number(loan.monthlyPayment) || 0;
  const frontRatio = grossTotal > 0 && piPayment > 0 ? ((piPayment / grossTotal) * 100).toFixed(1) : '—';
  const backRatio = grossTotal > 0 ? (((piPayment + totalLiabPmt) / grossTotal) * 100).toFixed(1) : '—';
  const reserves = piPayment > 0 ? (totalAssets / piPayment).toFixed(1) : '—';

  // Export handlers
  const handleDownload = () => window.open(`/api/portal/mlo/loans/${loan.id}/xml`, '_blank');
  const handleSnapshot = async (lender) => {
    setExporting(true);
    try {
      const res = await fetch(`/api/portal/mlo/loans/${loan.id}/xml`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lender }),
      });
      if (res.ok) { const d = await res.json(); setExportMsg(d.filename); setTimeout(() => setExportMsg(null), 5000); }
    } catch { /* */ } finally { setExporting(false); }
  };

  return (
    <div className="font-['Inter'] -mx-6 -mt-6">
      {/* ═══ TOP NAV BAR ═══ */}
      <header className="flex justify-between items-center px-5 h-11 bg-surface-alt/90 backdrop-blur-xl border-b border-ink/10">
        <div className="flex items-center gap-5">
          <span className="text-sm font-extrabold text-ink font-sans">CRM Master Worksheet</span>
          <nav className="flex gap-3">
            <button onClick={handleDownload} className="uppercase tracking-wider text-[10px] font-bold text-brand border-b-2 border-brand pb-0.5">XML</button>
            <button onClick={() => handleSnapshot(null)} disabled={exporting} className="uppercase tracking-wider text-[10px] font-bold text-ink-subtle hover:text-ink-mid pb-0.5 disabled:opacity-50">
              {exporting ? '...' : 'Export'}
            </button>
            <button onClick={() => handleSnapshot('LenDox')} disabled={exporting} className="uppercase tracking-wider text-[10px] font-bold text-ink-subtle hover:text-ink-mid pb-0.5 disabled:opacity-50">Snapshot</button>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {exportMsg && <span className="text-[9px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full">{exportMsg}</span>}
          <div className="text-right">
            <span className="text-[9px] font-bold text-brand uppercase tracking-widest block">{loan.status?.replace(/_/g, ' ').toUpperCase() || 'DRAFT'}</span>
            <span className="text-xs font-bold text-ink">{primName}{coName}</span>
          </div>
        </div>
      </header>

      {/* ═══ 4-COLUMN GRID ═══ */}
      <main className="p-3 bg-surface-alt">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">

          {/* ─── COLUMN 1: Property + Loan Terms + Declarations ─── */}
          <div className="space-y-3">
            {/* Subject Property */}
            <Panel icon="home" title="SUBJECT PROPERTY">
              <div className="space-y-1.5">
                <div><DL>Address</DL><DV bold>{fmtAddr(loan.property_address)}</DV></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><DL>Type / Units</DL><DV>{propMap[loan.property_type] || '—'} / {loan.num_units || 1}</DV></div>
                  <div><DL>Occupancy</DL><DV>{occMap[loan.occupancy] || '—'}</DV></div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><DL>Price</DL><DV>{fmt$0(loan.purchase_price)}</DV></div>
                  <div><DL>Appraised</DL><DV>{fmt$0(loan.appraisedValue)}</DV></div>
                  <div><DL>Down Pmt</DL><DV className="text-go font-bold">{loan.down_payment ? fmt$0(loan.down_payment) : '—'}</DV></div>
                </div>
              </div>
            </Panel>

            {/* Loan Terms */}
            <Panel icon="payments" title="LOAN TERMS" badge={`ID: ${loan.loan_number || '—'}`}>
              <div className="space-y-2.5">
                {/* Base Loan Amount */}
                <div className="bg-surface-alt rounded p-2 border-l-[3px] border-brand">
                  <DL className="text-brand">Base Loan Amount</DL>
                  <p className="text-lg font-extrabold text-ink font-sans">{fmt$(loan.loan_amount)}</p>
                </div>
                {/* Note Rate */}
                <div className="bg-surface-alt rounded p-2 border-l-[3px] border-go">
                  <DL className="text-go">Note Rate</DL>
                  <p className="text-lg font-extrabold text-ink font-sans">{loan.interest_rate ? fmtPct(loan.interest_rate) : '—'}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><DL>LTV / CLTV</DL><DV>{ltv} / {ltv}</DV></div>
                  <div><DL>Term / Amort</DL><DV>{loan.loan_term || 360} / {amortMap[app.amortizationType] || 'Fixed'}</DV></div>
                </div>
                <div className="bg-[#eceeef] p-2 rounded text-[10px]">
                  <p className="font-bold text-ink">{loan.loanProgram || loanDesc}</p>
                  <p className="text-ink-subtle">Lender: {loan.lender_name || '—'}</p>
                </div>
              </div>
            </Panel>

            {/* Declarations */}
            <Panel title="DECLARATIONS">
              <div className="space-y-1">
                <DeclRow label="US Citizen" on={primary?.citizenship === 'us_citizen'} />
                <DeclRow label="Outstanding Judgments" on={!decl.outstandingJudgments} bad={decl.outstandingJudgments} />
                <DeclRow label="Bankruptcy/Foreclosure" on={!decl.bankruptcy && !decl.foreclosure} bad={decl.bankruptcy || decl.foreclosure} />
                <DeclRow label="Party to Lawsuit" on={!decl.partyToLawsuit} bad={decl.partyToLawsuit} />
                <DeclRow label="Co-Signer on Loan" on={!decl.coSignerOnOtherLoan} bad={decl.coSignerOnOtherLoan} />
              </div>
            </Panel>
          </div>

          {/* ─── COLUMN 2: Assets + Income + Credit + Employment ─── */}
          <div className="space-y-3">
            {/* Asset Detail */}
            <Panel title="ASSET DETAIL" action="+">
              {assets.length === 0 ? (
                <p className="text-[10px] text-ink-subtle py-3 text-center">No assets recorded</p>
              ) : (
                <table className="w-full text-[11px] leading-relaxed">
                  <thead>
                    <tr className="text-left border-b border-[#eceeef]">
                      <th className="pb-1 font-semibold text-ink-subtle text-[10px]">Institution</th>
                      <th className="pb-1 text-right font-semibold text-ink-subtle text-[10px]">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eceeef]/50">
                    {assets.map((a) => (
                      <tr key={a.id}>
                        <td className="py-1 text-ink">{a.institution || `${a.accountType || 'Account'}`}</td>
                        <td className="py-1 text-right font-medium">{fmt$(a.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-brand-light">
                      <td className="pt-1.5 font-bold text-brand text-[10px]">TOTAL ASSETS</td>
                      <td className="pt-1.5 text-right font-bold text-brand">{fmt$(totalAssets)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </Panel>

            {/* Qualifying Income */}
            <Panel title="QUALIFYING INCOME (MONTHLY)">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="text-left border-b border-[#eceeef]">
                    <th className="pb-1 text-ink-subtle uppercase font-semibold">Source</th>
                    <th className="pb-1 text-right text-ink-subtle uppercase font-semibold">Borr</th>
                    {coBorrower && <th className="pb-1 text-right text-ink-subtle uppercase font-semibold">Co-B</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eceeef]/50">
                  <IncRow label="Base Pay" a={primInc.baseMonthly} b={coInc.baseMonthly} co={!!coBorrower} />
                  <IncRow label="Bonus/OT" a={(primInc.overtimeMonthly || 0) + (primInc.bonusMonthly || 0) || null} b={(coInc.overtimeMonthly || 0) + (coInc.bonusMonthly || 0) || null} co={!!coBorrower} />
                  <IncRow label="Commission" a={primInc.commissionMonthly} b={coInc.commissionMonthly} co={!!coBorrower} />
                  <IncRow label="Other" a={primInc.otherMonthly} b={coInc.otherMonthly} co={!!coBorrower} />
                </tbody>
                <tfoot className="bg-brand-light/20">
                  <tr className="font-bold">
                    <td className="py-1.5 pl-1 text-[10px]">GROSS TOTAL</td>
                    <td className="py-1.5 pr-1 text-right text-brand text-xs" colSpan={coBorrower ? 2 : 1}>{fmt$(grossTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </Panel>

            {/* Credit Scores */}
            {loan.credit_score && (
              <Panel title="CREDIT PROFILES">
                <div className="grid grid-cols-2 gap-3">
                  {borrowers.map((lb) => (
                    <div key={lb.id} className="bg-surface-alt p-2 rounded">
                      <p className="text-[9px] font-bold text-ink-subtle uppercase">{lb.borrower?.first_name} {lb.borrower?.last_name}</p>
                      <p className="text-sm font-bold text-ink mt-0.5">{loan.credit_score || '—'}</p>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {/* Employment */}
            <Panel title="EMPLOYMENT">
              {borrowers.map((lb) => (lb.employments || []).map((emp) => (
                <div key={emp.id} className="border-l-2 border-ink/10 pl-2 mb-2.5 last:mb-0">
                  <div className="flex justify-between items-start">
                    <p className="text-[11px] font-bold text-ink">{emp.employer_name || '—'}</p>
                    {emp.selfEmployed && <span className="bg-[#e6e8e9] px-1.5 py-0.5 rounded text-[8px] font-black uppercase text-ink-mid">Self-Emp</span>}
                  </div>
                  <p className="text-[10px] text-ink-subtle">{emp.position || '—'} &middot; {fmtShortDate(emp.startDate)} - {emp.endDate ? fmtShortDate(emp.endDate) : 'Present'}</p>
                </div>
              )))}
              {borrowers.every((lb) => !lb.employments?.length) && <p className="text-[10px] text-ink-subtle py-2 text-center">No employment records</p>}
            </Panel>
          </div>

          {/* ─── COLUMN 3: Liabilities + REO + PITI + Ratios ─── */}
          <div className="space-y-3">
            {/* Liability Detail */}
            <Panel title="LIABILITY DETAIL">
              {liabilities.length === 0 ? (
                <p className="text-[10px] text-ink-subtle py-3 text-center">No liabilities recorded</p>
              ) : (
                <table className="w-full text-[10px]">
                  <thead>
                    <tr className="text-left border-b border-[#eceeef]">
                      <th className="pb-1 text-ink-subtle font-semibold">Creditor</th>
                      <th className="pb-1 text-right text-ink-subtle font-semibold">Bal</th>
                      <th className="pb-1 text-right text-ink-subtle font-semibold">Pmt</th>
                      <th className="pb-1 text-center text-ink-subtle font-semibold">P/O</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eceeef]/50">
                    {liabilities.map((l) => (
                      <tr key={l.id}>
                        <td className="py-1 text-ink">{l.creditor || '—'}</td>
                        <td className="py-1 text-right">{fmt$0(l.unpaidBalance)}</td>
                        <td className="py-1 text-right">{fmt$0(l.monthlyPayment)}</td>
                        <td className="py-1 text-center">
                          <input type="checkbox" readOnly checked={l.paidOffAtClosing} className="rounded w-3 h-3 text-brand border-ink/20" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-ink/10">
                    <tr>
                      <td className="pt-1.5 font-bold text-ink-subtle text-[10px]" colSpan={2}>MONTHLY DEBT</td>
                      <td className="pt-1.5 text-right font-black text-xs" colSpan={2}>{fmt$(totalLiabPmt)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </Panel>

            {/* Real Estate Owned */}
            <Panel title="REAL ESTATE OWNED">
              {reos.length === 0 ? (
                <p className="text-[10px] text-ink-subtle py-2 text-center">No properties</p>
              ) : reos.map((reo) => (
                <div key={reo.id} className="bg-surface-alt p-2 rounded border border-[#c1c6d6]/10 mb-2 last:mb-0">
                  <p className="text-[10px] font-bold text-ink">{fmtAddr(reo.address)}</p>
                  <div className="grid grid-cols-2 gap-1 mt-1 text-[10px]">
                    <span className="text-ink-subtle">Value: {fmt$0(reo.presentMarketValue)}</span>
                    <span className="text-ink-subtle">Mtg: {fmt$0(reo.mortgageBalance)}</span>
                    <span className="text-ink-subtle">Pmt: {fmt$0(reo.mortgagePayment)}</span>
                    <span className="text-go font-bold">Net Rent: {fmt$0(reo.netRentalIncome)}</span>
                  </div>
                </div>
              ))}
            </Panel>

            {/* Monthly PITI */}
            <Panel title="MONTHLY PITI">
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between"><span className="text-ink-mid">P & I</span><span className="font-medium">{fmt$(loan.monthlyPayment)}</span></div>
                <div className="pt-2 mt-2 border-t border-ink/10 flex justify-between items-end">
                  <span className="font-bold text-brand text-[10px] uppercase">Total Monthly</span>
                  <span className="text-lg font-extrabold font-sans text-ink">{fmt$(loan.monthlyPayment)}</span>
                </div>
              </div>
            </Panel>

            {/* Qualifying Ratios */}
            <Panel title="QUALIFYING RATIOS" className="border border-brand/10">
              <div className="grid grid-cols-3 gap-2 py-1">
                <div className="text-center">
                  <p className="text-[9px] text-ink-subtle font-bold uppercase">Front (HTI)</p>
                  <p className="text-xl font-extrabold text-ink">{frontRatio}{frontRatio !== '—' ? '%' : ''}</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] text-ink-subtle font-bold uppercase">Back (DTI)</p>
                  <p className="text-xl font-extrabold text-ink">{backRatio}{backRatio !== '—' ? '%' : ''}</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] text-ink-subtle font-bold uppercase">Reserves</p>
                  <p className="text-xl font-extrabold text-go">{reserves}</p>
                  {reserves !== '—' && <p className="text-[8px] text-ink-subtle">Months</p>}
                </div>
              </div>
            </Panel>
          </div>

          {/* ─── COLUMN 4: Transaction + Borrower Details ─── */}
          <div className="space-y-3">
            {/* Closing / Transaction */}
            <Panel title="CLOSING / TRANSACTION">
              <div className="space-y-1 text-[10px]">
                <TxRow label="Purchase Price" value={fmt$(tx.purchase_price || loan.purchase_price)} />
                <TxRow label="Est. Closing Costs" value={fmt$(tx.closingCostsEstimate)} />
                <TxRow label="Discount Points" value={fmt$(tx.discountPoints)} />
                {tx.sellerConcessions && <TxRow label="Seller Concessions" value={`(${fmt$(tx.sellerConcessions)})`} red />}
                {tx.subordinateFinancing && <TxRow label="Subordinate Fin." value={fmt$(tx.subordinateFinancing)} />}
                <div className="bg-go/20 p-2 rounded mt-2 border border-go/40 flex justify-between items-center">
                  <span className="font-black text-go-dark uppercase tracking-tight text-[10px]">Total Cash Needed</span>
                  <span className="text-lg font-extrabold text-go-dark font-sans">{fmt$(tx.cashFromBorrower)}</span>
                </div>
              </div>
            </Panel>

            {/* Borrower Details (Tabbed) */}
            <Panel>
              {borrowers.length > 1 && (
                <div className="flex gap-2 border-b border-[#eceeef] mb-3">
                  <button
                    onClick={() => setBorrowerTab(0)}
                    className={`text-[10px] font-bold pb-1.5 px-1 transition-colors ${borrowerTab === 0 ? 'border-b-2 border-brand text-brand' : 'text-ink-subtle'}`}
                  >BORROWER</button>
                  <button
                    onClick={() => setBorrowerTab(1)}
                    className={`text-[10px] font-bold pb-1.5 px-1 transition-colors ${borrowerTab === 1 ? 'border-b-2 border-brand text-brand' : 'text-ink-subtle'}`}
                  >CO-BORROWER</button>
                </div>
              )}
              {!borrowers.length && <p className="text-[10px] text-ink-subtle py-2">No borrower data</p>}
              {activeBorrower && (
                <div className="space-y-2 text-[11px]">
                  <div className="grid grid-cols-2 gap-2">
                    <div><DL>Housing</DL><DV>{housingMap[activeBorrower.housingType] || '—'}</DV></div>
                    <div><DL>Marital</DL><DV>{activeBorrower.maritalStatus || '—'}</DV></div>
                  </div>
                  <div><DL>Cell Phone</DL><DV>{activeBorrower.cellPhone || '—'}</DV></div>
                  <div><DL>Citizenship</DL><DV>{citizenMap[activeBorrower.citizenship] || '—'}</DV></div>
                  <div className="bg-surface-alt p-2 rounded mt-1">
                    <p className="text-[9px] font-bold text-ink-subtle uppercase">Current Address</p>
                    <p className="text-[11px] leading-tight text-ink mt-0.5">
                      {fmtAddr(activeBorrower.currentAddress)}
                      {(activeBorrower.addressYears || activeBorrower.addressMonths) && (
                        <span className="text-ink-subtle"> ({activeBorrower.addressYears || 0}yr {activeBorrower.addressMonths || 0}mo)</span>
                      )}
                    </p>
                  </div>
                  {activeBorrower.previousAddress && (
                    <div className="bg-surface-alt p-2 rounded">
                      <p className="text-[9px] font-bold text-ink-subtle uppercase">Previous Address</p>
                      <p className="text-[11px] leading-tight text-ink mt-0.5">
                        {fmtAddr(activeBorrower.previousAddress)}
                        {(activeBorrower.previousAddressYears || activeBorrower.previousAddressMonths) && (
                          <span className="text-ink-subtle"> ({activeBorrower.previousAddressYears || 0}yr {activeBorrower.previousAddressMonths || 0}mo)</span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </Panel>

            {/* ARM Details (conditional) */}
            {app.amortizationType === 'arm' ? (
              <Panel title="ARM DETAILS">
                <div className="space-y-1 text-[10px]">
                  <TxRow label="Index" value={app.armIndex || '—'} />
                  <TxRow label="Margin" value={app.armMargin ? `${app.armMargin}%` : '—'} />
                  <TxRow label="Initial Cap" value={app.armInitialCap ? `${app.armInitialCap}%` : '—'} />
                  <TxRow label="Periodic Cap" value={app.armPeriodicCap ? `${app.armPeriodicCap}%` : '—'} />
                  <TxRow label="Lifetime Cap" value={app.armLifetimeCap ? `${app.armLifetimeCap}%` : '—'} />
                </div>
              </Panel>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border-2 border-dashed border-[#c1c6d6]/30 flex items-center justify-center opacity-40 py-4">
                <div className="text-center">
                  <p className="text-[10px] font-bold text-ink-subtle uppercase">ARM Details (N/A)</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ═══ FOOTER BAR ═══ */}
      <footer className="flex justify-between items-center px-6 h-7 bg-ink">
        <div className="flex gap-3">
          <span className="text-teal-400 text-[10px] uppercase tracking-tight">Lender: {loan.lender_name || '—'}</span>
          <span className="text-ink-subtle text-[10px]">| LO: {loan.mlo ? `${loan.mlo.first_name} ${loan.mlo.last_name}` : '—'} | Loan #{loan.loan_number || '—'}</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-teal-400 text-[10px]">AUS: —</span>
          <span className="text-teal-400 text-[10px]">COMPLIANCE: —</span>
        </div>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════

function Panel({ icon, title, badge, action, className = '', children }) {
  return (
    <section className={`bg-white rounded-xl shadow-sm p-3 ${className}`}>
      {title && (
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-[11px] font-bold text-brand flex items-center gap-1.5">
            {icon && <span className="material-symbols-outlined text-sm">{icon}</span>}
            {title}
          </h2>
          <div className="flex items-center gap-2">
            {badge && <span className="text-[9px] bg-brand-light text-brand-dark px-2 py-0.5 rounded-full font-bold">{badge}</span>}
            {action && <button className="text-brand hover:bg-brand-light w-5 h-5 rounded flex items-center justify-center text-sm font-bold transition-colors">{action}</button>}
          </div>
        </div>
      )}
      {children}
    </section>
  );
}

function DL({ children, className = '' }) {
  return <p className={`text-[10px] text-ink-mid uppercase tracking-wide font-semibold ${className}`}>{children}</p>;
}

function DV({ children, bold, className = '' }) {
  return <p className={`text-[12px] text-ink ${bold ? 'font-bold' : 'font-medium'} ${className}`}>{children}</p>;
}

function DeclRow({ label, on, bad }) {
  const color = bad ? 'bg-[#ba1a1a]' : on ? 'bg-go' : 'bg-ink-subtle/40';
  return (
    <div className="flex justify-between items-center py-0.5">
      <span className="text-[11px] text-ink">{label}</span>
      <div className={`w-2 h-2 rounded-full ${color}`} />
    </div>
  );
}

function IncRow({ label, a, b, co }) {
  return (
    <tr>
      <td className="py-1 text-ink-mid">{label}</td>
      <td className="py-1 text-right text-ink">{fmt$0(a)}</td>
      {co && <td className="py-1 text-right text-ink">{fmt$0(b)}</td>}
    </tr>
  );
}

function TxRow({ label, value, red }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className={red ? 'text-[#ba1a1a] font-medium' : 'text-ink-mid'}>{label}</span>
      <span className={`font-medium ${red ? 'text-[#ba1a1a]' : 'text-ink'}`}>{value}</span>
    </div>
  );
}
