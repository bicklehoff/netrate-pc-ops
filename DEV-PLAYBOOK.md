# PC Dev Playbook

Rules and patterns learned the hard way. Follow these to avoid production incidents.

---

## Database / Migrations

Prisma was removed 2026-04-23. The runtime uses raw SQL via `@neondatabase/serverless`. Schema evolution lives in `migrations/NNN_description.sql` as hand-written SQL, applied by per-migration runner scripts in `scripts/_run-migration-NNN.mjs`.

### Workflow for schema changes
1. Write hand-written SQL at `migrations/NNN_description.sql` (idempotent — use `IF NOT EXISTS`, `DROP ... IF EXISTS`, or guarded `DO $$...$$` blocks)
2. Add a runner at `scripts/_run-migration-NNN.mjs` — reads the file, splits statements, applies via `sql.query()`, runs verification queries at the end
3. Rehearse against a Neon branch if the migration touches live rows (see table below)
4. Apply to prod via the runner; commit both the SQL and runner together

### Data migrations: branch first, then apply to prod

Neon-branch rehearsal is **mandatory** when the migration can corrupt existing data — specifically, any migration with `UPDATE`/`DELETE` using value-based `WHERE` clauses, or multi-step data transforms where statement ordering matters.

Rehearsal is **optional** (skip allowed) when the migration is purely additive and cannot corrupt anything:

| Case | Rehearse? | Why |
|---|---|---|
| `UPDATE`/`DELETE` on existing table with value-based `WHERE` | ✅ mandatory | Statement ordering, type coercion, or row-shape surprises can corrupt data |
| Multi-step data transform on existing rows | ✅ mandatory | Migration 017 class — ordering bugs |
| New-column `ADD COLUMN` on existing table | ⏭ skip | Purely additive |
| `CREATE INDEX` | ⏭ skip | Read-path only |
| `ADD CONSTRAINT CHECK` with pre-verified values | ⏭ skip if pre-flighted | Fails atomically at apply-time if bad data exists; pre-flight catches it |
| `DROP COLUMN` — destructive | ✅ mandatory if the column has data | Cannot undo without PITR restore |
| New-table `CREATE TABLE IF NOT EXISTS` + seed rows with `ON CONFLICT DO NOTHING` | ⏭ skip | Cannot touch existing data; bad seed is visible immediately in the runner's verification output and trivial to fix on an otherwise-empty table |
| Empty-schema-first table | ⏭ skip | No data at all — nothing to verify |

The principle: **rehearse when the blast radius includes live rows.** Don't cargo-cult the protocol on migrations that are structurally incapable of destroying anything.

```bash
# 1. Create a rehearsal branch (uses scripts/_neon-branch.mjs — see below).
#    Stdout = connection URI. Stderr = human-readable summary.
URI=$(node scripts/_neon-branch.mjs create rehearsal-NNN-2026-MM-DD)

# 2. Run the migration against the rehearsal branch
node scripts/_run-migration-NNN.mjs --connection-string="$URI"

# 3. (Optional) Re-run to verify idempotency — should be a no-op
node scripts/_run-migration-NNN.mjs --connection-string="$URI"

# 4. Delete the rehearsal branch (refuses to delete the default branch)
node scripts/_neon-branch.mjs delete rehearsal-NNN-2026-MM-DD

# 5. Run against prod
node scripts/_run-migration-NNN.mjs
```

The runner already accepts any connection string via `--connection-string=<url>` (or `PC_DATABASE_URL` env var), so no special mode needed.

### Branch helper: `scripts/_neon-branch.mjs`

Reusable CLI for branch lifecycle. Reads `NEON_API_KEY` and `NEON_PROJECT_ID` from `.env`. The PC site project is `aged-dew-33863780` (neon-purple-xylophone, hosting `netrate_pc`). Other projects in the org: `delicate-cake-43404873` (netrate-tracker / TrackerPortal+MCP), `aged-moon-72816287` (birdy device).

```bash
node scripts/_neon-branch.mjs create <name>     # creates from default; prints URI to stdout
node scripts/_neon-branch.mjs list              # lists all branches in NEON_PROJECT_ID
node scripts/_neon-branch.mjs uri <id-or-name>  # gets URI for an existing branch
node scripts/_neon-branch.mjs delete <id-or-name>  # refuses default + protected branches
node scripts/_neon-branch.mjs list-projects     # lists all 3 PC org projects
```

The Neon account is Vercel-managed (org `org-muddy-meadow-62766825`), but personal API keys still work for branch operations against existing projects. Project creation does NOT work through the Neon API for Vercel-managed orgs — those go through Vercel.

Reference rehearsal log: `Work/Dev/audits/D9C-PR1-PHASE1-REHEARSAL-LOG-2026-04-29.md`.

**Why this matters:** Migration 017 (loan_term months→years) had a statement ordering bug — the `/12` pass ran before the outlier null, so `WHERE loan_term = 30` matched all 659 just-converted 30-year rows instead of the one Rocket Mortgage outlier. 659 rows were nulled and had to be restored manually from Neon PITR. A branch run would have shown the wrong post-run distribution immediately.

### Idempotence discipline

Every migration must be safe to replay on any state. Patterns:

- `CREATE INDEX IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `ALTER TABLE ... DROP COLUMN IF EXISTS`
- For `ADD CONSTRAINT`, pair with a preceding `DROP CONSTRAINT IF EXISTS <name>` — constraints don't have an `ADD ... IF NOT EXISTS` form
- For state-dependent operations (rename, conditional seed), wrap in a `DO $$ BEGIN IF ... THEN ... END IF; END $$` block
- `INSERT ... SELECT ... WHERE NOT EXISTS (...)` for idempotent seeds

Re-running an applied migration must be a no-op, not a failure.

### Statement splitting (for runner scripts)

Neon's `sql.query()` takes one statement at a time. The runner splits the SQL file into statements. Two gotchas:

- **Dollar-quoted blocks** (`DO $tag$ ... $tag$;`) contain semicolons that must NOT split. Track tag depth.
- **BEGIN / COMMIT** inside migration files should be filtered out — Neon handles per-statement transactions; an explicit `BEGIN;` at the top followed by `sql.query('BEGIN')` as a standalone call throws.

See `scripts/_run-db-foundation-bundle.mjs` for a reference splitter that handles both.

---

## Neon DB Usage (Keep Transfer Low)

Neon serverless billing includes **network transfer**. The free tier is 5 GB/month — easy to blow through on a heavy seeding day. Patterns that burn transfer:

### Always use the pooled connection string
`PC_DATABASE_URL` must point to the `-pooler.` URL (PgBouncer), not the direct endpoint. PgBouncer reuses connections; the direct URL opens a new TCP connection per query.
- Pooled: `ep-plain-math-aixa3lmr-pooler.c-4.us-east-1.aws.neon.tech`
- Direct (migrations only): `ep-plain-math-aixa3lmr.c-4.us-east-1.aws.neon.tech`

Use the direct endpoint for migration runners (no pooling, straight connection). Use pooled for everything else — app routes, cron jobs, seed scripts.

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
3. Check for 500s on API routes or Postgres errors (`syntax error`, `column does not exist`)
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
