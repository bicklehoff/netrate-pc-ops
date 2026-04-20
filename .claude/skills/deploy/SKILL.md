---
name: deploy
description: "Interactive deploy checklist for NetRate Mortgage website (Vercel). Enforces a gate-disciplined workflow where each phase (build, push, PR, preview, merge, production confirm) requires explicit go-ahead from David before proceeding. Use this skill whenever the user says 'deploy', 'merge', 'push', 'PR', 'build', 'ready to push', 'create a PR', 'push and PR', 'build and push', or any phrase related to deploying code changes. Also trigger when the user approves a plan and the next step is shipping code. Do NOT skip this skill for deploys — even simple one-line changes go through the full checklist."
---

# Deploy Skill — NetRate Mortgage PC

This skill enforces the deploy procedure as an interactive gate-enforced checklist. Every deploy follows the same disciplined sequence: **branch → build → push → PR → preview → merge → confirm production**. Each gate requires David's explicit go-ahead before proceeding.

The reason for this rigidity is that the NetRate website is a live customer-facing mortgage rate tool. A bad deploy means borrowers see wrong rates, broken calculators, or a down site. The gates exist because catching issues at each stage is dramatically cheaper than catching them in production.

## Gate -1: Deploy Lock (Concurrent Session Safety)

Before entering the deploy pipeline, check whether another session is already deploying:

```bash
if [ -f .claude/deploy.lock ]; then cat .claude/deploy.lock; fi
```

- **If the lock file exists:** Read it and report to David: "Deploy lock held by branch `<X>` since `<timestamp>`. Another session is deploying — cannot proceed." **Do not continue.**
- **If the lock file does NOT exist:** Create it:

```bash
echo "branch=$(git branch --show-current)" > .claude/deploy.lock
echo "started=$(date -Iseconds)" >> .claude/deploy.lock
```

- **After deploy completes (Gate 6 success) or is aborted:** Delete the lock:

```bash
rm -f .claude/deploy.lock
```

- **Stale locks:** If the timestamp is more than 2 hours old, ask David whether to clear it (the original session may have crashed).

### Worktree Session Limits

If your CWD contains `.claude/worktrees/`, you are in a worktree session. You may execute Gates 0-4 (build, push, PR, preview). **Gates 5-6 (merge, production confirm) must happen from the main session or GitHub UI.** This prevents worktrees from needing `git checkout main`, which would corrupt the isolation. After Gate 4 (preview confirmed), tell David: "Ready to merge — switch to the main session or merge on GitHub."

## Pre-flight

Before any code changes, establish a clean starting point:

```bash
git status
git checkout main && git pull
git checkout -b <type>/<description>
```

Branch types: `fix/` for bug fixes, `feature/` for new features, `docs/` for documentation.

**Never branch from an unmerged branch** — this silently inherits uncommitted work and causes cross-session confusion.

Then check the knowledge layer for known deploy issues:

```
search_thoughts(query="deploy-issue", limit=10)
```

If recurring issues surface (e.g., a known flaky import), mention them to David before starting.

## Gate 0: Branch Verification (MANDATORY before every gate)

**Before EVERY commit, push, or PR command**, run:

```bash
git branch --show-current
```

Compare the output to the branch you intend to be on. If they don't match, **STOP — do not proceed.** Fix the branch situation before continuing. This catches silent rebases, hook-triggered branch switches, and sessions that lose track during long editing runs.

This is not optional. This is not "check if you feel like it." This is a hard gate that fires before Gate 1, Gate 2, and Gate 3. Every time. Even if you just checked 30 seconds ago.

**After every push**, verify the commit landed on the correct remote branch:

```bash
git log --oneline origin/<branch> -3
```

Confirm the top commit hash and message match what you just pushed. If they don't, the push went to the wrong place.

## Gate 1: Build

After code changes are complete, present a summary of everything that changed. Then **stop and wait** for David to say **"build"** before running anything.

**Run Gate 0 (branch verification) first.** Then determine which lane applies (see §1.1).

### 1.1 — Lane detection (build-affecting vs docs-only)

Not every change exercises the Next.js build. Markdown docs under `Work/**`, `docs/**`, `.claude/**`, or root `*.md` never reach Vercel's bundler, so rebuilding `src/` locally just recompiles unchanged code. This is wasteful and adds noise. Detect the lane once, before building:

```bash
# Files changed vs origin/main (includes staged, unstaged, untracked)
CHANGED=$( ( git diff --name-only origin/main -- ; git ls-files --others --exclude-standard ) | sort -u )
echo "$CHANGED"

# Does ANY changed file live in a build-affecting path?
BUILD_AFFECTING=$(echo "$CHANGED" | grep -E '^(src/|prisma/|public/|scripts/|package\.json$|package-lock\.json$|next\.config\.|tailwind\.config\.|postcss\.config\.|jsconfig\.json$|tsconfig\.json$|vercel\.json$|middleware\.|\.env($|\.))' || true)

if [ -z "$BUILD_AFFECTING" ]; then
  echo "LANE: docs-only — skipping local build. Vercel preview is the gate."
else
  echo "LANE: build-affecting — running full build."
  echo "$BUILD_AFFECTING"
fi
```

**Build-affecting paths** (full build required):
- `src/**`, `prisma/**`, `public/**`, `scripts/**`
- `package.json`, `package-lock.json`
- `next.config.*`, `tailwind.config.*`, `postcss.config.*`, `jsconfig.json`, `tsconfig.json`, `vercel.json`
- `middleware.*`, `.env*` (root)

**Docs-only paths** (build skipped):
- `Work/**`, `docs/**`, `.claude/**`, `.github/**`
- Root `*.md` (README, CLAUDE.md, REGISTRY.md, etc.)
- `.gitignore`, anything not in the build-affecting list above

When in doubt, treat as build-affecting. Running `npm run build` on a docs-only PR is only wasted minutes; skipping build on a code PR can ship a regression.

### 1.2 — Build-affecting lane

```bash
npm run build
```

**Zero ESLint errors required.** Warnings are OK — errors block Vercel. Review the output together.

Common build killers (ESLint errors that block Vercel):
- Unused imports (`'X' is defined but never used`) → remove the import
- Conditional hooks (`React Hook called conditionally`) → move hooks before any early return
- Missing useEffect dependencies → add to dependency array or suppress with `eslint-disable-next-line`

If the build fails, fix and repeat from `npm run build`. Don't move forward until it's clean.

### 1.3 — Docs-only lane

Skip `npm run build`. State explicitly to David: *"Docs-only change — skipping local build. Vercel preview (Gate 4) is the gate."* Note "docs-only" in the eventual PR body so reviewers see why there's no build artifact.

Do NOT use this lane if ANY file in the diff lands in a build-affecting path, even if the other files are docs. Mixed PRs always take the build-affecting lane.

### 1.4 — Final sanity check (both lanes)

```bash
git diff origin/main --stat
# plus, if there are untracked files you intend to commit:
git status --short
```

Show David the changed files as a final sanity check.

## Gate 2: Push

**Stop and wait** for David to say **"push"**.

**Run Gate 0 (branch verification) first.** Then:

```bash
BRANCH=$(git branch --show-current)
echo "Pushing branch: $BRANCH"
git push -u origin "$BRANCH"
```

**After push, verify:**

```bash
git log --oneline "origin/$BRANCH" -3
```

Confirm the top commit is yours. If it isn't, the push went wrong.

## Gate 3: PR

**Stop and wait** for David to say **"PR"**.

**Run Gate 0 (branch verification) first.** Then:

```bash
"/c/Program Files/GitHub CLI/gh.exe" pr create --title "[pc] your-title-here" --body "$(cat <<'EOF'
## Summary
<bullet points>

## Test plan
<checklist>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Then prepend the PR number to the title (makes it visible in Vercel's deployment list since squash merge uses PR title as commit message):

```bash
PR_NUM=$("/c/Program Files/GitHub CLI/gh.exe" pr view --json number -q .number)
"/c/Program Files/GitHub CLI/gh.exe" pr edit --title "#${PR_NUM} [pc] your-title-here"
```

Post the PR URL for David to review on GitHub.

## Gate 4: Vercel Preview

Wait for the Vercel preview build. Poll every 30 seconds:

```bash
"/c/Program Files/GitHub CLI/gh.exe" pr checks
```

If preview **fails**: pull the full Vercel logs from the **specific deployment URL** (not the project name). No `--limit` truncation — read the entire output. Trace the first ERROR line to its source file before touching any code.

Fix on the branch, push again. **Never merge until the preview is green.**

If preview passes, tell David and wait for confirmation that the preview looks good.

## Gate 5: Merge

**Stop and wait** for David to say **"merge"**.

First, confirm the Vercel project is correct:

```bash
cat .vercel/project.json
```

The project must be `netrate-mortgage-site`. If it's anything else, **stop immediately** — something is wrong.

Then merge:

```bash
"/c/Program Files/GitHub CLI/gh.exe" pr merge --squash
```

## Gate 6: Production Confirmation

After merge, monitor the production deployment:

```bash
npx vercel ls netrate-mortgage-site | head -5
```

Poll until the status shows **"Ready"** or **"Error"**.

- **Ready** → deployed successfully. Verify the change is live if applicable.
- **Error** → pull full production logs from the specific deployment URL. Open a hotfix branch from main immediately.

**Never declare work "deployed" from git state alone.** Finding commits upstream ≠ successful Vercel build. Always verify `vercel ls` shows "Ready".

After confirming production, switch back to main:

```bash
git checkout main && git pull
```

## MCP Feedback Loop

On **any blocker** during deploy (build failure, preview failure, production error):

```
capture_thought(
  category="fact",
  content="Deploy issue: PR #N — [error description] — [fix applied]",
  source="pc-dev",
  topics=["deploy", "build-error"]
)
```

This builds a knowledge base that the pre-flight `search_thoughts` check surfaces in future deploys.

### Self-Updating

After logging an issue, search for similar past issues:

```
search_thoughts(query="[error pattern]", topics=["deploy"])
```

If the same error appears **3 or more times**, add it to the "Common build killers" list in this skill file. Tell David you've updated the skill.

## Hard Stops

These are non-negotiable. Never skip them, even if David asks:

- **No build, push, or PR without David's explicit go-ahead** at each gate
- **Run `git branch --show-current` before every commit, push, and PR** — Gate 0 is not optional
- **Verify `git log --oneline origin/<branch> -3` after every push** — confirm the commit landed where you think
- **Never push directly to main** — branch protection will reject it anyway
- **Never branch from an unmerged branch** — always cut from main
- **Never merge on a failing PR check**
- **Never declare deployed from git state alone** — verify `vercel ls` shows "Ready"
- **Never run `vercel link` without `--project netrate-mortgage-site`**
- **Never create a new Vercel project** — the project is `netrate-mortgage-site`

## Quick Reference

| Phase | Gate Word | Command | Success Criteria |
|-------|-----------|---------|-----------------|
| Pre-flight | (auto) | `git status`, branch from main | Clean working tree |
| **Gate 0** | **(auto)** | **`git branch --show-current`** | **Branch matches intent** |
| Build (build-affecting) | "build" | Gate 0 → lane check → `npm run build` | Zero ESLint errors |
| Build (docs-only) | "build" | Gate 0 → lane check → **skip build** | Lane is docs-only; Vercel preview gates merge |
| Push | "push" | Gate 0 → `git push -u origin $BRANCH` → verify `git log origin/$BRANCH` | Commit on correct remote |
| PR | "PR" | Gate 0 → `gh pr create` + prepend #N | PR URL posted |
| Preview | (auto) | `gh pr checks` poll | All checks pass |
| Merge | "merge" | `gh pr merge --squash` | Merged to main |
| Production | (auto) | `vercel ls` poll | Status = "Ready" |
| Log & Learn | (auto) | `capture_thought` on blockers | Issue captured |

## PC-Specific Details

- **gh CLI**: `"/c/Program Files/GitHub CLI/gh.exe"` (not in bash PATH)
- **Vercel project**: `netrate-mortgage-site`
- **MCP source**: `pc-dev`
- **Branch naming**: `fix/`, `feature/`, `docs/`
- **Commit co-author**: `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`
