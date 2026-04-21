# PC Dev Playbook

Rules and patterns learned the hard way. Follow these to avoid production incidents.

---

## Prisma / Database

### Never use `db push` — migrations only
Every schema change needs a migration file. `prisma db push` applies changes to the connected DB without creating a migration, which means production never gets those columns. The Prisma client will try to SELECT columns that don't exist and crash at runtime.

**Workflow for schema changes:**
1. Edit `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name descriptive_name` to generate migration
3. Review the generated SQL in `prisma/migrations/`
4. Commit both the schema AND migration file together

### Data migrations: branch first, then apply to prod

Neon-branch rehearsal is **mandatory** when the migration can corrupt existing data — specifically, any migration with `UPDATE`/`DELETE` using value-based `WHERE` clauses, or multi-step data transforms where statement ordering matters.

Rehearsal is **optional** (skip allowed) when the migration is purely additive and cannot corrupt anything:

| Case | Rehearse? | Why |
|---|---|---|
| `UPDATE`/`DELETE` on existing table with value-based `WHERE` | ✅ mandatory | Statement ordering, type coercion, or row-shape surprises can corrupt data |
| Multi-step data transform on existing rows | ✅ mandatory | Migration 017 class — ordering bugs |
| New-column `ADD COLUMN` on existing table | ⏭ skip | Purely additive |
| `CREATE INDEX` | ⏭ skip | Read-path only |
| New-table `CREATE TABLE IF NOT EXISTS` + seed rows with `ON CONFLICT DO NOTHING` | ⏭ skip | Cannot touch existing data; bad seed is visible immediately in the runner's verification output and trivial to fix on an otherwise-empty table |
| Empty-schema-first table (D9d §8 Q2 style) | ⏭ skip | No data at all — nothing to verify |

The principle: **rehearse when the blast radius includes live rows.** Don't cargo-cult the protocol on migrations that are structurally incapable of destroying anything.

```bash
# 1. Create a branch (Neon console or CLI — 30 seconds)
neon branches create --name migration-NNN-test

# 2. Run against the branch
PC_DATABASE_URL=<branch-connection-string> node scripts/_run-migration-NNN.mjs

# 3. Verify the post-run distribution matches expectations

# 4. Delete the branch, run against prod
neon branches delete migration-NNN-test
node scripts/_run-migration-NNN.mjs
```

The runner already accepts any `DATABASE_URL`, so no special mode needed — just point it at the branch URL. The branch is a full copy of prod data at that instant.

**Why this matters:** Migration 017 (loan_term months→years) had a statement ordering bug — the `/12` pass ran before the outlier null, so `WHERE loan_term = 30` matched all 659 just-converted 30-year rows instead of the one Rocket Mortgage outlier. 659 rows were nulled and had to be restored manually from Neon PITR. A branch run would have shown the wrong post-run distribution immediately.

### Hand-written migrations: always use IF NOT EXISTS
Prisma's auto-generated migrations use bare `ALTER TABLE ADD COLUMN` which fails if the column exists. When writing manual SQL:
```sql
-- Good
ALTER TABLE "loans" ADD COLUMN IF NOT EXISTS "my_field" TEXT;

-- Bad (fails if column exists)
ALTER TABLE "loans" ADD COLUMN "my_field" TEXT;
```

### Build script includes migrate deploy
The build script is: `prisma generate && (prisma migrate deploy || true) && next build`

- `prisma generate` — regenerates the client from schema (knows about new columns)
- `prisma migrate deploy` — applies pending migrations to the DB (creates the columns)
- `|| true` — non-blocking so build succeeds even if migrate can't connect during build
- `next build` — compiles the app

If `migrate deploy` fails silently, run it manually: `npx prisma migrate deploy`

### Schema + migration must stay in sync
Before pushing, verify: every field in `schema.prisma` has a corresponding column created by some migration in `prisma/migrations/`. If you're unsure, run `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma` to see drift.

---

## Neon DB Usage (Keep Transfer Low)

Neon serverless billing includes **network transfer**. The free tier is 5 GB/month — easy to blow through on a heavy seeding day. Patterns that burn transfer:

### Always use the pooled connection string
`PC_DATABASE_URL` must point to the `-pooler.` URL (PgBouncer), not the direct endpoint. PgBouncer reuses connections; the direct URL opens a new TCP connection per query.
- Pooled: `ep-plain-math-aixa3lmr-pooler.c-4.us-east-1.aws.neon.tech`
- Direct (migrations only): `ep-plain-math-aixa3lmr.c-4.us-east-1.aws.neon.tech`

Use `directUrl` in `schema.prisma` for Prisma migrations. Use pooled for everything else.

### Seed scripts: run locally only, once per rate sheet day
Never run seed scripts from a Vercel serverless function — every invocation opens a fresh HTTP connection to Neon. Run them from your local machine where the connection can be reused.

**seed-adjustment-rules.mjs** has a skip guard:
- If rows already exist for the lender, it exits without touching the DB
- Pass `--force` to clear and re-seed: `node scripts/seed-adjustment-rules.mjs --lender everstream --force`
- Only use `--force` on new rate sheet days — not to "refresh" data that hasn't changed

**seed-fee-templates.mjs** uses upsert (ON CONFLICT DO UPDATE) — safe to run anytime, only 8 rows.

### Batch inserts, not row-by-row
Each `await sql\`INSERT...\`` is a separate HTTP round trip to Neon. At 700 rows, that's 700 connections. The adjustment rules seeder now batches 50 rows per query (~14 round trips total). Apply the same pattern to any future seed scripts.

### Use JSON files for public-facing rate display
The public rate tool reads from `src/data/parsed-rates.json` (a static file). Don't replace this with DB queries — the DB is for the MLO portal and pricing engine where you need live data. Serving rate data from a JSON file = zero DB transfer.

---

## Deployment

### Wave deploys for big features
Break large features into deployable waves:
- **Wave 1:** Schema + API (backend only, no UI changes)
- **Wave 2:** UI shell (layout, navigation, component structure)
- **Wave 3+:** Individual feature sections

Each wave should be independently deployable and not break existing functionality.

### Green deploy != working app
Vercel shows "Ready" when the build succeeds. Runtime errors (bad DB queries, missing columns, auth issues) only show up in **Vercel Logs**.

**After deploying schema changes:**
1. Go to Vercel > Project > Logs
2. Filter by "Error" in Console Level
3. Check for `PrismaClientKnownRequestError` or 500s on API routes
4. If clean, verify the affected page loads in browser

### Vercel project: netrate-mortgage-site (NEVER create a new project)
The production site deploys from the Vercel project **`netrate-mortgage-site`** — NOT `netrate-pc-ops` or any other name. This project has all env vars, the custom domain (`www.netratemortgage.com`), and the GitHub integration.

**NEVER run `vercel link --yes` or `vercel --yes` without `--project netrate-mortgage-site`.** The `--yes` flag skips the "link to existing project?" prompt and silently creates a NEW empty project, which then auto-connects to the same GitHub repo — causing duplicate builds, one of which always fails (no env vars). This happened on 2026-04-03 and caused 3 days of failed deploy noise.

**Safe commands:**
```bash
# Link this repo (only if .vercel/project.json is missing)
vercel link --yes --project netrate-mortgage-site

# Add an env var
vercel env add VAR_NAME production

# Check what project you're linked to
cat .vercel/project.json
```

**Before ANY `vercel` CLI command**, verify you're linked to the right project:
```bash
cat .vercel/project.json   # Should show projectName: netrate-mortgage-site
```

Dashboard: `https://vercel.com/bicklehoffs-projects/netrate-mortgage-site/`

---

## General

### Read before you write
Always read existing code before modifying. Understand the current state, patterns, and conventions before adding to them.

### Commit messages
Use descriptive commit messages that explain the "why":
- `Fix pipeline crash: add missing WorkDrive/Payroll columns` (good)
- `Update schema` (bad)

### Test the happy path after every deploy
After pushing changes that affect an API route or page, manually verify the affected flow works end-to-end in production. Don't assume "it worked locally" means it works on Vercel.
