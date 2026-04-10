'use client';

import { useState, useCallback, useRef } from 'react';
import { calculatePI } from '@/lib/rates/engine';

const MIN_SPINNER_MS = 3000; // Minimum time to show spinner

/**
 * Hook that calls the pricing API on demand (via fetchRates) and returns
 * best-rate-per-tier results. Shows a spinner for at least 3 seconds.
 */
export function useApiPricing(scenario) {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState(null);
  const abortRef = useRef(null);

  const fetchRates = useCallback(async () => {
    if (!scenario.loan_amount || scenario.loan_amount <= 0) {
      setResults(null);
      return;
    }

    // Abort any in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setResults(null);
    const spinnerStart = Date.now();

    try {
      const purposeMap = { purchase: 'purchase', refi: 'refinance', cashout: 'cashout' };
      const resp = await fetch('/api/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          loan_amount: scenario.loan_amount,
          loan_purpose: purposeMap[scenario.purpose] || scenario.purpose,
          loan_type: scenario.loan_type || 'conventional',
          credit_score: scenario.fico,
          property_value: scenario.property_value,
          property_type: scenario.property_type,
          term: scenario.term || 30,
          productType: scenario.productType || 'fixed',
          lockDays: 30,
          state: scenario.state,
          county: scenario.county || null,
          vaFundingFeeExempt: scenario.vaFundingFeeExempt || false,
          vaSubsequentUse: scenario.vaSubsequentUse || false,
          firstTimeBuyer: scenario.firstTimeBuyer || false,
        }),
      });
      const data = await resp.json();
      if (data.error || !data.results) {
        // Wait for minimum spinner time before hiding
        const elapsed = Date.now() - spinnerStart;
        if (elapsed < MIN_SPINNER_MS) await new Promise(r => setTimeout(r, MIN_SPINNER_MS - elapsed));
        setResults(null);
        setLoading(false);
        return;
      }

      // Group by rate — pick the best result at each rate
      const byRate = {};
      for (const r of data.results) {
        const rateKey = r.rate.toFixed(3);
        if (!byRate[rateKey] || r.finalPrice > byRate[rateKey].finalPrice) {
          byRate[rateKey] = r;
        }
      }

      // Convert to array sorted by rate, compute monthly PI and savings
      const currentPI = scenario.current_rate
        ? calculatePI(scenario.current_rate, scenario.loan_amount)
        : null;

      const rates = Object.values(byRate)
        .map(r => {
          const monthlyPI = calculatePI(r.rate, scenario.loan_amount);
          const savings = currentPI ? currentPI - monthlyPI : 0;
          const costDollars = r.isDiscount ? r.discountDollars : -r.rebateDollars;

          return {
            rate: r.rate,
            apr: r.apr || r.rate,
            monthlyPI,
            savings,
            costDollars,
            isRebate: r.isRebate,
            isDiscount: r.isDiscount,
            isPar: r.isPar,
            rebateDollars: r.rebateDollars || 0,
            discountDollars: r.discountDollars || 0,
            lender: r.lender,
            program: r.program,
            lenderFee: r.lenderFee,
            compDollars: r.compDollars,
            finalPrice: r.finalPrice,
            breakdown: r.breakdown,
          };
        })
        .sort((a, b) => a.rate - b.rate)
        .filter(r => r.rate >= 4 && r.rate <= 9)
        .filter(r => Math.abs(r.finalPrice - 100) <= 2.5);

      // Enforce minimum spinner time
      const elapsed = Date.now() - spinnerStart;
      if (elapsed < MIN_SPINNER_MS) {
        await new Promise(r => setTimeout(r, MIN_SPINNER_MS - elapsed));
      }

      setResults(rates);
      if (data.effectiveDate) setEffectiveDate(data.effectiveDate);
    } catch (err) {
      if (err.name !== 'AbortError') setResults(null);
    }
    setLoading(false);
  }, [scenario.loan_amount, scenario.fico, scenario.property_value, scenario.purpose, scenario.loan_type, scenario.property_type, scenario.productType, scenario.term, scenario.state, scenario.county, scenario.current_rate, scenario.vaFundingFeeExempt, scenario.vaSubsequentUse, scenario.firstTimeBuyer]);

  return { results, loading, fetchRates, effectiveDate };
}
