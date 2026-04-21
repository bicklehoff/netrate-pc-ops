// FHA program constants — client-side display mirror.
//
// ─── Role after D9d migration 022 (2026-04-22) ──────────────────────
// Server-side pricing code (pricing-v2.js + fee-builder.js) reads the
// FHA UFMIP rate from the ref_fha_ufmip table via
// src/lib/rates/ref-fha-ufmip.js — that is the source of truth. Per
// D9d §5, there is no silent fallback to a hardcoded constant on the
// server path.
//
// This file exists for one remaining client consumer
// (src/components/Portal/QuoteGenerator/QuoteScenarioForm.js) that
// renders a "+ UFMIP (1.75%)" label synchronously during form
// interaction and would need an async fetch to use the DAL. Keeping
// a client-bundled scalar for display purposes is cheap; swap this
// for a parent-passed prop if drift ever matters. The value here
// MUST track the `(purchase, standard)` row in ref_fha_ufmip — HUD
// hasn't changed this number since 2015 so drift risk is low.
//
// Do not import from this file in server-side pricing code.

/**
 * FHA Upfront Mortgage Insurance Premium — financed into the loan at
 * closing. HUD sets via mortgagee letter; this is the standard purchase/
 * rate-term/cashout rate since HUD ML 2015-01.
 */
export const FHA_UFMIP_RATE = 0.0175;
