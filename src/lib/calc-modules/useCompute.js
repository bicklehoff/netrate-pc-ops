/**
 * useCompute — React hook for live standalone calculator views.
 *
 * Wraps the orchestrator with debouncing, request cancellation, loading
 * + error state. Replaces the per-calculator boilerplate that today
 * lives in useRefinanceEngine, etc. Each calculator's StandaloneView
 * imports this and stops re-implementing debounce + abort.
 *
 * The hook is for STANDALONE views only. Embedded + PDF views consume
 * a frozen result (no compute) — see spec §5.
 *
 * Spec: Work/Dev/AD-11A-CALCULATOR-MODULE-REGISTRY.md §7 (view contracts)
 */

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { runCompute } from './orchestrator.js';
import { fetchRatesLive } from './services.js';

/**
 * Live compute hook — re-runs compute as input changes, with debounce.
 *
 * @param {import('./types.js').ModuleDef | null} module
 * @param {Object | null} input                              - { scenario, config }. Pass null while inputs aren't ready (e.g., user typing).
 * @param {Object} [options]
 * @param {number} [options.debounceMs]                      - Default 400ms. Set to 0 for synchronous compute (pure modules).
 * @returns {{
 *   result: any | null,
 *   snapshotMeta: Object | null,
 *   loading: boolean,
 *   error: Error | null,
 * }}
 */
export function useCompute(module, input, { debounceMs = 400 } = {}) {
  const [state, setState] = useState({
    result: null,
    snapshotMeta: null,
    loading: false,
    error: null,
  });

  // Stable JSON of input — re-runs only when input shape genuinely
  // changes, not on every render's new object identity.
  const inputKey = useMemo(() => {
    try {
      return input == null ? null : JSON.stringify(input);
    } catch {
      return null;
    }
  }, [input]);

  const abortRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!module || inputKey == null) {
      setState({ result: null, snapshotMeta: null, loading: false, error: null });
      return undefined;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    setState((prev) => ({ ...prev, loading: true, error: null }));

    const run = () => {
      const controller = new AbortController();
      abortRef.current = controller;

      // Inject the abort signal into fetchRates if the module needs rates.
      // The fetchRatesLive impl reads input.signal — modules should pass
      // their input through verbatim; the orchestrator validates after
      // the override is applied. To keep the module's compute signature
      // clean, we patch `fetchRates` to inject signal automatically.
      const wrappedFetchRates = module.capabilities?.needsRates
        ? (rateInput) => fetchRatesLive({ ...rateInput, signal: controller.signal })
        : undefined;

      const overrides = wrappedFetchRates ? { fetchRates: wrappedFetchRates } : {};

      runCompute({ module, input, serviceOverrides: overrides })
        .then(({ result, snapshotMeta }) => {
          if (controller.signal.aborted) return;
          setState({ result, snapshotMeta, loading: false, error: null });
        })
        .catch((err) => {
          if (controller.signal.aborted || err?.name === 'AbortError') return;
          setState({ result: null, snapshotMeta: null, loading: false, error: err });
        });
    };

    if (debounceMs > 0) {
      debounceRef.current = setTimeout(run, debounceMs);
    } else {
      run();
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
    // inputKey is the stable identity; module identity changes only when
    // a calculator literally swaps its module def, which is a real reason
    // to re-run. debounceMs is a config knob.
  }, [module, inputKey, debounceMs, input]);

  return state;
}
