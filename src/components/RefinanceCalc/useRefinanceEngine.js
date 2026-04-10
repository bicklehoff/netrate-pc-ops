'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { calculatePI } from '@/lib/rates/engine';
import { STATE_DEFAULTS, computeEscrowSetup, dollar } from './shared';

/**
 * Core hook for the refinance calculator.
 * Calls /api/pricing with debouncing, groups results, and computes
 * strategy outcomes for each preset.
 */
export function useRefinanceEngine(inputs) {
  const {
    current_balance, current_rate, currentPayment, property_value,
    fico, state, doesEscrow, escrowBalance,
    annualTax, annualInsurance, insuranceRenewal,
    activePreset, customSelectedRate,
  } = inputs;

  const [apiRates, setApiRates] = useState(null);
  const [loading, setLoading] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState(null);
  const abortRef = useRef(null);
  const debounceRef = useRef(null);

  // --- Derived values ---
  const stateInfo = STATE_DEFAULTS[state] || STATE_DEFAULTS.CO;
  const bal = parseFloat(current_balance) || 0;
  const curRate = parseFloat(current_rate) || 0;
  const curPmt = parseFloat(currentPayment) || 0;
  const propVal = parseFloat(property_value) || 0;
  const ficoVal = parseInt(fico) || 780;
  const escBal = parseFloat(escrowBalance) || 0;
  const ins = parseFloat(annualInsurance) || 0;
  const effectiveTax = annualTax ? parseFloat(annualTax) : Math.round(propVal * stateInfo.taxRate);

  const dailyInterest = bal * (curRate / 100) / 365;
  const accruedInterest = Math.round(dailyInterest * 30);
  const estimatedPayoff = bal + accruedInterest;

  const today = new Date();
  const closeDate = new Date(today.getTime() + 30 * 86400000);
  const closeDateStr = closeDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const defaultRenewal = new Date(today.getFullYear(), today.getMonth() + 6, 1).toISOString().slice(0, 10);
  const effectiveRenewal = insuranceRenewal || defaultRenewal;

  const escrow = useMemo(() => computeEscrowSetup({
    doesEscrow, effectiveTax, annualInsurance: ins, closeDate, effectiveRenewal, stateInfo,
  }), [doesEscrow, effectiveTax, ins, closeDate.getTime(), effectiveRenewal, stateInfo]);

  const thirdPartyCosts = stateInfo.hardCosts;

  // Cash flow back
  const skippedPayment = curPmt;
  const escrowRefund = doesEscrow ? escBal : 0;
  const totalCashBack = skippedPayment + escrowRefund;

  // --- Debounced API fetch ---
  useEffect(() => {
    if (!bal || !propVal || !ficoVal) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);

      fetch('/api/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          loan_amount: estimatedPayoff,
          loan_purpose: 'refinance',
          loan_type: 'conventional',
          credit_score: ficoVal,
          property_value: propVal,
          term: 30,
          productType: 'fixed',
          lockDays: 30,
          state: state,
        }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.error || !data.results) {
            setApiRates(null);
            setLoading(false);
            return;
          }

          // Group by rate, pick best (highest finalPrice) at each rate
          const byRate = {};
          for (const r of data.results) {
            const rateKey = r.rate.toFixed(3);
            if (!byRate[rateKey] || r.finalPrice > byRate[rateKey].finalPrice) {
              byRate[rateKey] = r;
            }
          }

          const rates = Object.values(byRate)
            .sort((a, b) => a.rate - b.rate)
            .filter(r => r.rate >= 4 && r.rate <= 9);

          setApiRates(rates);
          if (data.effectiveDate) setEffectiveDate(data.effectiveDate);
          setLoading(false);
        })
        .catch(err => {
          if (err.name !== 'AbortError') {
            setApiRates(null);
            setLoading(false);
          }
        });
    }, 600);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [bal, curRate, propVal, ficoVal, state, estimatedPayoff]);

  // --- Strategy computation ---
  const strategies = useMemo(() => {
    if (!apiRates || apiRates.length === 0 || !bal || !propVal || !curPmt) return null;

    const softCosts = escrow.total;

    // Helper: compute a strategy result for a given rate entry and loan structure
    function buildResult(rateEntry, loan_amount, cashToClose) {
      const payment = calculatePI(rateEntry.rate, loan_amount);
      const monthlySavings = curPmt - payment;
      const ltv = (loan_amount / propVal) * 100;
      const netCashFlow = cashToClose - totalCashBack;
      const netSpend = Math.max(0, netCashFlow);
      let breakeven = null;
      if (monthlySavings > 0 && netSpend > 0) {
        breakeven = Math.ceil(netSpend / monthlySavings);
      } else if (monthlySavings > 0) {
        breakeven = 0;
      }
      return {
        rate: rateEntry.rate,
        finalPrice: rateEntry.finalPrice,
        rebateDollars: rateEntry.rebateDollars || 0,
        discountDollars: rateEntry.discountDollars || 0,
        lenderFee: rateEntry.lenderFee || 0,
        lender: rateEntry.lender,
        program: rateEntry.program,
        loan_amount,
        payment,
        monthlySavings,
        cashToClose,
        netCashFlow,
        ltv,
        breakeven,
        skippedPayment,
        escrowRefund,
        totalCashBack,
      };
    }

    // --- No-Cost ---
    // Find lowest rate where rebateDollars >= thirdPartyCosts + lenderFee
    let noCostRate = null;
    for (const r of apiRates) {
      const totalHard = thirdPartyCosts + (r.lenderFee || 0);
      if ((r.rebateDollars || 0) >= totalHard) {
        noCostRate = r;
        break;
      }
    }
    // Fallback: highest-credit rate (last one, since sorted ASC by rate = DESC by credit)
    if (!noCostRate) noCostRate = apiRates[apiRates.length - 1];
    const noCost = buildResult(noCostRate, estimatedPayoff, softCosts);
    noCost.explanation = noCostRate.rebateDollars >= (thirdPartyCosts + (noCostRate.lenderFee || 0))
      ? `${noCostRate.rate.toFixed(3)}% is the lowest rate where lender credit (${dollar(noCostRate.rebateDollars)}) covers your ${dollar(thirdPartyCosts + (noCostRate.lenderFee || 0))} in hard closing costs.`
      : `No rate fully covers hard costs. ${noCostRate.rate.toFixed(3)}% generates the most credit (${dollar(noCostRate.rebateDollars || 0)}).`;

    // --- Zero Out of Pocket ---
    // Par rate: closest finalPrice to 100
    let parRate = apiRates[0];
    let minDist = Infinity;
    for (const r of apiRates) {
      const dist = Math.abs(r.finalPrice - 100);
      if (dist < minDist) { minDist = dist; parRate = r; }
    }
    const totalCostsToRoll = thirdPartyCosts + (parRate.lenderFee || 0) + softCosts;
    const creditApplied = Math.min(parRate.rebateDollars || 0, totalCostsToRoll);
    const netRollIn = totalCostsToRoll - creditApplied;
    const zeroOopLoan = estimatedPayoff + netRollIn;
    const zeroOop = buildResult(parRate, zeroOopLoan, 0);
    zeroOop.explanation = `${parRate.rate.toFixed(3)}% is the par rate. ${dollar(netRollIn)} in costs rolled into your new loan. Zero cash to close.`;

    // --- Lowest Rate ---
    const lowestRate = apiRates[0];
    const pointsCost = lowestRate.discountDollars || 0;
    const lowestCashToClose = pointsCost + softCosts;
    const lowest = buildResult(lowestRate, estimatedPayoff, lowestCashToClose);
    lowest.explanation = `${lowestRate.rate.toFixed(3)}% is the lowest available rate.`
      + (pointsCost > 0 ? ` You pay ${dollar(pointsCost)} in discount points.` : '');

    // --- Custom ---
    let customRate = null;
    if (customSelectedRate !== null && customSelectedRate !== undefined) {
      customRate = apiRates.find(r => r.rate === customSelectedRate);
    }
    if (!customRate) customRate = parRate; // default to par
    const customHardCosts = thirdPartyCosts + (customRate.lenderFee || 0);
    let customCashToClose;
    let customLoanAmt;
    if ((customRate.rebateDollars || 0) >= customHardCosts) {
      // Credit covers hard costs — borrower pays soft costs only
      customCashToClose = softCosts;
      customLoanAmt = estimatedPayoff;
    } else {
      // Borrower pays shortfall + soft costs, or could roll in
      const shortfall = customHardCosts - (customRate.rebateDollars || 0);
      customCashToClose = shortfall + softCosts;
      customLoanAmt = estimatedPayoff;
    }
    const custom = buildResult(customRate, customLoanAmt, customCashToClose);
    const customCredit = customRate.rebateDollars || 0;
    const customPoints = customRate.discountDollars || 0;
    if (customCredit > 0) {
      custom.explanation = `At ${customRate.rate.toFixed(3)}%, lender credit is ${dollar(customCredit)}.`;
    } else if (customPoints > 0) {
      custom.explanation = `At ${customRate.rate.toFixed(3)}%, you pay ${dollar(customPoints)} in points.`;
    } else {
      custom.explanation = `${customRate.rate.toFixed(3)}% is approximately par — no credit, no points.`;
    }

    return { noCost, zeroOop, lowest, custom };
  }, [apiRates, bal, propVal, curPmt, estimatedPayoff, thirdPartyCosts, escrow.total, totalCashBack, skippedPayment, escrowRefund, customSelectedRate]);

  // Active strategy based on preset
  const active = strategies ? strategies[
    activePreset === 'noCost' ? 'noCost' :
    activePreset === 'zeroOop' ? 'zeroOop' :
    activePreset === 'lowestRate' ? 'lowest' :
    'custom'
  ] : null;

  return {
    loading,
    apiRates,
    effectiveDate,
    strategies,
    active,
    // Derived values for display
    estimatedPayoff,
    accruedInterest,
    thirdPartyCosts,
    escrow,
    closeDateStr,
    effectiveTax,
    skippedPayment,
    escrowRefund,
    totalCashBack,
    stateInfo,
  };
}
