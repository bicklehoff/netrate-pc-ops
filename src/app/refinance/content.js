'use client';

import { useState } from 'react';
import Link from 'next/link';
import { fmtDollars, fmtRate } from '@/lib/formatters';
import { calculateMonthlyPI } from '@/lib/mortgage-math';

/**
 * ICanBuy refi landing page — client content.
 *
 * PATHS: primary = Save Scenario form (fires the icanbuy-refi sequence
 * when backlog #79 ships). Secondary = Apply Now. Tertiary = Change
 * Scenario (back to /rates with pre-filled inputs).
 *
 * COPY: hero + section prose is first-draft per Claw's spec of 2026-04-21.
 * David voice-edits before the ad campaign goes live; swap copy blocks
 * without touching layout.
 */

const PURPOSE_LABEL = {
  purchase: 'purchase',
  refinance: 'refinance',
  cashout: 'cash-out refinance',
};

function buildSubhead({ purpose, state, amount }) {
  if (!state || !amount) {
    return "Here's what today's rates look like. Adjust the scenario or save it and I'll keep you posted when they move.";
  }
  return `Here's what a ${fmtDollars(amount)} ${PURPOSE_LABEL[purpose] || 'refinance'} looks like in ${state} right now.`;
}

function buildRateCardsForPurpose(purpose, rates) {
  if (!rates) return [];
  if (purpose === 'purchase') {
    return [
      { key: 'conv30', label: '30-Year Fixed Conventional', data: rates.conv30 },
      { key: 'fha30',  label: '30-Year FHA',                data: rates.fha30  },
      { key: 'va30',   label: '30-Year VA',                 data: rates.va30   },
    ].filter(c => c.data);
  }
  // refinance + cashout share the same card set
  return [
    { key: 'conv30', label: '30-Year Fixed Conventional', data: rates.conv30 },
    { key: 'conv15', label: '15-Year Fixed Conventional', data: rates.conv15 },
    { key: 'fha30',  label: '30-Year FHA',                data: rates.fha30  },
  ].filter(c => c.data);
}

function RateCard({ label, data, loanAmount }) {
  if (!data) return null;
  const payment = calculateMonthlyPI(data.rate, loanAmount, 30);
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-gray-900 tabular-nums">
          {fmtRate(data.rate)}
        </span>
        {data.apr != null && (
          <span className="text-sm text-gray-500 tabular-nums">
            APR {fmtRate(data.apr)}
          </span>
        )}
      </div>
      <div className="mt-4 text-sm text-gray-700 tabular-nums">
        ~{fmtDollars(payment)}/mo principal &amp; interest
      </div>
      <div className="mt-1 text-xs text-gray-400">
        on {fmtDollars(loanAmount)} · 30-day lock
      </div>
    </div>
  );
}

function SaveScenarioForm({ scenario }) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [currentRate, setCurrentRate] = useState('');
  const [smsConsent, setSmsConsent] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot
  const [status, setStatus] = useState('idle'); // idle | submitting | ok | error
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (status === 'submitting' || status === 'ok') return;
    setStatus('submitting');
    setErrorMsg('');
    try {
      const res = await fetch('/api/leads/form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          phone: phone || null,
          firstName: firstName || null,
          loanPurpose: scenario.purpose,
          loanAmount: scenario.amount,
          propertyValue: scenario.propertyValue,
          creditScore: scenario.fico,
          state: scenario.state,
          source: 'icanbuy',
          sourceDetail: 'refi-landing',
          utmSource: scenario.utmSource,
          utmMedium: scenario.utmMedium,
          utmCampaign: scenario.utmCampaign,
          smsConsent,
          message: currentRate ? `Current rate: ${currentRate}%` : null,
          website, // honeypot
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus('error');
        setErrorMsg(data.error || 'Something went wrong. Please try again.');
        return;
      }
      setStatus('ok');
    } catch {
      setStatus('error');
      setErrorMsg('Network error. Please try again.');
    }
  }

  if (status === 'ok') {
    return (
      <div className="bg-white rounded-2xl border border-go/20 bg-go/5 p-8 text-center">
        <div className="text-xl font-bold text-gray-900 mb-2">Your scenario is saved.</div>
        <p className="text-sm text-gray-600 leading-relaxed">
          Check your email for confirmation. If you shared a phone number, David will
          call within 30 minutes during business hours.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
      <h2 className="text-xl font-bold text-gray-900 mb-2">Want to come back to this?</h2>
      <p className="text-sm text-gray-600 mb-5 leading-relaxed">
        Save this scenario and I&apos;ll send you an updated quote when rates move on
        your numbers. If you&apos;d rather just talk it through, leave your phone and
        I&apos;ll call you — usually within 30 minutes during business hours.
      </p>

      <div className="space-y-3">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-brand focus:ring-2 focus:ring-brand/10 outline-none"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">
            Phone <span className="text-xs font-normal text-gray-400">(optional — David will call)</span>
          </span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            placeholder="303-555-1234"
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-brand focus:ring-2 focus:ring-brand/10 outline-none"
          />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              First name <span className="text-xs font-normal text-gray-400">(optional)</span>
            </span>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              autoComplete="given-name"
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:border-brand focus:ring-2 focus:ring-brand/10 outline-none"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              Current rate <span className="text-xs font-normal text-gray-400">(optional)</span>
            </span>
            <input
              type="number"
              step="0.125"
              value={currentRate}
              onChange={(e) => setCurrentRate(e.target.value)}
              placeholder="7.25"
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm tabular-nums focus:border-brand focus:ring-2 focus:ring-brand/10 outline-none"
            />
          </label>
        </div>

        {phone && (
          <label className="flex items-start gap-2 pt-1">
            <input
              type="checkbox"
              checked={smsConsent}
              onChange={(e) => setSmsConsent(e.target.checked)}
              className="mt-0.5"
            />
            <span className="text-xs text-gray-600 leading-relaxed">
              I consent to receive SMS messages from NetRate Mortgage about my saved
              rate scenario. Standard rates apply. Reply STOP to opt out at any time.
            </span>
          </label>
        )}

        {/* Honeypot — hidden from humans via CSS + aria-hidden; bots fill it. */}
        <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', opacity: 0, pointerEvents: 'none' }}>
          <label>
            Website
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </label>
        </div>

        {errorMsg && (
          <div className="text-sm text-red-600">{errorMsg}</div>
        )}

        <button
          type="submit"
          disabled={status === 'submitting'}
          className="w-full bg-go text-white text-sm font-bold rounded-lg px-5 py-3 hover:bg-go-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {status === 'submitting' ? 'Saving…' : 'Save Scenario'}
        </button>

        <p className="text-xs text-gray-400 leading-relaxed pt-2">
          Licensed in California, Colorado, Oregon, and Texas. NMLS #1111861 (company) ·
          NMLS #641790 (David Burson). Equal Housing Opportunity. By submitting, you
          agree to receive email updates about your saved scenario. Standard rates
          apply. Not a commitment to lend.
        </p>
      </div>
    </form>
  );
}

export default function RefinanceLanding({ scenario, rates }) {
  const cards = buildRateCardsForPurpose(scenario.purpose, rates);
  const subhead = buildSubhead(scenario);

  // Query-param string for the "Change scenario" link → pre-fills /rates
  const changeScenarioUrl = `/rates?loanAmount=${scenario.amount}&propertyValue=${scenario.propertyValue}&fico=${scenario.fico}&state=${scenario.state}&purpose=${scenario.purpose}`;

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <div className="max-w-5xl mx-auto px-6 py-10 sm:py-14">
        {/* Hero */}
        <header className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            Rates for your scenario.
          </h1>
          <p className="mt-3 text-base sm:text-lg text-gray-600 leading-relaxed max-w-2xl">
            {subhead}
          </p>
          {rates?.dateShort && (
            <p className="mt-2 text-xs text-gray-400">
              Par rates as of {rates.dateShort}. Rates move daily.
            </p>
          )}
        </header>

        {/* Rate cards */}
        {cards.length > 0 ? (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {cards.map((c) => (
              <RateCard
                key={c.key}
                label={c.label}
                data={c.data}
                loanAmount={scenario.amount}
              />
            ))}
          </section>
        ) : (
          <section className="bg-white rounded-2xl border border-gray-200 p-6 text-sm text-gray-500 mb-10">
            Live rates are loading. Save your scenario below and we&apos;ll email you
            today&apos;s numbers.
          </section>
        )}

        {/* Section 2 — what you're looking at */}
        <section className="mb-10 max-w-2xl">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
            What you&apos;re looking at
          </h2>
          <div className="space-y-3 text-sm text-gray-700 leading-relaxed">
            <p>
              These are today&apos;s par rates with our standard compensation built
              into the APR — what you&apos;d actually close at, not a teaser rate.
              Points and fees are included in the APR so you can compare apples to
              apples.
            </p>
            <p>
              If your current rate is above 6.5%, the math on a refinance is probably
              worth running. If it&apos;s below 5%, usually not — unless you&apos;re
              taking cash out or shortening the term.
            </p>
            <p>
              Closing costs run $3,000–$5,000 on a typical refinance. Divide that by
              your monthly savings to get your break-even. The{' '}
              <Link href="/tools/refi-analyzer" className="text-brand hover:underline">
                refi analyzer
              </Link>{' '}
              runs that math for you.
            </p>
          </div>
        </section>

        {/* Section 3 — save scenario form (primary conversion) */}
        <section className="mb-10">
          <SaveScenarioForm scenario={scenario} />
        </section>

        {/* Section 4 — secondary CTAs */}
        <section className="mb-10 flex flex-col sm:flex-row gap-3">
          <Link
            href={changeScenarioUrl}
            className="inline-flex items-center justify-center px-5 py-3 border-2 border-brand text-brand text-sm font-medium rounded-lg hover:bg-brand/5 transition-colors"
          >
            Change your scenario →
          </Link>
          <Link
            href="/portal/apply"
            className="inline-flex items-center justify-center px-5 py-3 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand-dark transition-colors"
          >
            Ready to move — start application →
          </Link>
        </section>

        {/* Footer disclosure */}
        <footer className="pt-8 border-t border-gray-200">
          <p className="text-xs text-gray-400 leading-relaxed max-w-2xl">
            Rates and APR shown are for the scenario above and assume a 30-day lock.
            Not a commitment to lend. Subject to credit approval, property appraisal,
            and final underwriting. NetRate Mortgage LLC · NMLS #1111861. Licensed
            in California, Colorado, Oregon, and Texas. Equal Housing Opportunity.
            357 S McCaslin Blvd #200, Louisville, CO 80027 · 303-444-5251 ·
            david@netratemortgage.com.
          </p>
        </footer>
      </div>
    </div>
  );
}
