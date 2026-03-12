#!/bin/bash
# NetRate PC — Root SessionStart Hook
# For Setup and Auditor sessions launched from repo root.
# Injects SESSION-LOG and git context. No REGISTRY (not a dev codebase).

echo "=============================================="
echo "  NETRATE PC — SESSION STARTUP CONTEXT"
echo "=============================================="
echo ""
echo "You MUST run get_briefing(device='pc', department=<yours>) and check_relay(device='pc') before responding to David."
echo ""

# --- SESSION-LOG (recent work) ---
SESSION_LOG="$(dirname "$0")/../../Work/SESSION-LOG.md"
if [ -f "$SESSION_LOG" ]; then
  echo "=== SESSION-LOG.md (last 30 lines) ==="
  tail -30 "$SESSION_LOG"
  echo ""
else
  echo "=== SESSION-LOG.md not found ==="
  echo ""
fi

# --- Git log (recent commits) ---
REPO_DIR="$(dirname "$0")/../.."
if git -C "$REPO_DIR" rev-parse --git-dir >/dev/null 2>&1; then
  echo "=== Recent commits (git log -5) ==="
  git -C "$REPO_DIR" log --oneline -5 2>/dev/null || echo "(git log failed)"
  echo ""
  echo "=== Uncommitted changes (git status) ==="
  git -C "$REPO_DIR" status --short 2>/dev/null || echo "(git status failed)"
  echo ""
fi

echo "=============================================="
echo "  CONTEXT LOADED. Now run MCP steps:"
echo "  1. get_briefing(device='pc', department=<yours>)"
echo "  2. check_relay(device='pc')"
echo "  3. get_recent_sessions(device='pc', since=today)"
echo "  Then summarize findings to David."
echo "=============================================="
