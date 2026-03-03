# NetRate Mortgage Site

Production website + borrower portal + MLO dashboard. Deployed to Vercel at netratemortgage.com.

## Tech Stack

- **Framework:** Next.js 14 (App Router), React 18
- **Styling:** Tailwind CSS 3.4 — brand color `#0891b2` (cyan-600)
- **Database:** Prisma 6 + Neon Postgres (serverless via `@neondatabase/serverless`)
- **Auth:** NextAuth 4 (MLO: credentials/JWT), custom magic link + SMS (borrower)
- **Hosting:** Vercel (auto-deploys from pc-ops main branch, root dir = this folder)
- **File Storage:** Vercel Blob (document uploads)
- **Encryption:** AES-256-GCM for SSN/DOB (`src/lib/encryption.js`)

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

**Phases 2-3 designed, not yet in schema.** Full plan at `C:\Users\bickl\.claude\plans\iterative-weaving-abelson.md`.

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
