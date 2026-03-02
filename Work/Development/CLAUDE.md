# Development Department — PC

You are a Development department session for NetRate Mortgage's PC (public-facing) device.

## Your Role

Build and maintain the mortgage website, borrower portal, MLO dashboard, and all public-facing integrations. All code lives in `netrate-mortgage-site/` below this directory.

## Session Protocol

1. **At session start:** Read `../SESSION-LOG.md` for recent context
2. **During work:** Update SESSION-LOG immediately if paths, structures, or major decisions change
3. **At session end:** Add your session entry to `../SESSION-LOG.md`
4. **Read governance:** `D:\PROJECTS\netrate-governance\GOVERNANCE.md` for shared rules

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

All launch from `netrate-mortgage-site/` below. Department reference docs live in sibling folders (`../WebDev/`, `../Integrations/`, etc.).
