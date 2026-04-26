#!/bin/bash
# NetRate PC — SessionEnd Hook: warn loudly if session ends with uncommitted work.
#
# Why this exists: a Tier-3 build (ResiCentral DSCR parser, ~35% complete with
# inventory + utilities + tests) was lost on 2026-04-26 because the prior session
# left work uncommitted in a worktree, and the worktree was pruned between sessions.
# Untracked/uncommitted files do not survive `git worktree remove` or manual
# directory deletion. This hook makes the risk visible at session-end so the
# operator can WIP-commit, stash, or explicitly note abandonment before exiting.
#
# Pairs with a governance change to GOVERNANCE.md §SHP Session Close step 3.

REPO_DIR="$(git rev-parse --show-toplevel 2>/dev/null)"
[ -z "$REPO_DIR" ] && exit 0

GIT_DIR="$(git rev-parse --git-dir 2>/dev/null)"
IS_WORKTREE=0
case "$GIT_DIR" in
  *.git/worktrees/*) IS_WORKTREE=1 ;;
esac

DIRTY="$(git -C "$REPO_DIR" status --porcelain -uall 2>/dev/null)"
[ -z "$DIRTY" ] && exit 0

BRANCH="$(git -C "$REPO_DIR" branch --show-current 2>/dev/null)"
[ -z "$BRANCH" ] && BRANCH="(detached)"
CTX="main checkout"
[ "$IS_WORKTREE" = "1" ] && CTX="WORKTREE"
FILE_COUNT=$(echo "$DIRTY" | grep -c .)

echo ""
echo "============================================================"
echo "  WARNING — SESSION ENDING WITH UNCOMMITTED WORK"
echo "============================================================"
echo "  Branch:    $BRANCH"
echo "  Context:   $CTX"
echo "  Path:      $REPO_DIR"
echo "  Dirty:     $FILE_COUNT file(s)"
echo ""
echo "  Uncommitted/untracked files:"
echo "$DIRTY" | sed 's/^/    /'
echo ""
if [ "$IS_WORKTREE" = "1" ]; then
  echo "  CRITICAL: This is a WORKTREE. If the worktree is removed"
  echo "  before this work is committed or stashed, IT WILL BE LOST."
  echo "  (Lesson from 2026-04-26 ResiCentral incident.)"
  echo ""
  echo "  Recovery options:"
  echo "    1. WIP commit:  git add -A && git commit -m 'wip: <reason>' && git push"
  echo "    2. Stash:       git stash push -u -m 'session-end <date>'"
  echo "                    (stash lives in shared .git/, survives worktree removal)"
  echo "    3. Note in EOD relay: 'uncommitted work being abandoned: <files>'"
  echo "       (only acceptable when the work is genuinely disposable)"
fi
echo "============================================================"

# Audit log: append timestamped record so future sessions can see the history.
LOG_FILE="$REPO_DIR/.claude/session-end-dirty.log"
TIMESTAMP=$(date -Iseconds 2>/dev/null || date)
echo "$TIMESTAMP | $CTX | branch=$BRANCH | path=$REPO_DIR | dirty_files=$FILE_COUNT" >> "$LOG_FILE"

exit 0
