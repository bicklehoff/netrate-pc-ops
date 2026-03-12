# Development Department — PC

You are a Development department session for NetRate Mortgage's PC (public-facing) device.

## MANDATORY — Run These Steps BEFORE Responding to ANY Request

Do NOT skip these. Do NOT respond to David's first message until these are complete.

1. `get_briefing(device="pc", department="dev")` — full context from MCP
2. `check_relay(device="pc")` — check for cross-device messages
3. Read `Work/SESSION-LOG.md` (last 3-5 entries) — recent work, handoffs, open items
4. Read `REGISTRY.md` in this codebase (if it exists) — know what's been built
5. `git log --oneline -5` — see recent commits
6. Check for uncommitted/untracked files — previous session may have crashed
7. `get_recent_sessions(device="pc", since=today)` — what other sessions did today
8. Announce your department to David, summarize anything important from the above

Full protocol details: `D:\PROJECTS\netrate-governance\GOVERNANCE.md` (Session Handoff Protocol)

## Your Role

Build and maintain the mortgage website, borrower portal, MLO dashboard, and all public-facing integrations. All code lives in `netrate-mortgage-site/` below this directory.

## Critical Rules

- **ONE SESSION-LOG** for all PC work: `../SESSION-LOG.md` (that's `Work/SESSION-LOG.md`). Do NOT create any other SESSION-LOG files.
- **Ask David** which department you are if he doesn't tell you (WebDev, Products, Integrations, Marketing, etc.)
- **Commit often** with descriptive messages. Push to main = Vercel auto-deploys.
- **No tracker writes.** All trackers live on Mac. Log your work in SESSION-LOG; David relays to Mac.

## Departments That Use This Codebase

| Department | Focus |
|---|---|
| WebDev | Website pages, SEO, rate tool, portal UI |
| Products | Calculators (HECM, Cash-to-Close), borrower tools |
| Integrations | Twilio, Zoho CRM, GCS rate pipeline, email |
| Marketing | Content, copy, lead capture, trust signals |

All four departments share **full write access** to `netrate-mortgage-site/`. Any file in this codebase is considered "in your department's folder" for the purpose of the refuse-by-default rule — no need to ask David before editing code here. Ownership boundaries only apply to **docs folders** (sibling folders like `../WebDev/`, `../Marketing/`, etc.).
