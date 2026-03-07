# NetRate Mortgage — PC Operations
# Device: PC (Public Facing)
# Governance: See netrate-governance repo (GOVERNANCE.md) for shared rules

This device handles all public-facing work: website, borrower products, calculators, integrations, and client-facing tools.

**Governance version:** v2.0 — Mac is the authority for the base layer. Pull `netrate-governance` repo for shared rules.

---

## Device Architecture (Three-Device Network)

| Device | Role | Repos |
|--------|------|-------|
| **Mac** | Back office — processing, compliance, trackers, internal tools. Governance authority. | `netrate-ops` |
| **PC** | Public facing — website, rate tool, calculators, borrower products, integrations | `netrate-pc-ops` |
| **Dave** (Ubuntu) | Third device — role TBD | TBD |

All devices share context via the **MCP knowledge layer** (Neon Postgres).

## Actor Vocabulary

| Actor | Meaning |
|-------|---------|
| `david` | David Burson (human operator) |
| `admin` | Mac Admin department |
| `dev` | Mac Dev department |
| `pc-dev` | PC Dev / WebDev / Products / Integrations department |
| `pc-marketing` | PC Marketing department |
| `dave` | Dave (Ubuntu device) |

Use these identifiers in MCP tool calls (`source` fields), RELAY entries, and completion reports.

---

## Session Protocol (MCP-Connected)

**At the START of every new chat:**
1. Call `get_briefing(device="pc", department=<yours>)` via MCP to get full context: recent sessions (own + cross-device), active decisions, open items, capture stats
2. Read `Work/SESSION-LOG.md` (last 3–5 entries) to check for in-progress work, recent file changes, or handoff notes from other departments
3. Review both sources — summarize anything important for David before starting work
4. If MCP is unavailable, fall back to: pull `netrate-governance`, check `RELAY.md`, read `Work/SESSION-LOG.md`

**DURING a session — update Work/SESSION-LOG.md immediately if:**
- Another department would need to know this to do their job
- Paths, folders, or file structures changed
- A major or permanent decision was made
- Something was created that other chats will reference

*Rule of thumb: If you'd tell a coworker "hey, heads up..." — log it now.*

**At the END of every session:**
1. Update `Work/SESSION-LOG.md` with what was done
2. Call `log_session(device="pc", department=<yours>, summary=..., keyDecisions=[...], filesModified=[...], openItems=[...])` via MCP
3. Use MCP tools to capture any reusable knowledge: `capture_thought` for facts/insights, `log_decision` for decisions made

---

## Shared Rules (from Governance)

The following are defined in `netrate-governance/GOVERNANCE.md` and apply to ALL devices:
- Session Protocol (MCP briefing → work → MCP log)
- Department Model (concept)
- EOD Protocol (end of day wrap-up)
- Tracker Architecture (Neon Postgres — shared database)
- Spotter Protocol (friction scanner)
- Auditor Role (independent review)
- Document Generation rules
- Process Documentation rules
- Cross-Device Rules (device roles, tracker authority, governance changes)

**Read GOVERNANCE.md before your first session.** These rules are not repeated here.

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
- **States licensed:** CO, TX, OR (CA in progress)

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

| Department | Docs Folder | Code Access | Responsibilities |
|------------|-------------|-------------|------------------|
| WebDev | `Work/WebDev/` | Full — `netrate-mortgage-site/` | Website build, rate tool port, SEO, public pages |
| Products | `Work/Products/` | Full — `netrate-mortgage-site/` | Borrower reports, calculators, client-facing tools |
| Integrations | `Work/Integrations/` | Full — `netrate-mortgage-site/` | Email reading, CRM hooks, public API endpoints |
| Marketing | `Work/Marketing/` | Full — `netrate-mortgage-site/` | Content, copy, lead capture, trust signals |
| Admin | `Work/Admin/` | None | PC-side admin (minimal — process docs only, NO trackers) |
| Setup | Root files | None | CLAUDE.md, Work/SESSION-LOG.md, folder structure |
| Auditor | None (read-only) | Read only | Independent system review |

All code departments (WebDev, Products, Integrations, Marketing) share write access to `Work/Development/netrate-mortgage-site/`. Ownership rules apply to **docs folders** — don't write to another department's docs folder without asking David.

## Session Launch Rules

| Session Type | Launch From |
|---|---|
| Dev / WebDev / Products / Integrations / Marketing | `Work/Development/netrate-mortgage-site/` |
| Setup | This repo root (`netrate-pc-ops/`) |
| Auditor | This repo root |

All code sessions launch from the project directory. CLAUDE.md files cascade up from project → Development/ → root, giving full context automatically.

**Ownership rules:**
- All code departments may freely edit code in `Work/Development/netrate-mortgage-site/`
- Only modify files in YOUR department's **docs folder** (e.g. `Work/WebDev/`, `Work/Marketing/`)
- You may READ other departments' docs but not edit them
- All departments may write their own entries to `Work/SESSION-LOG.md`
- If you need something from another department, note it as an "open item"

**If David doesn't assign a department:**
Ask: "Which department should I work as? (WebDev, Products, Integrations, Admin, Setup, or Auditor)"

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
Mac writes rate tool source → pushes to netrate-ops → PC reads for porting
Mac updates trackers → Neon Postgres reflects changes → TrackerPortal dashboard
PC builds website → pushes to netrate-pc-ops → Vercel auto-deploys from Work/Development/netrate-mortgage-site/
PC completes tracked work → writes completion report to RELAY.md → Mac validates via enforcement system
All devices share context → MCP knowledge layer (Neon Postgres) → get_briefing / log_session / capture_thought
Cross-device proposals/questions → post to RELAY.md in netrate-governance → other device pulls and reads
```

**RELAY.md:** For cross-device communication (proposals, questions, handoffs, completion reports), post to `netrate-governance/RELAY.md`. David says "check RELAY.md" to signal new messages. Pull before reading, push after writing.

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
├── CLAUDE.md                          ← This file (PC-specific rules)
├── .mcp.json                          ← MCP server config (knowledge layer)
├── Work/
│   ├── SESSION-LOG.md                 ← ONE log for ALL PC sessions
│   ├── Development/
│   │   ├── CLAUDE.md                  ← Dev department rules
│   │   └── netrate-mortgage-site/     ← Website + portal codebase
│   │       ├── CLAUDE.md              ← Project tech stack
│   │       ├── src/                   ← Next.js app code
│   │       ├── prisma/                ← Database schema
│   │       └── ...
│   ├── WebDev/                        ← Docs: architecture plans, specs
│   ├── Marketing/                     ← Docs: playbook, brand, dev briefs
│   ├── Products/                      ← Docs: calculator specs
│   ├── Integrations/                  ← Docs: Twilio, Zoho, GCS reference
│   └── Admin/                         ← PC-side admin (process docs only)
├── .claude/
│   ├── agents/
│   ├── scripts/
│   └── settings.local.json
```

---

## Active Projects

### Website + Portal (WEBSITE-2026 — tracked on Mac)
- **Code:** `Work/Development/netrate-mortgage-site/` (in this repo)
- **Hosting:** Vercel (deploys from this repo, root dir = `Work/Development/netrate-mortgage-site`)
- **Stack:** Next.js 14, Tailwind CSS 3.4, React 18, Prisma 6, Neon Postgres
- **GA4 Measurement ID:** G-QPEE5ZSZ79
- **GSC:** Verified via GoDaddy DNS
- **Domain:** netratemortgage.com (GoDaddy → Vercel)
- **Git history:** Pre-migration commits archived in `bicklehoff/netrate-mortgage-site` (read-only)

---

*This file captures PC-specific operations context. Shared rules live in netrate-governance. Governance changes are authored by Mac (base layer authority) and propagated to all devices.*
