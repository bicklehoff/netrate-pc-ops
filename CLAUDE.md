# NetRate Mortgage — PC Operations
# Device: PC (Public Facing)

## MANDATORY: Run Startup Lite Before ANYTHING Else

**Do not announce your department, do not ask what we're working on, do not respond to the user's first message until all 4 steps below are complete.**

1. `get_briefing(device="pc", department=<yours>)` — full context from MCP
2. `GET https://tracker.netratemortgage.com/api/relay?participant=pc&status=open` with header `x-tracker-api-key: ntk_6f069e97f3272b9e1543710929b4517a` — check for open relay messages (REST API call, not MCP tool)
3. Announce department and summarize findings from steps 1 and 2
4. Read your department CLAUDE.md:
   - Dev → `Work/Dev/CLAUDE.md`
   - Admin → `Work/Admin/CLAUDE.md`
   - Setup → this file is your doc

---

## MANDATORY: Read GOVERNANCE.md Before ANY Work

Pull `netrate-governance` repo. Read `GOVERNANCE.md`. It contains ALL shared protocols:
- **Session Handoff Protocol (SHP)** — session start, session close, triggers, automatic context recovery
- **EOD Protocol** — end of day (8 steps, includes SHP)
- **Spotter Protocol** — friction scanner
- **Department Model, Tracker Architecture, Cross-Device Rules, Document Generation, Process Documentation**

**Nothing in this file replaces governance.** This file contains PC-specific context only. Governance is the single source of truth for all shared protocols. Mac is the authority for the base layer.

---

## Device Architecture (Three-Device Network)

| Device | Role | Repos |
|--------|------|-------|
| **Mac** | Back office — processing, compliance, trackers, internal tools. Governance authority. | `netrate-ops` |
| **PC** | Public facing — website, rate tool, calculators, borrower products, integrations | `netrate-pc-ops` |
| **Claw** (Lenovo Legion / Ubuntu) | Advisory/directive — legal, compliance, strategy | `claw-ops` |

All devices share context via the **MCP knowledge layer** (Neon Postgres).

## Actor Vocabulary

| Actor | Meaning |
|-------|---------|
| `david` | David Burson (human operator) |
| `admin` | Mac Admin department |
| `dev` | Mac Dev department |
| `pc-dev` | PC Dev department (all code — website, tools, calculators, integrations, APIs) |
| `pc-setup` | PC Setup department |
| `pc-publisher` | PC Publisher department (content page deployment, SEO markup) |
| `claw` | Claw (Lenovo Legion / Ubuntu device) |

Use these identifiers in MCP tool calls (`source` fields), RELAY entries, and completion reports.

---


## About David

- **Name:** David Burson
- **Email:** bicklehoff@gmail.com
- **Business:** NetRate Mortgage LLC (formerly Locus Mortgage)
- **NMLS:** 641790 (individual) | 1111861 (company)
- **Location:** 357 S McCaslin Blvd #200, Louisville, CO 80027
- **Phone:** 303-444-5251
- **Business email:** david@netratemortgage.com
- **Structure:** Solo operation, one loan officer (Jamie Cunningham)
- **States licensed:** CA, CO, TX, OR

## Communication Preferences

- Adapt response style to the task (concise for quick questions, thorough for complex problems)
- Be direct — David values clarity over politeness padding
- Ask clarifying questions when requirements are ambiguous
- David likes to understand the "why" behind recommendations
- Iterative approaches preferred — start simple, refine as needed
- Flag trade-offs and let David decide
- Solo operator mindset — minimize expenses, maximize leverage

---

## PC Departments

All departments launch from the same place: **this repo root** (`netrate-pc-ops/.claude`). One launch point, every session.

| Department | Docs Folder | Responsibilities |
|------------|-------------|------------------|
| Dev | `Work/Dev/` (+ `Products/`, `Integrations/` subfolders) | All code — website, tools, calculators, integrations, APIs, CRM hooks |
| Admin | `Work/Admin/` | PC-side admin (minimal — process docs only, NO trackers) |
| Setup | Root files | CLAUDE.md, folder structure |

**Daily Auditor** runs as a scheduled task (8 AM daily), not a department. Checks: uncommitted files, stale relays, session log gaps, build health, CLAUDE.md accuracy, stale open items, context layer drift, code review (deep on Mondays). Read-only — reports findings via MCP.

All departments have full access to code and docs. Ownership rules apply to **docs folders** — don't write to another department's docs folder without asking David.

**Ownership rules:**
- All departments may freely edit code (`src/`, `migrations/`, `scripts/`, etc.)
- Only modify files in YOUR department's **docs folder** (e.g. `Work/Dev/`, `Work/Admin/`)
- You may READ other departments' docs but not edit them
- If you need something from another department, note it as an "open item"

**If David doesn't assign a department:**
Ask: "Which department should I work as? (Dev, Admin, or Setup)"

**Critical Dev Rules:**
- **NEVER push directly to main.** Branch protection is enabled — direct pushes are rejected.
- **All work happens on a branch.** Workflow: `git checkout main && git pull && git checkout -b fix/description` → commit → `git push -u origin fix/description` → create PR. David merges when ready.
- **Always branch from main — never from another unmerged branch.** Branching from an unmerged branch silently inherits its commits and causes cross-session confusion. Exception: intentionally building on top of another branch's work.
- **Branch naming:** `fix/` for bug fixes, `feature/` for new features, `docs/` for documentation.
- **Commit often** with descriptive messages within your branch.
- **No tracker writes.** All trackers live on Mac. Use relay to communicate completed work to Mac.
- **Read DEV-PLAYBOOK.md** for hard-won patterns (migrations, deployment, etc.)
- **MANDATORY: Follow the Deploy Procedure below. Every step requires David's explicit go-ahead.**

### Deploy Procedure (MANDATORY — no exceptions, no skipping steps)

#### Rule Zero
**Never run `npm run build`, `git push`, or `gh pr create` without David explicitly saying so.**

#### Phase 1 — Before any code changes
1. `git status` — confirm clean starting point, know what branch we're on
2. `git checkout main && git pull && git checkout -b <type>/<description>` — always branch from main, never from an unmerged branch

#### Phase 2 — After code changes are complete
3. Present a summary of all changes — David reviews before anything runs
4. David says **"build"** → **determine the lane first**, then act:

   ```bash
   # Everything changed vs origin/main (staged, unstaged, untracked)
   CHANGED=$( ( git diff --name-only origin/main -- ; git ls-files --others --exclude-standard ) | sort -u )
   BUILD_AFFECTING=$(echo "$CHANGED" | grep -E '^(src/|migrations/|public/|scripts/|package\.json$|package-lock\.json$|next\.config\.|tailwind\.config\.|postcss\.config\.|jsconfig\.json$|tsconfig\.json$|vercel\.json$|middleware\.|\.env($|\.))' || true)
   ```

   - **Build-affecting lane** (any match) → run `npm run build`. Zero ESLint **errors** (warnings OK). No TS/module errors. All pages compile.
   - **Docs-only lane** (zero matches — e.g. changes limited to `Work/**`, `docs/**`, `.claude/**`, `.github/**`, root `*.md`) → **skip `npm run build`**. State: *"Docs-only change — skipping local build. Vercel preview (Phase 4) is the gate."* Note "docs-only" in the PR body.

   The lane rule exists because local build only verifies files in the build-affecting paths above; recompiling `src/` on a docs PR just re-verifies `origin/main`. When in doubt, take the build-affecting lane. **Mixed PRs always take the build-affecting lane.**
5. If build fails (build-affecting lane only) → fix, repeat from step 4
6. `git diff origin/main --stat` + `git status --short` — final sanity check on changed files

#### Phase 3 — Push & PR
8. David says **"push"** → `git push -u origin <branch>`
9. David says **"PR"** → `gh pr create` with clear title + description
   - After PR is created, parse the PR number from the URL and prepend it to the title:
     ```bash
     PR_NUM=$(gh pr view --json number -q .number)
     gh pr edit --title "#${PR_NUM} [pc] your-title-here"
     ```
   - This makes the PR number visible in Vercel's deployment list (squash merge uses PR title as commit message)
10. Post the PR URL — David reviews on GitHub

#### Phase 4 — Vercel preview
11. Wait for Vercel preview build (visible on PR checks)
12. If preview fails → pull logs, fix on branch, push again — no merge until green
13. David confirms preview looks good

#### Phase 5 — Merge & production
14. David says **"merge"** → `gh pr merge --squash`
15. Monitor production: `npx vercel ls netrate-mortgage-site | head -5` — confirm "Ready"
16. If "Error" → pull logs immediately, open hotfix branch

#### Hard stops (never skip)
- No direct push to `main` — ever
- No `vercel link` without `--project netrate-mortgage-site`
- No merge on a failing PR check
- No new Vercel project creation
- **Never declare work "deployed" from git state alone.** Finding commits already upstream ≠ successful Vercel build. Always verify with `npx vercel ls netrate-mortgage-site | head -5` and confirm "Ready".

**Common build killers (ESLint errors that block Vercel):**
- Unused imports (`'X' is defined but never used`) — remove the import
- Conditional hooks (`React Hook called conditionally`) — move hooks before any early return
- Missing dependencies in useEffect — add to dependency array or suppress with eslint-disable comment

### Concurrent Sessions Protocol

David may run multiple Claude Code sessions against this repo simultaneously. These rules prevent branch collisions, memory loss, and deploy conflicts.

#### Session Types
- **Main session** (setup/admin): Runs in repo root (`D:\PROJECTS\netrate-pc-ops`). Owns the dev server (port 3000). Can execute every deploy gate including merge + production confirm.
- **Worktree session** (dev work): Runs via `EnterWorktree`. Has its own branch checkout — no collisions with other sessions. Does NOT run dev servers. **Can execute every deploy gate** including `gh pr merge` (API-based — no local branch switch) and production monitoring (read-only).

#### Memory in Worktrees
If your CWD contains `.claude/worktrees/`, auto-memory may not load. At session start, manually read:
```
C:\Users\bickl\.claude\projects\D--PROJECTS-netrate-pc-ops\memory\MEMORY.md
```
Then read each file it references. This gives you the same operational knowledge as main-directory sessions.

#### Dev Server Ownership
Only the main session runs `preview_start(name='dev')` on port 3000. Worktree sessions validate changes with `npm run build` only.

#### Worktree node_modules
Each worktree installs its own dependencies. From the worktree root:
```
cp /d/PROJECTS/netrate-pc-ops/.env .
npm ci
```
`npm ci` takes ~90 sec and installs ~500 MB. **Do NOT symlink/junction `node_modules` to the main checkout** (`mklink /J node_modules D:\PROJECTS\netrate-pc-ops\node_modules`). That pattern was retired 2026-04-24 because it silently couples every worktree's build to the main checkout's last-installed state. When `package.json` adds a dep (e.g. `@upstash/ratelimit` in PR #175), worktrees junctioned to a stale main checkout fail to build with "Cannot resolve" errors, even though the worktree's own lockfile is correct. Cost of the junction (shared state footgun) outweighs the 90 sec saved.

#### Deploy from Worktrees
Worktree sessions execute every deploy gate. The hazard being protected against is **touching the `main` branch locally from the worktree**, not API-based operations.

**Safe from worktrees (execute on David's go-ahead):**
- `gh pr merge --squash` (GitHub API — does not modify local branch or refs)
- `gh pr view` / `gh pr edit` / `gh pr status` (read/API-only)
- `npx vercel ls` and `vercel inspect` (read-only)
- `curl` smoke tests against production URLs (read-only)

**Never from worktrees:**
- `git checkout main` — would switch the worktree off its own branch
- `git pull` while on `main` — modifies the local `main` ref
- `git merge origin/main` into the `main` branch locally
- Any operation that modifies the local `main` ref from inside the worktree

**Worktree lifecycle:** a worktree stays on its own branch for its entire life. After its PR is merged, the worktree may:
- be exited + removed (its branch is dead now), or
- spawn a new branch for follow-up work using `git fetch origin main && git checkout -b <new-branch> origin/main` — this creates a NEW local branch tracking the updated remote without touching the local `main` ref.

#### Deploy Lock
Before entering Gate 1, check `.claude/deploy.lock`:
- **If it exists:** Another session is deploying — read it, report the branch and timestamp to David, and wait.
- **If absent:** Create it with your branch name and ISO timestamp. Delete it after deploy completes or aborts.
- **Stale locks:** If the timestamp is more than 2 hours old, ask David whether to clear it (session may have crashed).

---

## Tech Stack

- **Framework:** Next.js 14 (App Router), React 18
- **Styling:** Tailwind CSS 3.4 — brand color `#0891b2` (cyan-600)
- **Database:** Neon Postgres — raw SQL via `@neondatabase/serverless`. Schema lives in prod + `migrations/*.sql`. Prisma was removed 2026-04-23 — it had been a runtime-unused design artifact that had drifted 22 tables behind reality.
- **Auth:** NextAuth 4 (MLO: credentials/JWT), custom magic link + SMS (borrower)
- **Hosting:** Vercel (auto-deploys from this repo's root directory)
- **File Storage:** Vercel Blob (document uploads)
- **Encryption:** AES-256-GCM for SSN/DOB (`src/lib/encryption.js`)
- **GA4 Measurement ID:** G-QPEE5ZSZ79
- **GSC:** Verified via GoDaddy DNS
- **Domain:** netratemortgage.com (GoDaddy → Vercel)

## Key Integrations

| Integration | Library/Service | Key Files |
|---|---|---|
| Twilio Voice/SMS | `@twilio/voice-sdk` | `src/lib/twilio-voice.js`, `src/lib/twilio-verify.js` |
| Zoho CRM | REST API (OAuth) | `src/app/api/lead/route.js` |
| GCS Rate Pipeline | `@google-cloud/storage` | `src/lib/gcs.js`, `scripts/upload-to-gcs.js` |
| Google Maps | Places API | Address autocomplete in application form |

## Database

**79 tables in prod** across 8 domains (identity, deals/loans, scenarios/pricing, reference data, operational, marketing/content, config, archive). For a full structural audit, see [`Work/Dev/audits/DB-STRUCTURE-2026-04-23.md`](Work/Dev/audits/DB-STRUCTURE-2026-04-23.md).

- Source of truth: **the live Postgres schema** (not a Prisma file)
- Schema evolution: hand-written SQL in `migrations/*.sql`, applied via per-migration runner scripts in `scripts/_run-migration-*.mjs`
- Runtime: `@neondatabase/serverless` tagged templates (`sql\`SELECT ...\``) or `sql.query(text, params)` for dynamic SQL

## Picklist Constants

`src/lib/constants/` — loan-types.js, lenders.js (more coming in future phases)

## Key Directories

```
src/
├── app/
│   ├── api/           Backend routes (auth, dialer, portal, lead, rates)
│   ├── portal/        Borrower dashboard + MLO dashboard
│   ├── rates/         Public rate display
│   ├── services/      Service pages
│   └── ...            Other public pages (about, contact, licensing, privacy, etc.)
├── components/Portal/ React components (Dialer, LoanDetail, Pipeline, Forms)
├── lib/               Utilities (auth, encryption, db, twilio, loan-states)
└── data/              Static data (rate JSON, marketing playbook)
```

## Patterns

- **Card style:** `bg-white rounded-xl border border-gray-200 p-6 shadow-sm`
- **Button style:** `bg-brand text-white rounded-lg hover:bg-brand-dark`
- **API auth guard:** Check NextAuth session + role in API routes
- **DB client:** Singleton at `src/lib/db.js` (tagged-template + `.query(text, params)`)
- **Loan states:** State machine at `src/lib/loan-states.js`
- **Password wall:** Removed — site is public as of ~2026-03-24. `SITE_PASSWORD` env var is unset. Middleware still supports it if re-enabled but currently bypassed.

## Webhook URLs (Twilio)

Must use `www.netratemortgage.com` (not bare domain — Vercel redirects bare → www, causing 405).

## Vercel — CRITICAL SAFETY RULE

**The Vercel project is `netrate-mortgage-site`.** NEVER run `vercel link`, `vercel --yes`, or any Vercel CLI command that could create a new project. Always use `--project netrate-mortgage-site` when linking. Before any `vercel` command, run `cat .vercel/project.json` to confirm you're linked to the correct project. See DEV-PLAYBOOK.md for details.

## Dev Commands

```bash
npm run dev          # Local dev server (port 3000)
npm run build        # Production build

# New migration:
#   1. Write hand-written SQL at migrations/NNN_description.sql (idempotent)
#   2. Add a runner at scripts/_run-migration-NNN.mjs (reads, splits, applies, verifies)
#   3. Rehearse against a Neon branch (per DEV-PLAYBOOK) if it touches existing data
#   4. Run against prod
```

---

## Tracker Authority — READ ONLY

**This PC has NO tracker write access.**

- Tracker data lives in Neon Postgres (shared database — Mac is authority)
- Mac writes ops/finance/compliance data. PC writes loans/borrower data.
- PC views ops trackers via TrackerPortal on Vercel (read-only dashboard)

**When PC completes tracked work, write a completion report to RELAY.md:**

```
## [DATE] — PC → Mac: Completion Report
Project: {project_id}
Instruction: {instruction_id}
Outcome: {what was done}
Assertions: { key: value }
Actor: pc-dev
```

This structured format lets Mac's enforcement system validate the completion.

---

## Cross-Device Data Flow

```
Mac writes marketing copy → pushes to netrate-ops → PC reads from GitHub
Claw writes content pages → pushes to netrate-claw-ops → Claw deploys
Mac writes rate tool source → pushes to netrate-ops → PC reads for porting
Mac updates trackers → Neon Postgres reflects changes → TrackerPortal dashboard
PC builds website → pushes branch to netrate-pc-ops → PR merged to main → Vercel auto-deploys
PC completes tracked work → writes completion report to RELAY.md → Mac validates via enforcement system
All devices share context → MCP knowledge layer (Neon Postgres) → get_briefing / log_session / capture_thought
Cross-device proposals/questions → post to RELAY.md in netrate-governance → other device pulls and reads
```

**Relay:** Cross-device communication uses the **TrackerPortal Relay API** (REST). MCP relay tools (`send_relay`, `check_relay`, `ack_relay`) are deprecated — do not use them.

Auth: `x-tracker-api-key: {TRACKER_API_KEY}` on all requests.

### Relay Protocol

1. **Check inbox at session start — MANDATORY, every session:**
   `GET https://tracker.netratemortgage.com/api/relay?participant=pc&status=open`

2. **Send a relay:**
   `POST https://tracker.netratemortgage.com/api/relay`
   Body: `{ fromDevice, toDevice, type, content, context? }`

3. **Ack or resolve:**
   `PATCH https://tracker.netratemortgage.com/api/relay/{id}`
   Body: `{ status: "resolved", response: "..." }`

4. **UI:** David views and resolves relays at `tracker.netratemortgage.com/relay`.

## Key Resources on Mac (Read via GitHub)

| What | Where (in netrate-ops) | Use |
|------|----------------------|-----|
| Rate tool source | `Work/Development/RateTool/` | Port to website |
| Marketing copy | `Work/Marketing/Website/copy/` | Website content |
| Brand guide | `Work/Marketing/Brand/BRAND_GUIDE.md` | Colors, fonts, logo specs |
| Tracker schema | Neon Postgres — see GOVERNANCE.md | Reference only |
| Production data | `Work/Admin/mcr/PRODUCTION-SUMMARY.json` | Business metrics |

---

## MCP Knowledge Layer

PC connects to the shared knowledge layer via `.mcp.json` in repo root. The MCP server (`netrate-governance/mcp-server/`) provides 12 tools:

| Tool | Use |
|------|-----|
| `get_briefing` | Session start — full context dump |
| `log_session` | Session end — structured session record |
| `capture_thought` | Save a knowledge atom (fact, preference, insight, rule, pattern) |
| `search_thoughts` | Find knowledge by text, category, source, topics |
| `log_decision` | Record an architectural or business decision with rationale |
| `search_decisions` | Search decisions before re-asking David |
| `list_thoughts` / `list_decisions` | Full context audits |
| `update_thought` / `update_decision` | Mark as superseded, change confidence |
| `get_recent_sessions` | Session history across devices |
| `prune_sessions` | Cleanup sessions older than 90 days |

**Database:** Neon Postgres (same instance as the website). Connection via `DATABASE_URL` in `.mcp.json`.

---

## Brand

- **Design system (MANDATORY for all UI work):** `Work/Dev/DESIGN-SYSTEM.md` — current tokens mirrored from `tailwind.config.js`. Source of truth is the tailwind config itself; read it first for any color/radius/shadow value.
- **Primary tokens:** brand `#2E6BA8` (blue), go `#059669` (green CTA), accent `#FFC220` (yellow highlight), ink `#1A1F2E` (text). No cyan, no teal, no ad-hoc hex.
- **Full brand guide (voice, logo, philosophy):** Read from Mac's `netrate-ops` repo: `Work/Marketing/Brand/BRAND_GUIDE.md`
- **Font:** Inter
- **Philosophy:** "Show, don't tell" — demonstrate transparency with real rates, real math

### Branding Rules (mandatory for all published content)

1. **We are a broker, not a wholesaler.** NetRate Mortgage is a licensed mortgage broker — we access wholesale pricing from lenders on the borrower's behalf. Never refer to NetRate as a wholesale lender or imply we are the source of wholesale rates.

2. **Always use "NetRate Mortgage" — never just "NetRate".** Every public-facing reference must use the full brand name "NetRate Mortgage". Bare "NetRate" is not acceptable in any website copy, UI labels, meta titles, descriptions, or marketing content (copyright requirement). Abbreviations (e.g. "NRM") are not acceptable substitutes.

---

## Folder Structure

```
netrate-pc-ops/
├── CLAUDE.md                ← This file (all rules, all departments)
├── .mcp.json                ← MCP server config (knowledge layer)
├── .claude/                 ← Claude Code config (hooks, launch, settings)
├── DEV-PLAYBOOK.md          ← Hard-won dev patterns (migrations, deployment, etc.)
├── REGISTRY.md              ← Feature inventory (what's been built)
├── package.json             ← Next.js project
├── src/                     ← Next.js app code
├── migrations/              ← Hand-written SQL migrations (applied via scripts/_run-migration-*.mjs)
├── public/                  ← Static assets
├── scripts/                 ← Utility scripts (including migration runners)
├── docs/                    ← Technical documentation
├── Work/
│   ├── Dev/                 ← Docs: architecture plans, specs
│   │   ├── Products/        ← Calculator specs, borrower tools
│   │   └── Integrations/    ← Twilio, Zoho, GCS reference
│   ├── Publisher/            ← Docs: published page logs, SEO notes
│   └── Admin/               ← PC-side admin (process docs only)
```

---

*This file captures all PC operations context — ops rules, tech stack, and dev patterns in one place. Shared rules live in netrate-governance. Governance changes are authored by Mac (base layer authority) and propagated to all devices.*
