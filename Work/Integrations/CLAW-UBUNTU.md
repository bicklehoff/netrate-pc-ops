# Claw (Ubuntu Agent) — Reference

## What It Is

Claw is a tool running on an Ubuntu server. It handles the GCS rate pipeline — uploading rate data to Google Cloud Storage, which the website reads.

## Current Setup (Pre-Migration — Needs Update)

- **Location:** Ubuntu server, `~/netrate-mortgage-site/`
- **Git token:** `ubuntu-agent-readonly` (fine-grained PAT, read-only)
- **Token scope:** `bicklehoff/netrate-mortgage-site` only
- **Watcher script:** Copied to `~/rates/watcher.js` (runs independently of the repo)

## Required Update (Post One-Repo Migration)

Code moved from `bicklehoff/netrate-mortgage-site` to `bicklehoff/netrate-pc-ops` on Mar 2, 2026. The old repo will be archived.

**Steps to update Claw:**

1. **Update GitHub token** — Go to GitHub → Settings → Developer Settings → Fine-grained PATs → `ubuntu-agent-readonly` → add `bicklehoff/netrate-pc-ops` to repo access
2. **Re-clone or update remote:**
   ```bash
   cd ~
   git clone https://github.com/bicklehoff/netrate-pc-ops.git
   # Code is now at: ~/netrate-pc-ops/Work/Development/netrate-mortgage-site/
   ```
   Or update existing remote:
   ```bash
   cd ~/netrate-mortgage-site
   git remote set-url origin https://github.com/bicklehoff/netrate-pc-ops.git
   git pull
   # But note: paths inside the repo have changed
   ```
3. **Watcher script** (`~/rates/watcher.js`) — No update needed. It runs independently and uploads to GCS directly. Only the website's API reads from GCS.

## Key Files (New Paths in netrate-pc-ops)

- `Work/Development/netrate-mortgage-site/agent/watcher.js` — Rate watcher source
- `Work/Development/netrate-mortgage-site/src/lib/gcs.js` — GCS read (website side, has `cache: 'no-store'` fix)
- `Work/Development/netrate-mortgage-site/scripts/upload-to-gcs.js` — Upload script

## Status

Pending update — Claw still points at old repo as of Mar 2, 2026.
