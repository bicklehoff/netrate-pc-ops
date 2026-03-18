# NetRate Mortgage — PC Operations
# Device: PC (Public Facing)

## MANDATORY: Read GOVERNANCE.md Before ANY Work

Pull `netrate-governance` repo. Read `GOVERNANCE.md`. It contains ALL shared protocols:
- **Session Handoff Protocol (SHP)** — session start, session close, triggers, automatic context recovery
- **EOD Protocol** — end of day (8 steps, includes SHP)
- **Spotter Protocol** — friction scanner
- **Auditor Role** — independent review
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
| `pc-dev` | PC Dev / WebDev / Products / Integrations department |
| `pc-setup` | PC Setup department |
| `pc-marketing` | PC Marketing department |
| `claw` | Claw (Lenovo Legion / Ubuntu device) |

Use these identifiers in MCP tool calls (`source` fields), RELAY entries, and completion reports.

---

## MANDATORY — Run These Steps BEFORE Responding to ANY Request

Do NOT skip these. Do NOT respond to David's first message until these are complete.

1. `get_briefing(device="pc", department=<yours>)` — full context from MCP
2. `check_relay(device="pc")` — check for cross-device messages
3. Read `Work/SESSION-LOG.md` (last 3-5 entries) — recent work, handoffs, open items
4. Read `REGISTRY.md` in your codebase (if it exists) — know what's been built
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
