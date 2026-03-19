// Comparison Report — Full-page modal overlay modeled on David's Wagner spreadsheet.
// Sections: Savings & Pay-Back, Rate Comparison, Fee Detail, LLPA Breakdown, Lead CTA.
// Renders both on-screen (modal) and in print (@media print flattens the overlay).

'use client';

import { useState, useEffect, useRef } from 'react';
import { calculateLLPA, calculatePI, priceRates } from '@/lib/rates/engine';
import { LO_CONFIG } from '@/lib/rates/config';
import { STATE_DEFAULTS } from '@/lib/rates/closing-costs';
import { getUtmParams, formatUtmString } from '@/lib/utm';
import { PURPOSE_LABELS, PROP_LABELS, fmtDollar, fmtPI, getAutoPickRates } from './reportUtils';

export default function ComparisonReport({ compareRates, scenario, rateData, onClose }) {
  const [showFeeDetail, setShowFeeDetail] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const containerRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // --- Data setup ---
  const rates = priceRates(scenario, rateData);

  const llpa = calculateLLPA(scenario, rateData);
  const currentPI = scenario.currentRate ? calculatePI(scenario.currentRate, scenario.loanAmount) : null;
  const isRefi = scenario.purpose !== 'purchase';
  const stateLabel = STATE_DEFAULTS[scenario.state]?.label || scenario.state || '';
  const lenderFees = rateData.lender.lenderFees;
  const thirdPartyCosts = scenario.thirdPartyCosts || 0;

  // Sort rates low→high for display
  const ratesToShow = (compareRates.length > 0 ? compareRates : getAutoPickRates(rates, lenderFees, thirdPartyCosts))
    .slice().sort((a, b) => a.rate - b.rate);
  if (ratesToShow.length === 0 || !scenario.loanAmount || scenario.loanAmount <= 0) return null;
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // --- Lead capture ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const utmParams = getUtmParams();
      const utmString = formatUtmString(utmParams);
      const rateList = ratesToShow.map(r => `${r.rate.toFixed(3)}%`).join(', ');
      const description = [
        `Rate Tool - Comparison Report: ${rateList}`,
        `Scenario: ${PURPOSE_LABELS[scenario.purpose]}, ${scenario.fico} FICO, ${Math.round(scenario.ltv)}% LTV, ${fmtDollar(scenario.loanAmount)} loan`,
        currentPI ? `Current Rate: ${scenario.currentRate}%` : null,
        utmString || null,
      ].filter(Boolean).join('\n');

      const res = await fetch('/api/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          message: description,
          leadSource: 'Rate Tool - Lock My Rate',
        }),
      });
      if (!res.ok) throw new Error('Something went wrong. Please try again or call us directly.');
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPDF = async () => {
    setPdfBusy(true);
    try {
      const [{ pdf }, { default: ReportPDF }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./ReportPDF'),
      ]);
      const blob = await pdf(
        <ReportPDF
          compareRates={ratesToShow}
          scenario={scenario}
          rateData={rateData}
          llpa={llpa}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `NetRate-Rate-Comparison-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF generation failed:', err);
      // Fallback to browser print
      if (containerRef.current) containerRef.current.scrollTop = 0;
      setTimeout(() => window.print(), 100);
    } finally {
      setPdfBusy(false);
    }
  };

  // Column count for spanning
  const colCount = ratesToShow.length + 1;

  return (
    <div
      className="report-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 print:static print:bg-transparent print:block"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Modal container */}
      <div
        ref={containerRef}
        className="report-container bg-white rounded-xl shadow-2xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-y-auto print:max-w-none print:max-h-none print:mx-0 print:shadow-none print:rounded-none print:overflow-visible"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-8 print:p-0">

          {/* ===== HEADER ===== */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl font-bold text-cyan-700">{LO_CONFIG.company}</h1>
              <p className="text-sm text-gray-500">NMLS #{LO_CONFIG.nmls}</p>
              <p className="text-xs text-gray-400 mt-0.5">{LO_CONFIG.address} | {LO_CONFIG.phone}</p>
            </div>
            <div className="text-right print:hidden flex items-center gap-3">
              <button
                onClick={handleDownloadPDF}
                disabled={pdfBusy}
                className="text-xs font-semibold border border-gray-300 text-gray-600 rounded-md px-3 py-1.5 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {pdfBusy ? 'Generating...' : 'Download PDF'}
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none ml-2"
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            {/* Print-only date */}
            <div className="hidden print:block text-right">
              <p className="text-sm text-gray-500">{today}</p>
              <p className="text-xs text-gray-400">Rates effective {rateData.lender.effectiveDate}</p>
            </div>
          </div>

          <div className="border-t-2 border-cyan-600 pt-4 mb-6">
            <h2 className="text-xl font-semibold text-gray-800">Savings and Pay-Back Period for Refinance</h2>
            <p className="text-sm text-gray-500 mt-1">Prepared by {LO_CONFIG.name} | {today}</p>
            <p className="text-xs text-gray-400">30 Year Fixed | Effective rates as of {rateData.lender.effectiveDate}</p>
          </div>

          {/* ===== SCENARIO SUMMARY ===== */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Your Scenario</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-sm">
              <div><span className="text-gray-500">Purpose:</span> {PURPOSE_LABELS[scenario.purpose]}</div>
              <div><span className="text-gray-500">Property:</span> {fmtDollar(scenario.propertyValue)} | {PROP_LABELS[scenario.propertyType]}</div>
              <div><span className="text-gray-500">Loan Amount:</span> <strong>{fmtDollar(scenario.loanAmount)}</strong></div>
              <div><span className="text-gray-500">LTV:</span> {scenario.ltv?.toFixed(1)}%</div>
              <div><span className="text-gray-500">Credit Score:</span> {scenario.fico}+</div>
              <div><span className="text-gray-500">State:</span> {stateLabel}</div>
              {currentPI && <div><span className="text-gray-500">Current Rate:</span> <strong>{scenario.currentRate}%</strong></div>}
              {currentPI && <div><span className="text-gray-500">Current P&I:</span> {fmtPI(currentPI)}</div>}
            </div>
          </div>

          {/* ===== SECTION 1: SAVINGS & PAY-BACK (REFI ONLY) ===== */}
          {isRefi && currentPI && (
            <div className="mb-6 print-page">
              <table className="w-full text-sm border border-gray-300">
                <thead>
                  <tr className="bg-cyan-50">
                    <th className="px-4 py-2.5 text-left text-gray-700 border-b border-gray-300 font-semibold">Refinance Savings</th>
                    {ratesToShow.map(r => (
                      <th key={r.rate} className="px-4 py-2.5 text-right text-cyan-700 border-b border-gray-300 font-bold text-base">
                        {r.rate.toFixed(3)}%
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200">
                    <td className="px-4 py-2 text-gray-600">New Principal and Interest Payment</td>
                    {ratesToShow.map(r => (
                      <td key={r.rate} className="px-4 py-2 text-right font-mono">{fmtPI(r.monthlyPI)}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <td className="px-4 py-2 text-gray-800 font-semibold">Monthly Savings</td>
                    {ratesToShow.map(r => {
                      const sav = currentPI - r.monthlyPI;
                      return (
                        <td key={r.rate} className={`px-4 py-2 text-right font-mono font-semibold ${sav > 0 ? 'text-green-700' : 'text-gray-400'}`}>
                          {sav > 0 ? fmtDollar(Math.round(sav)) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <td className="px-4 py-2 text-gray-800 font-semibold">Annual Savings</td>
                    {ratesToShow.map(r => {
                      const sav = currentPI - r.monthlyPI;
                      return (
                        <td key={r.rate} className={`px-4 py-2 text-right font-mono font-semibold ${sav > 0 ? 'text-green-700' : 'text-gray-400'}`}>
                          {sav > 0 ? fmtDollar(Math.round(sav * 12)) : '—'}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Spacer row for cost section */}
                  <tr className="bg-cyan-50">
                    <td className="px-4 py-2.5 text-gray-700 font-semibold border-t border-gray-300">Refinance Costs</td>
                    {ratesToShow.map(r => (
                      <td key={r.rate} className="px-4 py-2.5 text-right text-cyan-700 border-t border-gray-300 font-bold">
                        {r.rate.toFixed(3)}%
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="px-4 py-2 text-gray-600">Loan Costs (excl. escrows & daily interest)</td>
                    {ratesToShow.map(r => (
                      <td key={r.rate} className="px-4 py-2 text-right font-mono">{fmtDollar(lenderFees + thirdPartyCosts)}</td>
                    ))}
                  </tr>
                  <tr className="border-b border-gray-200">
                    <td className="px-4 py-2 text-gray-600">
                      <span className="text-green-700">(Credit)</span> or <span className="text-red-600">Charge</span> for Rate
                    </td>
                    {ratesToShow.map(r => {
                      const isCredit = r.creditDollars < 0;
                      return (
                        <td key={r.rate} className={`px-4 py-2 text-right font-mono ${isCredit ? 'text-green-700' : 'text-red-600'}`}>
                          {isCredit ? `(${fmtDollar(Math.abs(r.creditDollars))})` : fmtDollar(r.creditDollars)}
                        </td>
                      );
                    })}
                  </tr>
                  <tr className="border-b border-gray-200 bg-gray-50 font-semibold">
                    <td className="px-4 py-2 text-gray-800">Total Loan Costs*</td>
                    {ratesToShow.map(r => {
                      const total = lenderFees + thirdPartyCosts + r.creditDollars;
                      return (
                        <td key={r.rate} className="px-4 py-2 text-right font-mono">{fmtDollar(total)}</td>
                      );
                    })}
                  </tr>

                  {/* Pay-back */}
                  <tr className="border-b border-gray-200 bg-cyan-50">
                    <td className="px-4 py-2.5 text-gray-700 font-semibold text-xs">
                      Pay Back Period in Months = Cost of Loan &divide; Monthly Savings
                    </td>
                    {ratesToShow.map(r => {
                      const sav = currentPI - r.monthlyPI;
                      const total = lenderFees + thirdPartyCosts + r.creditDollars;
                      const months = sav > 0 ? total / sav : null;
                      return (
                        <td key={r.rate} className="px-4 py-2.5 text-right font-mono font-bold text-cyan-700">
                          {months !== null && months > 0 ? months.toFixed(1) : months !== null && months <= 0 ? 'Instant' : '—'}
                        </td>
                      );
                    })}
                  </tr>
                  <tr className="bg-cyan-50">
                    <td className="px-4 py-2 text-gray-600 text-xs">Pay Back Period in Years</td>
                    {ratesToShow.map(r => {
                      const sav = currentPI - r.monthlyPI;
                      const total = lenderFees + thirdPartyCosts + r.creditDollars;
                      const months = sav > 0 ? total / sav : null;
                      return (
                        <td key={r.rate} className="px-4 py-2 text-right font-mono text-cyan-700">
                          {months !== null && months > 0 ? (months / 12).toFixed(2) : months !== null && months <= 0 ? 'Instant' : '—'}
                        </td>
                      );
                    })}
                  </tr>
                  {/* Visual payback progress bars */}
                  <tr className="bg-cyan-50 print:hidden">
                    <td className="px-4 py-3 text-gray-500 text-[10px] uppercase tracking-wider">Breakeven Visual</td>
                    {ratesToShow.map(r => {
                      const sav = currentPI - r.monthlyPI;
                      const total = lenderFees + thirdPartyCosts + r.creditDollars;
                      const months = sav > 0 ? total / sav : null;
                      const years = months !== null && months > 0 ? months / 12 : 0;
                      // Scale: 5 years = full bar, instant = full bar green
                      const pct = months !== null && months <= 0 ? 100 : Math.min(100, Math.max(5, (1 - years / 5) * 100));
                      const color = years <= 0 ? 'bg-emerald-500' : years < 2 ? 'bg-brand' : years < 3.5 ? 'bg-amber-400' : 'bg-red-400';
                      return (
                        <td key={r.rate} className="px-4 py-3">
                          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${color}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="text-[10px] text-gray-500 mt-1 text-center tabular-nums">
                            {months !== null && months <= 0 ? 'Instant ✓' : months !== null ? `${years.toFixed(1)} yrs` : '—'}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
              <p className="text-xs text-gray-400 mt-2">
                *Loan costs do not include new escrow payments (taxes/insurance), daily interest on the new loan, or interest added to your current payoff. You will defer one mortgage payment and receive your escrow refund from your current lender within 30 days of closing.
              </p>
            </div>
          )}

          {/* ===== SECTION 2: RATE COMPARISON (ALL PURPOSES) ===== */}
          <div className="mb-6 print-page">
            <h3 className="text-base font-semibold text-gray-800 mb-3">Comparison of {ratesToShow.length === 1 ? 'Selected' : ratesToShow.length} Rate{ratesToShow.length > 1 ? 's' : ''}</h3>
            <table className="w-full text-sm border border-gray-300">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2 text-left text-gray-600 border-b border-gray-300"></th>
                  {ratesToShow.map((r) => {
                    // Label the "no cost" option (where credit > loan costs)
                    const total = lenderFees + thirdPartyCosts + r.creditDollars;
                    const noCost = total <= 0;
                    return (
                      <th key={r.rate} className="px-4 py-2 text-right border-b border-gray-300">
                        <span className="text-cyan-700 font-bold">{r.rate.toFixed(3)}%</span>
                        {noCost && <span className="block text-xs text-green-600 font-medium">NO COST OPTION</span>}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="px-4 py-2 text-gray-600">Lender <span className="text-green-700">(Credit)</span> or <span className="text-red-600">Charge</span> as %</td>
                  {ratesToShow.map(r => (
                    <td key={r.rate} className={`px-4 py-2 text-right font-mono ${r.adjPrice < 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {r.adjPrice < 0 ? '-' : ''}{Math.abs(r.adjPrice).toFixed(3)}%
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="px-4 py-2 text-gray-600">Lender <span className="text-green-700">(Credit)</span> or <span className="text-red-600">Charge</span> as $</td>
                  {ratesToShow.map(r => {
                    const isCredit = r.creditDollars < 0;
                    return (
                      <td key={r.rate} className={`px-4 py-2 text-right font-mono ${isCredit ? 'text-green-700' : 'text-red-600'}`}>
                        {isCredit ? `(${fmtDollar(Math.abs(r.creditDollars))})` : fmtDollar(r.creditDollars)}
                      </td>
                    );
                  })}
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-1 text-gray-400 text-xs">Loan Amount</td>
                  {ratesToShow.map(r => (
                    <td key={r.rate} className="px-4 py-1 text-right font-mono text-gray-600 font-semibold">{fmtDollar(scenario.loanAmount)}</td>
                  ))}
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="px-4 py-1 text-gray-400 text-xs">Loan to Value</td>
                  {ratesToShow.map(r => (
                    <td key={r.rate} className="px-4 py-1 text-right font-mono text-gray-500">{scenario.ltv?.toFixed(1)}%</td>
                  ))}
                </tr>

                {/* Monthly Payment */}
                <tr className="bg-gray-50 border-t border-gray-300">
                  <td colSpan={colCount} className="px-4 py-2 text-gray-700 font-semibold text-xs uppercase tracking-wider">Monthly Payment Comparison</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="px-4 py-2 text-gray-600">Principal and Interest</td>
                  {ratesToShow.map(r => (
                    <td key={r.rate} className="px-4 py-2 text-right font-mono">{fmtPI(r.monthlyPI)}</td>
                  ))}
                </tr>

                {/* Fees Summary */}
                <tr className="bg-gray-50 border-t border-gray-300">
                  <td colSpan={colCount} className="px-4 py-2 text-gray-700 font-semibold text-xs uppercase tracking-wider">Fees Information</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="px-4 py-2 text-gray-600">Lender Fees</td>
                  {ratesToShow.map(r => (
                    <td key={r.rate} className="px-4 py-2 text-right font-mono">{fmtDollar(lenderFees)}</td>
                  ))}
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="px-4 py-2 text-gray-600">Est. Third-Party Fees ({stateLabel})</td>
                  {ratesToShow.map(r => (
                    <td key={r.rate} className="px-4 py-2 text-right font-mono">{fmtDollar(thirdPartyCosts)}</td>
                  ))}
                </tr>
                <tr className="border-b border-gray-200 bg-gray-50 font-semibold">
                  <td className="px-4 py-2 text-gray-800">Total Estimated Closing Costs</td>
                  {ratesToShow.map(r => {
                    const total = lenderFees + thirdPartyCosts + r.creditDollars;
                    return (
                      <td key={r.rate} className="px-4 py-2 text-right font-mono">{fmtDollar(total)}</td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          {/* ===== SECTION 3: FEE DETAIL (COLLAPSIBLE) ===== */}
          <div className="mb-6 print:hidden">
            <button
              onClick={() => setShowFeeDetail(!showFeeDetail)}
              className="text-sm text-brand font-medium hover:underline flex items-center gap-1"
            >
              {showFeeDetail ? '▾' : '▸'} {showFeeDetail ? 'Hide' : 'Show'} Fee Details
            </button>
            {showFeeDetail && (
              <div className="mt-3 border border-gray-200 rounded-lg p-4">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-gray-200">
                      <td className="py-2 text-gray-700 font-semibold">Lender Fees (A)</td>
                      <td className="py-2 text-right font-mono">{fmtDollar(lenderFees)}</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="py-2 text-gray-700 font-semibold">Est. Third-Party Fees (B) — {stateLabel} avg.</td>
                      <td className="py-2 text-right font-mono">{fmtDollar(thirdPartyCosts)}</td>
                    </tr>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <td className="py-2 text-gray-800 font-bold">Total A + B</td>
                      <td className="py-2 text-right font-mono font-bold">{fmtDollar(lenderFees + thirdPartyCosts)}</td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-xs text-gray-400 mt-3">
                  Third-party fees are estimated based on {stateLabel} state averages and include title, escrow, appraisal, and recording fees. Contact us for an exact line-item Loan Estimate.
                </p>
              </div>
            )}
          </div>

          {/* Print-only fee detail (always shown) */}
          <div className="hidden print:block mb-6 print-page">
            <h3 className="text-base font-semibold text-gray-800 mb-3">Fee Details</h3>
            <table className="w-full text-sm border border-gray-200">
              <tbody>
                <tr className="border-b border-gray-200">
                  <td className="px-4 py-2 text-gray-700 font-semibold">Lender Fees (A)</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtDollar(lenderFees)}</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td className="px-4 py-2 text-gray-700 font-semibold">Est. Third-Party Fees (B) — {stateLabel}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtDollar(thirdPartyCosts)}</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-4 py-2 text-gray-800 font-bold">Total A + B</td>
                  <td className="px-4 py-2 text-right font-mono font-bold">{fmtDollar(lenderFees + thirdPartyCosts)}</td>
                </tr>
              </tbody>
            </table>
            <p className="text-xs text-gray-400 mt-2">
              Third-party fees estimated for {stateLabel}. Contact for exact line-item Loan Estimate.
            </p>
          </div>

          {/* ===== LLPA BREAKDOWN ===== */}
          <div className="mb-6 print-page">
            <h3 className="text-base font-semibold text-gray-800 mb-3">Price Adjustments (LLPA)</h3>
            <table className="w-full text-xs border border-gray-200">
              <tbody>
                {llpa.breakdown.map((adj, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="px-4 py-1.5 text-gray-600">{adj.label}</td>
                    <td className={`px-4 py-1.5 text-right font-mono ${adj.value > 0 ? 'text-red-600' : 'text-green-700'}`}>
                      {adj.value > 0 ? '+' : ''}{adj.value.toFixed(3)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-4 py-1.5 text-gray-700">Total Adjustment</td>
                  <td className="px-4 py-1.5 text-right font-mono">
                    {llpa.total > 0 ? '+' : ''}{llpa.total.toFixed(3)} pts
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ===== CTA SECTION (screen only) ===== */}
          <div className="print:hidden border-t border-gray-200 pt-6 mb-4">
            {submitted ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Thank you!</h3>
                <p className="text-sm text-gray-600">
                  I&apos;ll review your scenario and reach out shortly to lock your rate and discuss next steps.
                </p>
                <p className="text-sm text-brand font-medium mt-3">
                  &mdash; {LO_CONFIG.name}, {LO_CONFIG.phone}
                </p>
              </div>
            ) : (
              <div className="max-w-md mx-auto">
                <h3 className="text-lg font-bold text-gray-900 text-center mb-1">Ready to Lock In Your Rate?</h3>
                <p className="text-sm text-gray-500 text-center mb-4">
                  Like what you see? Drop your info and I&apos;ll reach out to lock your rate and walk you through next steps.
                </p>
                <form onSubmit={handleSubmit} className="space-y-3">
                  <input type="text" placeholder="Full Name" required value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10" />
                  <input type="tel" placeholder="Phone Number" required value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10" />
                  <input type="email" placeholder="Email Address" required value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10" />
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <button type="submit" disabled={submitting}
                    className="w-full bg-brand text-white rounded-lg py-3 font-semibold hover:bg-brand-dark transition-colors disabled:opacity-50">
                    {submitting ? 'Sending...' : 'Lock My Rate'}
                  </button>
                </form>
                <p className="text-xs text-gray-400 text-center mt-3">No credit pull. No obligation. Just real numbers.</p>
                <p className="text-[10px] text-gray-300 text-center mt-2 leading-relaxed">
                  By submitting, you agree to receive recurring text messages from NetRate Mortgage
                  related to your inquiry. Msg frequency varies. Msg &amp; data rates may apply.
                  Reply STOP to cancel, HELP for help.{' '}
                  <a href="/privacy" className="underline hover:text-gray-400">Privacy Policy</a>{' '}&amp;{' '}
                  <a href="/terms" className="underline hover:text-gray-400">SMS Terms</a>.
                </p>
              </div>
            )}
          </div>

          {/* ===== DISCLAIMER ===== */}
          <div className="mt-6 pt-4 border-t border-gray-300 text-xs text-gray-500 space-y-2">
            <p>Rates shown are approximate based on today&apos;s wholesale pricing and standard loan-level price adjustments. Actual rates depend on full credit review, property appraisal, and underwriting approval. Third-party cost estimates are based on state averages and may vary by county and provider. Not a commitment to lend.</p>
            <p>{LO_CONFIG.name} | NMLS #{LO_CONFIG.nmls} | {LO_CONFIG.company} | {LO_CONFIG.phone} | {LO_CONFIG.email}</p>
            <p className="text-gray-400">netratemortgage.com</p>
          </div>

        </div>
      </div>
    </div>
  );
}
