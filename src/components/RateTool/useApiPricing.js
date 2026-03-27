'use client';

import { useState, useEffect, useRef } from 'react';
import { calculatePI } from '@/lib/rates/engine';

/**
 * Hook that calls the pricing API and returns best-rate-per-tier results.
 * Replaces the old engine.js priceRates() approach.
 */
export function useApiPricing(scenario) {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const debounce = useRef(null);

  useEffect(() => {
    if (!scenario.loanAmount || scenario.loanAmount <= 0) {
      setResults(null);
      return;
    }

    // Debounce API calls while user is typing
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const purposeMap = { purchase: 'purchase', refi: 'refinance', cashout: 'cashout' };
        const resp = await fetch('/api/pricing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            loanAmount: scenario.loanAmount,
            loanPurpose: purposeMap[scenario.purpose] || scenario.purpose,
            loanType: scenario.loanType || 'conventional',
            creditScore: scenario.fico,
            propertyValue: scenario.propertyValue,
            propertyType: scenario.propertyType,
            term: 30,
            productType: 'fixed',
            lockDays: 30,
            state: scenario.state,
          }),
        });
        const data = await resp.json();
        if (data.error || !data.results) {
          setResults(null);
          setLoading(false);
          return;
        }

        // Group by rate — pick the best result at each rate
        // "Best" = highest finalPrice (most rebate or least discount)
        const byRate = {};
        for (const r of data.results) {
          const rateKey = r.rate.toFixed(3);
          if (!byRate[rateKey] || r.finalPrice > byRate[rateKey].finalPrice) {
            byRate[rateKey] = r;
          }
        }

        // Convert to array sorted by rate, compute monthly PI and savings
        const currentPI = scenario.currentRate
          ? calculatePI(scenario.currentRate, scenario.loanAmount)
          : null;

        const rates = Object.values(byRate)
          .map(r => {
            const monthlyPI = calculatePI(r.rate, scenario.loanAmount);
            const savings = currentPI ? currentPI - monthlyPI : 0;

            // v2 engine: isRebate/isDiscount determine display
            // Rebate = borrower receives money (green, parentheses)
            // Discount = borrower pays money (red, no parentheses)
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
          .filter(r => r.rate >= 4 && r.rate <= 9);

        setResults(rates);
      } catch {
        setResults(null);
      }
      setLoading(false);
    }, 300);

    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [scenario.loanAmount, scenario.fico, scenario.propertyValue, scenario.purpose, scenario.loanType, scenario.propertyType, scenario.state, scenario.currentRate]);

  return { results, loading };
}
