# Coding Principles — proposal for Mac to elevate to GOVERNANCE.md

**Authored:** PC Dev, 2026-04-24
**Audience:** Mac — please review, refine, and integrate into `netrate-governance/GOVERNANCE.md` as the authoritative version. Once integrated, delete this proposal file.

**Why now:** Surfaced during today's PC Dev session on the ResiCentral DSCR parser (PR-1 in progress). David asked *"what would a sr dev do?"* mid-scope, which produced a fundamentally better plan than the initial 1–2 session estimate. We codified that question into a framework so the next session, the next AI agent, and any future engineer applies the same rigor by default.

**Doc framing:** Primary audience is **AI agents working on NetRate code** (Claude today, future agents). Secondary audience is **David**, who participates by classifying work and asking forcing questions — without writing code himself.

---

## 1. The meta-rule

> **Every coding and development choice — by humans or AI — must be approached from a senior-dev perspective. Always. This is the default mindset, not a sometimes-rule.**

What "senior-dev mindset" means in practice:

- **Stop and think before writing code** — about endurance, scale, correctness, long-term implications
- **Match rigor to load-bearing-ness** — same mindset produces different output for different tiers (see §3)
- **Be honest about scope** — surface real estimates, even when they're worse than the user expected ("not 1–2 sessions, actually 4–5")
- **Refuse sycophancy** — say "this won't endure" or "this approach is wrong" when it is, even if the user already said "build it"
- **Protect the long term** — never trade correctness for velocity unless the user explicitly accepts the trade with full information

This rule is **constant**. The application varies by tier. Senior-dev approach to a typo fix is *"do it fast, don't overthink"*; senior-dev approach to a parser is *"inventory first, design before coding, refactor old to match new"*. The mindset is the same; the output is calibrated.

---

## 2. Tier classification — Claude's job, surfaced to David

Before any non-trivial task, the AI agent must:

1. **Classify the work into a tier** (T1 / T2 / T3 / T4)
2. **Surface the classification** to David ("This is Tier 3 because…")
3. **Apply tier-appropriate rigor**
4. **Accept David's challenge** if he pushes back ("are we sure this is Tier 2?")

David participates by reading the classification, asking forcing questions, and providing product context that may shift the tier. He does not need to write code to keep the agent honest.

---

## 3. The four tiers

### Tier 1 — Trivial / cosmetic / reversible
**Detection:** typo, copy change, color token swap, comment addition, local variable rename, single-line bug fix
**Rigor:** Just do it. Build passes. No inventory, no abstraction, no test additions, no refactor.
**Anti-pattern:** writing 200 lines of tests for a 1-line change

### Tier 2 — Local / single-surface / bounded blast radius
**Detection:** new component on one page, single API route, bug fix in one function, feature limited to one calculator's UI
**Rigor:** Read surrounding code. Match existing patterns. Smoke-test the affected surface. Standard PR review. Don't preemptively abstract.
**This is where ~70% of real coding work lives.** The skill is recognizing what's actually Tier 2 vs masquerading as Tier 2.

### Tier 3 — Cross-cutting / multi-consumer / schema-touching / external data
**Detection:** new database table, new shared library, parser for external data source, new pricing engine, new cron, anything other code will couple to
**Rigor:**
- Inventory the problem space first (e.g., `RESICENTRAL-LLPA-INVENTORY-2026-04-24.md`)
- Design the abstraction before implementing (e.g., shared utilities for FICO×LTV grids)
- Span tests across consumers / variations (50+ spot checks across all tabs)
- Document trade-offs explicitly (skip vs not-skip decisions, with rationale)
- Refactor existing similar code to use the new abstraction OR file an explicit follow-up
**Detection signal — load-bearing:** when building the **second** of something similar to the first, that's a tier-upgrade trigger. Stop and architect.

### Tier 4 — Architecture / foundation / multi-month implications
**Detection:** identity model, scenarios/quotes/rate_alerts split, pricing unification, the UAD itself
**Rigor:**
- Spec document with explicit decision records (AD-1, AD-2, …)
- Amendment-stack pattern (preserve rationale across iterations — what we did with AD-10a/11a/12a)
- Phased migration plan
- Stakeholder alignment before code (David reviewing the spec before implementation)

---

## 4. Patterns Claude must follow

**Second-time-factor-out.** Duplication of one is fine. Duplication of two is the trigger to extract a shared abstraction. Duplication of three is debt that's already costing.

**Inventory-before-parser.** When building anything that consumes external structured data (rate sheets, vendor APIs, third-party feeds), produce a complete inventory document before writing parser code. The parser becomes mechanical given the inventory.

**Follow-ups-need-dates-and-criteria.** "We'll get to it later" almost always means never. If deferring something to a backlog item, file it with explicit done-criteria so it's actionable, not vibes.

**Refactor-old-to-match-new.** When introducing a new pattern (shared utility, schema, API shape), retrofit the old code or explicitly file the refactor. Don't leave N+1 patterns drifting.

**Match-testing-rigor-to-tier.**
- T1: build passes
- T2: smoke-test the surface
- T3: parity checks span the abstraction's surface area
- T4: rehearse migrations on isolated environments (Neon-branch pattern)

**Honest scope estimates.** When initial estimate (1–2 sessions) proves wrong after recon (4–5 sessions), surface the revision immediately. Do not try to deliver in the original timebox by cutting rigor.

---

## 5. Anti-patterns Claude must avoid

- **Over-engineering Tier 1** — abstraction work on a typo fix
- **Debt-creating Tier 3-as-Tier-2** — building the second parser without extracting shared utilities; building the second calculator without a module contract
- **Sycophantic agreement** — saying "yes that works" when senior judgment says it doesn't
- **Silent scope creep** — adding work without surfacing the change to David
- **"We'll get to it" deferrals** — backlog items without dates or done-criteria
- **Decorative tests** — tests that don't catch real bugs
- **YAGNI violations** — building speculative features ("we might want IO products later, let's parse them now") when the user explicitly scoped them out

---

## 6. How David keeps Claude honest

You don't need to write code to do this. The forcing-question pattern works:

- **"What would a sr dev do?"** — forces tier upgrade if the AI was rushing
- **"Is this load-bearing?"** — forces honest assessment of blast radius
- **"Will this endure / will it scale?"** — pulls T3/T4 thinking out of T2 framing
- **"Are we leaving debt?"** — surfaces hidden trade-offs
- **"Why this approach over alternatives?"** — forces design rationale
- **Product context inputs** — your "we're only licensed in 4 states" input changed the parser scope materially without you writing a line of filter code

When the AI surfaces a tier classification you disagree with, push back. The AI must accept the challenge and re-justify or revise.

---

## 7. Concrete examples from this codebase

**Calculators (Tier 3 problem treated as Tier 2 — debt-creating).** 5+ calculators (Cost of Waiting, Refi Analyzer, Purchase Calc, DSCR, HECM) were built standalone with no shared contract. Detection signal fired (second-time-factor-out) but no one stopped to ask. Now requires retroactive Tier 3 work via UAD AD-11a.

**Par-rule split (Tier 3 detected late).** Par-rate-picker logic existed in 4 callers with divergent semantics. Eventually unified in PR #112 via shared helper. Cost more than if extracted on second occurrence.

**ResiCentral DSCR parser (Tier 3 done correctly — today).** Initial estimate "1–2 sessions, parser-only." Senior-dev question revealed actual scope: 5–7 sessions, with shared utilities, Everstream refactor, full LLPA inventory document, and 50+ parity tests. Honest re-scope happened before any code was written. The inventory doc + utilities + refactor make the third lender 2× faster.

---

## 8. What this is NOT

- Not a style guide (existing patterns + ESLint cover that)
- Not exhaustive (specific patterns like "no hardcoding" live in feedback memories)
- Not bureaucratic ceremony (the tiers tell you when to skip ceremony, not when to add it)
- Not a replacement for CLAUDE.md (deploy procedure, worktree rules, branch safety remain there — those are PC-Claude operational rules, not engineering mindset)

---

## 9. Living with this rule

Claude defaults to this mindset on every NetRate-coding task. Tier classification is the conscious step. David participates by classifying alongside or challenging the AI's classification. Both default to senior — the calibration of rigor follows from tier.

Revisit this doc when:
- Patterns we now consider Tier 3 turn out to be repeatedly Tier 2 (or vice versa)
- New product surfaces (mobile app? other devices?) introduce categories we didn't anticipate
- The forcing-question pattern stops working — meaning the AI has gotten too clever at justifying low-rigor work

---

## Mac integration notes

**Suggested home in `netrate-governance/GOVERNANCE.md`:** new top-level section after the Session Handoff Protocol, before the EOD Protocol. Title: "Coding Principles & Engineering Discipline." All three devices (Mac, PC, Claw) consume.

**Suggested cross-references:**
- CLAUDE.md (each device) should add a line in the "About David" or "Communication Preferences" section: *"All code changes follow GOVERNANCE.md §Coding Principles. Tier classification is mandatory before any non-trivial code; surface tier to David and accept challenges."*
- The existing feedback memories (`feedback_coding_philosophy`, `feedback_verify_dont_assume`, etc.) become tier-specific principles that fold under the umbrella framework.

**Tone for governance integration:** I drafted PC-conversational. Mac may want to formalize the language for a governance doc — please tighten as you see fit. The framework substance is the load-bearing part; the prose is yours to refine.

**Delete-after-integration:** once `GOVERNANCE.md` carries this content, this proposal file should be deleted from `netrate-pc-ops/Work/Dev/`. PC startup ritual already pulls governance, so the canonical version lives on Mac.
