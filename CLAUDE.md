# NetRate Mortgage — PC Operations
# Device: PC (Public Facing)

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

## MANDATORY — Run These Steps BEFORE Responding to ANY Request

Do NOT skip these. Do NOT respond to David's first message until these are complete.

1. `get_briefing(device="pc", department=<yours>)` — full context from MCP
2. `check_relay(device="pc")` — check for cross-device messages
3. Read `Work/SESSION-LOG.md` (last 3-5 entries) — recent work, handoffs, open items
4. Read `REGISTRY.md` (if it exists) — know what's been built
5. `git log --oneline -5` — see recent commits
6. Check for uncommitted/untracked files — previous session may have crashed
7. `get_recent_sessions(device="pc", since=today)` — what other sessions did today
8. Announce your department to David, summarize anything important from the above

Full protocol details in GOVERNANCE.md (Session Handoff Protocol). MCP fallback: pull `netrate-governance`, check `RELAY.md`, read `Work/SESSION-LOG.md`.

**SESSION-LOG:** `Work/SESSION-LOG.md` — ONE log for ALL PC sessions.

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
| Publisher | `Work/Publisher/` | Takes finished markdown from Claw, builds Next.js page components with SEO markup/schema/meta tags, deploys to Vercel. Does NOT write content, make strategy decisions, or touch pricing engine/calculators/API code. |
| Admin | `Work/Admin/` | PC-side admin (minimal — process docs only, NO trackers) |
| Setup | Root files | CLAUDE.md, Work/SESSION-LOG.md, folder structure |

**Daily Auditor** runs as a scheduled task (8 AM daily), not a department. Checks: uncommitted files, stale relays, session log gaps, build health, CLAUDE.md accuracy, stale open items, context layer drift, code review (deep on Mondays). Read-only — reports findings via MCP.

All departments have full access to code and docs. Ownership rules apply to **docs folders** — don't write to another department's docs folder without asking David.

**Ownership rules:**
- All departments may freely edit code (`src/`, `prisma/`, `scripts/`, etc.)
- Only modify files in YOUR department's **docs folder** (e.g. `Work/Dev/`, `Work/Publisher/`)
- You may READ other departments' docs but not edit them
- All departments may write their own entries to `Work/SESSION-LOG.md`
- If you need something from another department, note it as an "open item"

**If David doesn't assign a department:**
Ask: "Which department should I work as? (Dev, Publisher, Admin, or Setup)"

**Critical Dev Rules:**
- **Commit often** with descriptive messages. Push to main = Vercel auto-deploys.
- **No tracker writes.** All trackers live on Mac. Log your work in SESSION-LOG; David relays to Mac.
- **Read DEV-PLAYBOOK.md** for hard-won patterns (Prisma, deployment, etc.)

**Publisher Workflow:**
1. Claw commits finished markdown to `netrate-claw-ops/Work/Marketing/publish-queue/`
2. Claw sends relay to PC: `type: "action"`, content includes the file path to publish
3. David opens PC as Publisher
4. Publisher pulls `netrate-claw-ops`, reads the markdown from `publish-queue/`
5. Builds Next.js page component with SEO markup, schema, meta tags
6. Commits, pushes → Vercel auto-deploys
7. Sends relay back to Claw confirming publication with live URL
- **Publisher does NOT** write content, edit copy, make strategy decisions, or touch Dev code
- **Publisher DOES** add schema markup, Open Graph tags, canonical URLs, internal links, and page-level SEO

---

## Tech Stack

- **Framework:** Next.js 14 (App Router), React 18
- **Styling:** Tailwind CSS 3.4 — brand color `#0891b2` (cyan-600)
- **Database:** Prisma 6 + Neon Postgres (serverless via `@neondatabase/serverless`)
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

## Database Models (Prisma)

**Original (9):** Borrower, Mlo, Loan, LoanEvent, Document, Contact, CallLog, CallNote, SmsMessage

**Phase 1 — CORE Foundation (4 new, in schema but migration not yet run):**
- `LoanDates` — 30+ milestone dates (1:1 with Loan)
- `Condition` — loan conditions tracking (stage, status, blocking, borrower-facing)
- `LoanNote` — operational notes (separate from LoanEvent audit trail)
- `LoanTask` — per-loan task management (priority, assignment, due dates)

**New Loan fields (Phase 1):** loanType, lenderName, loanNumber, loanAmount, interestRate, loanTerm

Schema: `prisma/schema.prisma`

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
├── lib/               Utilities (auth, encryption, prisma, twilio, loan-states)
├── data/              Static data (rate JSON, marketing playbook)
└── generated/prisma/  Auto-generated Prisma client
```

## Patterns

- **Card style:** `bg-white rounded-xl border border-gray-200 p-6 shadow-sm`
- **Button style:** `bg-brand text-white rounded-lg hover:bg-brand-dark`
- **API auth guard:** Check NextAuth session + role in API routes
- **Prisma client:** Singleton at `src/lib/prisma.js`
- **Loan states:** State machine at `src/lib/loan-states.js`
- **Password wall:** `SITE_PASSWORD` env var → middleware at `src/middleware.js`

## Webhook URLs (Twilio)

Must use `www.netratemortgage.com` (not bare domain — Vercel redirects bare → www, causing 405).

## Dev Commands

```bash
npm run dev          # Local dev server (port 3000)
npm run build        # Production build
npx prisma studio    # Database GUI
npx prisma migrate dev --name <name>  # New migration
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
Claw writes content pages → pushes to netrate-claw-ops/Work/Marketing/publish-queue/ → PC Publisher reads from GitHub → builds page → deploys
Mac writes rate tool source → pushes to netrate-ops → PC reads for porting
Mac updates trackers → Neon Postgres reflects changes → TrackerPortal dashboard
PC builds website → pushes to netrate-pc-ops → Vercel auto-deploys from repo root
PC completes tracked work → writes completion report to RELAY.md → Mac validates via enforcement system
All devices share context → MCP knowledge layer (Neon Postgres) → get_briefing / log_session / capture_thought
Cross-device proposals/questions → post to RELAY.md in netrate-governance → other device pulls and reads
```

**Relay:** Cross-device communication uses MCP tools (`send_relay`, `check_relay`, `ack_relay`). Legacy file-based relay (`netrate-governance/RELAY.md`) is a fallback if MCP is unavailable.

### Ironclad Relay Protocol

1. **ALWAYS pass `device` on `check_relay`:**
   `check_relay(device="pc")` — without this, Prisma silently returns 0 results.

2. **ALWAYS pass `from` on `send_relay`:**
   `send_relay(from="pc", to=..., ...)` — never omit the sender.

3. **To REPLY to a relay, use `send_relay` — NOT `ack_relay` with a response:**
   `send_relay(from="pc", to="<originalSender>", type="response", content="your reply")`
   Then ack the original: `ack_relay(id="...", status="resolved")`

4. **`ack_relay` is for STATUS changes only** (acknowledged/resolved). The `response` field auto-creates a reply relay as a safety net, but don't rely on it — always use `send_relay` for replies.

5. **At session start:** `check_relay(device="pc")` — MANDATORY, every session, no exceptions.

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

- **See full guide:** Read from Mac's `netrate-ops` repo: `Work/Marketing/Brand/BRAND_GUIDE.md`
- **Primary color:** Teal (#0891b2)
- **Font:** Inter
- **Logo:** Wordmark — "Net" (black) + "Rate" (teal) + "Mortgage"
- **Philosophy:** "Show, don't tell" — demonstrate transparency with real rates, real math

---

## Folder Structure

```
netrate-pc-ops/
├── CLAUDE.md                ← This file (all rules, all departments)
├── .mcp.json                ← MCP server config (knowledge layer)
├── .claude/                 ← Claude Code config (hooks, launch, settings)
├── DEV-PLAYBOOK.md          ← Hard-won dev patterns (Prisma, deployment, etc.)
├── REGISTRY.md              ← Feature inventory (what's been built)
├── package.json             ← Next.js project
├── src/                     ← Next.js app code
├── prisma/                  ← Database schema
├── public/                  ← Static assets
├── scripts/                 ← Utility scripts
├── docs/                    ← Technical documentation
├── Work/
│   ├── SESSION-LOG.md       ← ONE log for ALL PC sessions
│   ├── Dev/                 ← Docs: architecture plans, specs
│   │   ├── Products/        ← Calculator specs, borrower tools
│   │   └── Integrations/    ← Twilio, Zoho, GCS reference
│   ├── Publisher/            ← Docs: published page logs, SEO notes
│   └── Admin/               ← PC-side admin (process docs only)
```

---

*This file captures all PC operations context — ops rules, tech stack, and dev patterns in one place. Shared rules live in netrate-governance. Governance changes are authored by Mac (base layer authority) and propagated to all devices.*
