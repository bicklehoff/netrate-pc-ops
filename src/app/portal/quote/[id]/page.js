'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

/* ── Formatters ── */
function fmt(n) {
  if (n == null) return '$0';
  const num = Number(n);
  const neg = num < 0;
  const abs = Math.abs(num);
  const str = '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return neg ? `(${str})` : str;
}

function fmtInt(n) {
  if (n == null) return '$0';
  return '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function pct(n) {
  if (n == null) return '0%';
  return Number(n).toFixed(3) + '%';
}

/* ── Amortization calculator ── */
function buildAmortization(loanAmount, annualRate, termYears) {
  const monthlyRate = annualRate / 100 / 12;
  const totalPayments = termYears * 12;
  const payment = monthlyRate > 0
    ? loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, totalPayments)) / (Math.pow(1 + monthlyRate, totalPayments) - 1)
    : loanAmount / totalPayments;

  const yearly = [];
  let balance = loanAmount;
  let yearPrincipal = 0;
  let yearInterest = 0;

  for (let m = 1; m <= totalPayments; m++) {
    const interest = balance * monthlyRate;
    const principal = payment - interest;
    balance -= principal;
    yearPrincipal += principal;
    yearInterest += interest;

    if (m % 12 === 0) {
      yearly.push({
        year: m / 12,
        principal: yearPrincipal,
        interest: yearInterest,
        totalPayment: yearPrincipal + yearInterest,
        balance: Math.max(0, balance),
      });
      yearPrincipal = 0;
      yearInterest = 0;
    }
  }
  return yearly;
}

/* ── Tab definitions ── */
const TABS = [
  { id: 'summary', label: 'Loan Summary' },
  { id: 'payments', label: 'Monthly Payments' },
  { id: 'costs', label: 'Closing Costs' },
  { id: 'amortization', label: 'Amortization' },
];

/* ── Main component ── */
function QuoteViewContent() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/portal/quotes/${id}?token=${token || ''}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load quote');
        setQuote(data.quote);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center">
        <div className="text-[#737783] animate-pulse">Loading your quote...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-sm">
          <h2 className="text-lg font-bold text-[#191c1e] mb-2">Quote Unavailable</h2>
          <p className="text-[#737783] text-sm mb-4">{error}</p>
          <p className="text-[#737783] text-xs">Contact David at 303-444-5251 or david@netratemortgage.com</p>
        </div>
      </div>
    );
  }

  const scenarios = quote.scenarios || [];
  const fees = quote.feeBreakdown;
  const loanAmount = Number(quote.loanAmount);
  const propertyValue = Number(quote.propertyValue);
  const ltv = Number(quote.ltv);
  const term = quote.term || 30;
  const monthlyTax = fees?.monthlyTax || 0;
  const monthlyIns = fees?.monthlyInsurance || 0;

  return (
    <div className="min-h-screen bg-[#f8f9fb] flex flex-col">
      {/* Sticky header with nav tabs */}
      <header className="bg-white/80 backdrop-blur-xl sticky top-0 z-50 border-b border-[#c3c6d4]/15">
        <div className="max-w-5xl mx-auto px-4 sm:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-8">
              <span className="text-xl font-extrabold tracking-tight text-[#191c1e]">
                Net<span className="text-cyan-600">Rate</span> <span className="font-normal text-[#191c1e]/60 text-base">Mortgage</span>
              </span>
              <nav className="hidden md:flex gap-1 items-center">
                {TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      activeTab === tab.id
                        ? 'text-cyan-700 bg-cyan-50'
                        : 'text-[#191c1e]/50 hover:text-cyan-700 hover:bg-[#f2f4f6]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              {quote.pdfUrl && (
                <a
                  href={quote.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2 bg-gradient-to-r from-cyan-700 to-cyan-600 text-white rounded-xl text-sm font-semibold shadow-sm hover:opacity-90 transition-all"
                >
                  Download PDF
                </a>
              )}
            </div>
          </div>
          {/* Mobile tabs */}
          <div className="md:hidden flex gap-1 pb-3 overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'text-cyan-700 bg-cyan-50'
                    : 'text-[#191c1e]/50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto w-full px-4 sm:px-8 py-8 flex-1">
        {activeTab === 'summary' && (
          <LoanSummaryTab
            quote={quote}
            scenarios={scenarios}
            fees={fees}
            loanAmount={loanAmount}
            propertyValue={propertyValue}
            ltv={ltv}
            term={term}
            monthlyTax={monthlyTax}
            monthlyIns={monthlyIns}
          />
        )}
        {activeTab === 'payments' && (
          <MonthlyPaymentsTab
            scenarios={scenarios}
            monthlyTax={monthlyTax}
            monthlyIns={monthlyIns}
          />
        )}
        {activeTab === 'costs' && (
          <ClosingCostsTab
            scenarios={scenarios}
            fees={fees}
            loanAmount={loanAmount}
            propertyValue={propertyValue}
            quote={quote}
          />
        )}
        {activeTab === 'amortization' && (
          <AmortizationTab
            scenarios={scenarios}
            loanAmount={loanAmount}
            term={term}
          />
        )}

        {/* CTA */}
        <div className="mt-8 bg-[#191c1e] rounded-2xl p-8 text-center text-white">
          <h3 className="text-xl font-extrabold mb-2">Ready to move forward?</h3>
          <p className="text-white/50 text-sm mb-5">Call David to lock your rate or discuss your options.</p>
          <div className="flex justify-center gap-4 flex-wrap">
            <a
              href="tel:3034445251"
              className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-cyan-500 text-white rounded-xl font-bold text-sm hover:opacity-90 transition-all"
            >
              Call 303-444-5251
            </a>
            <a
              href="mailto:david@netratemortgage.com"
              className="px-6 py-2.5 bg-white/10 text-white rounded-xl font-medium text-sm hover:bg-white/20 transition-all"
            >
              Email David
            </a>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-[10px] text-[#737783] leading-relaxed mt-6 italic">
          This comparison is for informational purposes only. Actual rates, payments, and fees are subject to final credit approval, appraisal, and market fluctuations. Lender credits are applied toward closing costs and cannot result in cash back to the borrower. NetRate Mortgage LLC | NMLS #1111861 | Equal Housing Lender.
        </p>

        {/* Expiration */}
        {quote.expiresAt && (
          <p className="text-[10px] text-[#737783] text-center mt-3">
            Quote valid through {new Date(quote.expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-[#c3c6d4]/15 px-8 py-6 mt-auto">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-3 text-xs text-[#191c1e]/50">
          <p>&copy; {new Date().getFullYear()} NetRate Mortgage LLC. NMLS #1111861. Equal Housing Lender.</p>
          <p>357 S McCaslin Blvd #200, Louisville, CO 80027</p>
        </div>
      </footer>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   TAB 1: Loan Summary
   ═══════════════════════════════════════════════ */
function LoanSummaryTab({ quote, scenarios, fees, loanAmount, propertyValue, ltv, monthlyTax, monthlyIns }) {
  const date = new Date(quote.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
  const rates = scenarios.slice(0, 3);

  return (
    <div className="space-y-8">
      {/* Borrower + Date header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-[#c3c6d4]/15">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-600 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-cyan-700">NetRate Mortgage</h1>
              <p className="text-xs uppercase tracking-widest text-[#737783]">Personalized Rate Quote</p>
            </div>
          </div>
          <div>
            <p className="font-bold text-[#191c1e]">David Burson</p>
            <p className="text-sm text-[#737783]">Loan Officer | NMLS #641790</p>
          </div>
        </div>
        <div className="text-right">
          <div className="inline-block px-4 py-1 bg-[#f2f4f6] rounded-full mb-2">
            <p className="text-xs font-semibold text-[#737783]">OFFICIAL QUOTE REPORT</p>
          </div>
          <h2 className="text-lg font-bold text-[#191c1e]">Borrower: {quote.borrowerName || 'Valued Client'}</h2>
          <p className="text-sm text-[#737783]">Date Prepared: {date}</p>
        </div>
      </div>

      {/* Key figures banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard label="Appraised Value" value={fmtInt(propertyValue)} />
        <SummaryCard label="Loan Amount" value={fmtInt(loanAmount)} />
        <SummaryCard label="Loan to Value (LTV)" value={ltv.toFixed(1) + '%'} />
      </div>

      {/* Rate comparison */}
      <div>
        <SectionTitle>Comparison of Rates</SectionTitle>
        <ComparisonTable>
          <CompHeader rates={rates} />
          <CompRow label="Rate" values={rates.map(r => ({ text: pct(r.rate), bold: true }))} />
          <CompRow label="Lender Credit / (Charge) %" values={rates.map(r => {
            const isCredit = r.rebateDollars > 0;
            const price = r.price || 100;
            const val = isCredit ? (price - 100).toFixed(3) : (100 - price).toFixed(3);
            return { text: isCredit ? val + '%' : '(' + val + '%)', color: isCredit ? 'green' : 'red' };
          })} alt />
          <CompRow label="Lender Credit / (Charge) $" values={rates.map(r => {
            const isCredit = r.rebateDollars > 0;
            return isCredit
              ? { text: fmtInt(r.rebateDollars), color: 'green' }
              : { text: '(' + fmtInt(r.discountDollars || 0) + ')', color: 'red' };
          })} />
        </ComparisonTable>
      </div>

      {/* Quick monthly payment summary */}
      <div>
        <SectionTitle>Monthly Payment Comparison</SectionTitle>
        <ComparisonTable>
          <CompHeader rates={rates} />
          <CompRow label="Principal & Interest" values={rates.map(r => ({ text: fmt(r.monthlyPI) }))} />
          <CompRow label={`Taxes (${new Date().getFullYear()})`} values={rates.map(() => ({ text: fmt(monthlyTax) }))} alt />
          <CompRow label="Insurance (est)" values={rates.map(() => ({ text: fmt(monthlyIns) }))} />
          <CompRow label="PMI" values={rates.map(() => ({ text: '$0.00' }))} alt />
          <TotalRow label="Total Monthly Payment" values={rates.map(r => ({
            text: fmt(Number(r.monthlyPI || 0) + monthlyTax + monthlyIns),
          }))} />
        </ComparisonTable>
      </div>

      {/* Cash to close summary */}
      <CashToCloseSection
        rates={rates}
        fees={fees}
        loanAmount={loanAmount}
        propertyValue={propertyValue}
        quote={quote}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════
   TAB 2: Monthly Payments (detailed)
   ═══════════════════════════════════════════════ */
function MonthlyPaymentsTab({ scenarios, monthlyTax, monthlyIns }) {
  const rates = scenarios.slice(0, 3);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-[#191c1e] mb-1">Monthly Payment Breakdown</h2>
        <p className="text-sm text-[#737783]">Detailed view of what makes up your monthly mortgage payment for each rate option.</p>
      </div>

      {/* Per-rate cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {rates.map((r, i) => {
          const total = Number(r.monthlyPI || 0) + monthlyTax + monthlyIns;
          const piPct = (Number(r.monthlyPI || 0) / total * 100).toFixed(0);
          const taxPct = (monthlyTax / total * 100).toFixed(0);
          const insPct = (monthlyIns / total * 100).toFixed(0);

          return (
            <div key={i} className="bg-white rounded-2xl p-6 shadow-sm">
              <div className="text-xs uppercase tracking-widest text-[#737783] mb-1">Option {i + 1}</div>
              <div className="text-3xl font-extrabold text-[#191c1e] mb-1">{pct(r.rate)}</div>
              <div className="text-sm text-[#737783] mb-6">{r.program || 'Fixed Rate'}</div>

              {/* Visual bar */}
              <div className="flex rounded-full overflow-hidden h-3 mb-6">
                <div className="bg-cyan-600" style={{ width: piPct + '%' }} />
                <div className="bg-amber-400" style={{ width: taxPct + '%' }} />
                <div className="bg-emerald-400" style={{ width: insPct + '%' }} />
              </div>

              {/* Line items */}
              <div className="space-y-3">
                <PaymentLineItem color="bg-cyan-600" label="Principal & Interest" amount={fmt(r.monthlyPI)} />
                <PaymentLineItem color="bg-amber-400" label={`Taxes (${new Date().getFullYear()})`} amount={fmt(monthlyTax)} />
                <PaymentLineItem color="bg-emerald-400" label="Insurance (est)" amount={fmt(monthlyIns)} />
                <PaymentLineItem color="bg-gray-200" label="PMI" amount="$0.00" />
              </div>

              {/* Total */}
              <div className="mt-6 pt-4 border-t border-[#c3c6d4]/20">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[#191c1e]">Total Payment</span>
                  <span className="text-2xl font-extrabold text-cyan-700">{fmt(total)}</span>
                </div>
              </div>

              {/* Credit/charge badge */}
              {(r.rebateDollars > 0 || r.discountDollars > 0) && (
                <div className="mt-3">
                  {r.rebateDollars > 0 && (
                    <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold">
                      Lender credit: {fmtInt(r.rebateDollars)}
                    </span>
                  )}
                  {r.discountDollars > 0 && (
                    <span className="inline-block px-3 py-1 bg-red-50 text-red-600 rounded-full text-xs font-semibold">
                      Discount points: {fmtInt(r.discountDollars)}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   TAB 3: Closing Costs
   ═══════════════════════════════════════════════ */
function ClosingCostsTab({ scenarios, fees, loanAmount, propertyValue, quote }) {
  const rates = scenarios.slice(0, 3);

  // Calculate daily interest per rate
  const closingDate = fees?.closingDate ? new Date(fees.closingDate) : null;
  const daysInterest = closingDate
    ? (new Date(closingDate.getFullYear(), closingDate.getMonth() + 1, 0).getDate() - closingDate.getDate() + 1)
    : 7;

  const feeSections = [
    { key: 'sectionA', icon: 'A' },
    { key: 'sectionB', icon: 'B' },
    { key: 'sectionC', icon: 'C' },
    { key: 'sectionE', icon: 'E' },
    { key: 'sectionF', icon: 'F' },
    { key: 'sectionG', icon: 'G' },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-[#191c1e] mb-1">Closing Costs</h2>
        <p className="text-sm text-[#737783]">Detailed breakdown of all fees. These match the Loan Estimate form sections A through H.</p>
      </div>

      {/* Fee breakdown sections */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {feeSections.map(({ key, icon }) => {
          const section = fees?.[key];
          if (!section || section.items?.length === 0) return null;
          return (
            <div key={key}>
              {/* Section header */}
              <div className="flex justify-between items-center px-6 py-3 bg-[#f2f4f6]">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-md bg-cyan-600 text-white text-xs font-bold flex items-center justify-center">{icon}</span>
                  <span className="font-bold text-sm text-[#191c1e]">{section.label}</span>
                </div>
                <span className="font-bold text-sm text-[#191c1e] tabular-nums">{fmt(section.total)}</span>
              </div>
              {/* Items */}
              {section.items?.map((item, i) => (
                <div key={i} className={`flex justify-between items-center px-6 py-2.5 ${i % 2 === 0 ? 'bg-white' : 'bg-[#f8f9fb]'}`}>
                  <span className="text-sm text-[#434652] pl-9">{item.label}</span>
                  <span className="text-sm tabular-nums text-[#191c1e]">{fmt(item.amount)}</span>
                </div>
              ))}
            </div>
          );
        })}

        {/* Daily interest per rate */}
        <div className="px-6 py-3 bg-[#f2f4f6]">
          <span className="font-bold text-sm text-[#191c1e]">Daily Interest ({daysInterest} days, per rate)</span>
        </div>
        {rates.map((r, i) => {
          const daily = (loanAmount * (r.rate / 100)) / 365 * daysInterest;
          return (
            <div key={i} className={`flex justify-between items-center px-6 py-2.5 ${i % 2 === 0 ? 'bg-white' : 'bg-[#f8f9fb]'}`}>
              <span className="text-sm text-[#434652] pl-9">Option {i + 1} — {pct(r.rate)}</span>
              <span className="text-sm tabular-nums text-[#191c1e]">{fmt(daily)}</span>
            </div>
          );
        })}

        {/* Total */}
        <div className="flex justify-between items-center px-6 py-4 bg-[#191c1e] text-white">
          <span className="font-extrabold">Total of All Loan Costs</span>
          <span className="font-extrabold tabular-nums">{fmt(fees?.totalClosingCosts)}</span>
        </div>
      </div>

      {/* Cash to close */}
      <CashToCloseSection
        rates={rates}
        fees={fees}
        loanAmount={loanAmount}
        propertyValue={propertyValue}
        quote={quote}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════
   TAB 4: Amortization
   ═══════════════════════════════════════════════ */
function AmortizationTab({ scenarios, loanAmount, term }) {
  const rates = scenarios.slice(0, 3);
  const [selectedRate, setSelectedRate] = useState(0);
  const rate = rates[selectedRate];

  const schedule = useMemo(
    () => rate ? buildAmortization(loanAmount, rate.rate, term) : [],
    [loanAmount, rate, term]
  );

  const totalInterest = schedule.reduce((sum, y) => sum + y.interest, 0);
  const totalPaid = schedule.reduce((sum, y) => sum + y.totalPayment, 0);

  // Milestones
  const halfwayYear = schedule.find(y => y.balance <= loanAmount / 2);
  const crossoverYear = schedule.find(y => y.principal > y.interest);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight text-[#191c1e] mb-1">Amortization Schedule</h2>
        <p className="text-sm text-[#737783]">See how your payments break down between principal and interest over the life of the loan.</p>
      </div>

      {/* Rate selector */}
      {rates.length > 1 && (
        <div className="flex gap-2">
          {rates.map((r, i) => (
            <button
              key={i}
              onClick={() => setSelectedRate(i)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                selectedRate === i
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'bg-[#f2f4f6] text-[#191c1e]/60 hover:bg-[#eceef0]'
              }`}
            >
              Option {i + 1} — {pct(r.rate)}
            </button>
          ))}
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard label="Total Interest Paid" value={fmtInt(totalInterest)} />
        <SummaryCard label="Total Amount Paid" value={fmtInt(totalPaid)} />
        <SummaryCard
          label="Interest vs Principal"
          value={((totalInterest / totalPaid) * 100).toFixed(1) + '% interest'}
        />
      </div>

      {/* Milestones */}
      {(crossoverYear || halfwayYear) && (
        <div className="flex flex-wrap gap-3">
          {crossoverYear && (
            <div className="px-4 py-2 bg-emerald-50 rounded-full">
              <span className="text-xs font-semibold text-emerald-700">
                Year {crossoverYear.year}: Principal exceeds interest
              </span>
            </div>
          )}
          {halfwayYear && (
            <div className="px-4 py-2 bg-cyan-50 rounded-full">
              <span className="text-xs font-semibold text-cyan-700">
                Year {halfwayYear.year}: 50% of principal paid off
              </span>
            </div>
          )}
        </div>
      )}

      {/* Amortization table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-5 px-6 py-3 bg-[#191c1e] text-white text-xs font-bold uppercase tracking-wider">
          <div>Year</div>
          <div className="text-right">Principal</div>
          <div className="text-right">Interest</div>
          <div className="text-right">Total Paid</div>
          <div className="text-right">Balance</div>
        </div>
        {/* Rows — show all years but group visually by decade */}
        {schedule.map((row, i) => (
          <div
            key={row.year}
            className={`grid grid-cols-5 px-6 py-2.5 text-sm ${
              i % 2 === 0 ? 'bg-white' : 'bg-[#f8f9fb]'
            } ${row.year % 5 === 0 ? 'font-semibold' : ''}`}
          >
            <div className="text-[#434652]">{row.year}</div>
            <div className="text-right tabular-nums text-[#191c1e]">{fmtInt(row.principal)}</div>
            <div className="text-right tabular-nums text-[#191c1e]">{fmtInt(row.interest)}</div>
            <div className="text-right tabular-nums text-[#191c1e]">{fmtInt(row.totalPayment)}</div>
            <div className="text-right tabular-nums text-[#191c1e]">{fmtInt(row.balance)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════
   Shared Components
   ═══════════════════════════════════════════════ */

function SummaryCard({ label, value }) {
  return (
    <div className="bg-[#f2f4f6] p-5 rounded-xl">
      <p className="text-xs uppercase tracking-wider text-[#737783] mb-1">{label}</p>
      <p className="text-2xl font-extrabold text-[#191c1e]">{value}</p>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h3 className="text-sm font-bold text-cyan-700 uppercase tracking-widest mb-3">{children}</h3>
  );
}

function ComparisonTable({ children }) {
  return <div className="bg-white rounded-2xl shadow-sm overflow-hidden">{children}</div>;
}

function CompHeader({ rates }) {
  return (
    <div className="grid px-6 py-3 bg-[#f2f4f6]" style={{ gridTemplateColumns: '1.5fr ' + rates.map(() => '1fr').join(' ') }}>
      <div />
      {rates.map((r, i) => (
        <div key={i} className="text-center">
          <p className="text-xs text-[#737783]">Option {i + 1}</p>
          <p className="text-xl font-extrabold text-[#191c1e]">{pct(r.rate)}</p>
        </div>
      ))}
    </div>
  );
}

function CompRow({ label, values, alt, bold }) {
  return (
    <div
      className={`grid px-6 py-3 ${alt ? 'bg-[#f8f9fb]' : 'bg-white'}`}
      style={{ gridTemplateColumns: '1.5fr ' + values.map(() => '1fr').join(' ') }}
    >
      <p className={`text-sm ${bold ? 'font-bold text-[#191c1e]' : 'text-[#434652]'}`}>{label}</p>
      {values.map((v, i) => (
        <p
          key={i}
          className={`text-center tabular-nums text-sm ${
            v.bold ? 'font-extrabold text-[#191c1e]' :
            v.color === 'green' ? 'font-bold text-emerald-600' :
            v.color === 'red' ? 'font-bold text-red-500' :
            'text-[#191c1e]'
          }`}
        >
          {v.text}
        </p>
      ))}
    </div>
  );
}

function TotalRow({ label, values }) {
  return (
    <div
      className="grid px-6 py-4 bg-cyan-600 text-white"
      style={{ gridTemplateColumns: '1.5fr ' + values.map(() => '1fr').join(' ') }}
    >
      <p className="font-bold">{label}</p>
      {values.map((v, i) => (
        <p key={i} className="text-center text-xl font-extrabold">{v.text}</p>
      ))}
    </div>
  );
}

function PaymentLineItem({ color, label, amount }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
        <span className="text-sm text-[#434652]">{label}</span>
      </div>
      <span className="text-sm font-semibold tabular-nums text-[#191c1e]">{amount}</span>
    </div>
  );
}

function CashToCloseSection({ rates, fees, loanAmount, propertyValue, quote }) {
  const closingDate = fees?.closingDate ? new Date(fees.closingDate) : null;
  const daysInterest = closingDate
    ? (new Date(closingDate.getFullYear(), closingDate.getMonth() + 1, 0).getDate() - closingDate.getDate() + 1)
    : 7;

  return (
    <div className="relative bg-[#e6e8ea] rounded-2xl overflow-hidden p-6">
      <div className="absolute left-0 top-0 bottom-0 w-2 bg-cyan-600" />
      <h4 className="font-extrabold text-[#191c1e] mb-4 pl-3">Total Cash to Close Summary</h4>
      <div
        className="grid gap-y-3 pl-3"
        style={{ gridTemplateColumns: '1.5fr ' + rates.map(() => '1fr').join(' ') }}
      >
        {/* Headers */}
        <div />
        {rates.map((r, i) => (
          <p key={i} className="text-center text-xs text-[#737783] font-semibold">Option {i + 1}</p>
        ))}

        {/* Purchase price / appraised value */}
        <p className="text-sm text-[#434652]">Purchase Price / Appraised Value</p>
        {rates.map((_, i) => (
          <p key={i} className="text-center text-sm font-semibold tabular-nums">{fmtInt(propertyValue)}</p>
        ))}

        {/* Loan amount */}
        <p className="text-sm text-[#434652]">Loan Amount</p>
        {rates.map((_, i) => (
          <p key={i} className="text-center text-sm tabular-nums">{fmtInt(loanAmount)}</p>
        ))}

        {/* Down payment or payoff */}
        {quote.purpose === 'purchase' ? (
          <>
            <p className="text-sm text-[#434652]">Down Payment ({((propertyValue - loanAmount) / propertyValue * 100).toFixed(0)}%)</p>
            {rates.map((_, i) => (
              <p key={i} className="text-center text-sm font-semibold tabular-nums">{fmtInt(propertyValue - loanAmount)}</p>
            ))}
          </>
        ) : (
          <>
            <p className="text-sm text-[#434652]">Loan Payoff (Estimate)</p>
            {rates.map((_, i) => (
              <p key={i} className="text-center text-sm font-semibold tabular-nums">{fmt(quote.currentBalance || 0)}</p>
            ))}
            <p className="text-sm text-[#434652]">Loan Amount (Credit)</p>
            {rates.map((_, i) => (
              <p key={i} className="text-center text-sm font-semibold tabular-nums text-emerald-600">({fmtInt(loanAmount)})</p>
            ))}
          </>
        )}

        {/* Total loan charges */}
        <p className="text-sm text-[#434652]">Total Loan Charges</p>
        {rates.map((r, i) => {
          const daily = (loanAmount * (r.rate / 100)) / 365 * daysInterest;
          return <p key={i} className="text-center text-sm tabular-nums">{fmt((fees?.totalClosingCosts || 0) + daily)}</p>;
        })}

        {/* Lender credit/charge */}
        <p className="text-sm text-[#434652]">Lender Credit / (Charge)</p>
        {rates.map((r, i) => {
          const isCredit = r.rebateDollars > 0;
          return (
            <p key={i} className={`text-center text-sm font-bold tabular-nums ${isCredit ? 'text-emerald-600' : 'text-red-500'}`}>
              {isCredit ? fmtInt(r.rebateDollars) : '(' + fmtInt(r.discountDollars || 0) + ')'}
            </p>
          );
        })}

        {/* Divider */}
        <div className="col-span-full h-px bg-[#c3c6d4]/40 my-1" />

        {/* Total */}
        <p className="text-lg font-extrabold text-cyan-700">Total Cash To Close</p>
        {rates.map((r, i) => {
          const daily = (loanAmount * (r.rate / 100)) / 365 * daysInterest;
          const totalFees = (fees?.totalClosingCosts || 0) + daily;
          const credit = r.rebateDollars > 0 ? -r.rebateDollars : (r.discountDollars || 0);
          let cashToClose;
          if (quote.purpose === 'purchase') {
            cashToClose = totalFees + credit + (propertyValue - loanAmount);
          } else {
            cashToClose = totalFees + credit + Number(quote.currentBalance || 0) - loanAmount;
          }
          return <p key={i} className="text-center text-xl font-extrabold tabular-nums text-[#191c1e]">{fmt(cashToClose)}</p>;
        })}
      </div>
    </div>
  );
}

/* ── Page wrapper ── */
export default function QuoteViewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f8f9fb] flex items-center justify-center text-[#737783] animate-pulse">Loading...</div>}>
      <QuoteViewContent />
    </Suspense>
  );
}
