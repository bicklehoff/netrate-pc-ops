# NetRate Mortgage — PC Operations
# Device: PC (Public Facing)
# Governance: See netrate-governance repo (GOVERNANCE.md) for shared rules

This device handles all public-facing work: website, borrower products, calculators, integrations, and client-facing tools.

**Governance version:** v1.0 — Pull `netrate-governance` repo for shared rules. If your copy differs from Mac, flag it in SESSION-LOG for David to resolve.

---

## Shared Rules (from Governance)

The following are defined in `netrate-governance/GOVERNANCE.md` and apply to ALL devices:
- Session Protocol (read log → work → log)
- Department Model (concept)
- Clerk Protocol (status updates via subagent)
- Spotter Protocol (friction scanner)
- Auditor Role (independent review)
- Tracker Write Permissions (write guard + flag system)
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

| Department | Folder | Responsibilities |
|------------|--------|------------------|
| WebDev | `Work/WebDev/` (docs) + `Work/Development/netrate-mortgage-site/` (code) | Website build, rate tool port, SEO, public pages |
| Products | `Work/Products/` (docs) + code in Development/ | Borrower reports, calculators, client-facing tools |
| Integrations | `Work/Integrations/` (docs) + code in Development/ | Email reading, CRM hooks, public API endpoints |
| Marketing | `Work/Marketing/` (docs) + code in Development/ | Content, copy, lead capture, trust signals |
| Admin | `Work/Admin/` | PC-side admin (minimal — process docs only, NO trackers) |
| Setup | Root files | CLAUDE.md, Work/SESSION-LOG.md, folder structure |
| Auditor | None (read-only) | Independent system review |

## Session Launch Rules

| Session Type | Launch From |
|---|---|
| Dev / WebDev / Products / Integrations / Marketing | `Work/Development/netrate-mortgage-site/` |
| Setup | This repo root (`netrate-pc-ops/`) |
| Auditor | This repo root |

All code sessions launch from the project directory. CLAUDE.md files cascade up from project → Development/ → root, giving full context automatically.

**Ownership rules:**
- Only modify files in YOUR department's folder
- You may READ other departments' files but not edit them
- Only add YOUR OWN entries to Work/SESSION-LOG.md
- If you need something from another department, note it as an "open item"

**If David doesn't assign a department:**
Ask: "Which department should I work as? (WebDev, Products, Integrations, Admin, Setup, or Auditor)"

---

## Tracker Authority — READ ONLY

**This PC has NO tracker write access.**

- ALL tracker JSON files live on Mac in `netrate-ops` at `Work/Admin/trackers/`
- Mac Admin creates/edits tracker content, Mac Clerk updates status
- PC views trackers via TrackerPortal on Vercel (read-only dashboard)

**When PC completes work:**
1. Log it in PC's `Work/SESSION-LOG.md`
2. David relays to Mac: "clerk: [PROJECT-ID] — [what happened]"
3. Mac Clerk updates the tracker
4. TrackerPortal on Vercel reflects the update after next sync

**PC does NOT have a Clerk agent.** The Clerk only runs on Mac where the trackers live.

---

## Cross-Device Data Flow

```
Mac writes marketing copy → pushes to netrate-ops → PC reads from GitHub
Mac writes rate tool source → pushes to netrate-ops → PC reads for porting
Mac Clerk updates trackers → pushes to netrate-ops → Vercel TrackerPortal reflects
PC builds website → pushes to netrate-pc-ops → Vercel auto-deploys from Work/Development/netrate-mortgage-site/
PC completes work → logs in PC SESSION-LOG → David relays to Mac → Mac Clerk updates tracker
Cross-device proposals/questions → post to RELAY.md in netrate-governance → other device pulls and reads
```

**RELAY.md:** For cross-device communication (proposals, questions, handoffs), post to `netrate-governance/RELAY.md` instead of relaying through David verbally. David says "check RELAY.md" to signal new messages. Pull before reading, push after writing.

## Key Resources on Mac (Read via GitHub)

| What | Where (in netrate-ops) | Use |
|------|----------------------|-----|
| Rate tool source | `Work/Development/RateTool/` | Port to website |
| Marketing copy | `Work/Marketing/Website/copy/` | Website content |
| Brand guide | `Work/Marketing/Brand/BRAND_GUIDE.md` | Colors, fonts, logo specs |
| Tracker schema | `netrate-governance/TRACKER_SCHEMA_V2.md` | Reference only |
| Production data | `Work/Admin/mcr/PRODUCTION-SUMMARY.json` | Business metrics |

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

*This file captures PC-specific operations context. Shared rules live in netrate-governance. Changes to shared rules require approval from both devices via David.*
