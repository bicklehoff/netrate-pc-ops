#!/bin/bash
# Block direct pushes to main. All code must go through a branch + PR.
# This hook fires before any Bash command that matches "git push".

INPUT="$CLAUDE_BASH_COMMAND"

# Check if this is a push to main (explicit or implicit)
if echo "$INPUT" | grep -qE 'git push.*main|git push.*origin\s*$|git push\s*$'; then
  # Allow if pushing a branch that isn't main
  if echo "$INPUT" | grep -qE 'git push.*origin\s+[a-zA-Z]' && ! echo "$INPUT" | grep -qE 'git push.*origin\s+main'; then
    exit 0
  fi
  echo "BLOCKED: Direct push to main is not allowed."
  echo "Create a branch, push it, and open a PR instead:"
  echo "  git checkout -b feature/your-change"
  echo "  git push -u origin feature/your-change"
  echo "  gh pr create (or create PR on GitHub)"
  exit 2
fi

exit 0
