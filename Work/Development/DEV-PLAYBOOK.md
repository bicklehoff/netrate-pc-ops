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

### Vercel dashboard URL
The team slug is `bicklehoffs-projects` (not `bicklehoff`):
`https://vercel.com/bicklehoffs-projects/netrate-mortgage-site/`

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
