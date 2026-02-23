#!/bin/bash
# PreToolUse hook: blocks direct writes to protected data directories.
#
# CURRENTLY DORMANT — PC has no local trackers yet.
# When PC gets its own protected data (borrower portal), replace
# __TRACKER_PATH__ with the actual directory pattern.
#
# Who sets the flag:
#   - Clerk subagent: touch /tmp/.tracker-write-authorized (status updates)
#   - Admin sessions: touch /tmp/.tracker-write-authorized (content changes)
#   - Dev/WebDev/Products/Integrations: NEVER.
#
# Input: JSON on stdin from Claude Code (contains tool_input with file_path)
# Output: JSON with permissionDecision (allow/deny) or nothing (allow)

INPUT=$(cat)

# Extract file path from tool input
FILE_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    inp = data.get('tool_input', data)
    print(inp.get('file_path', inp.get('path', '')))
except:
    print('')
" 2>/dev/null)

# If no file path found, allow (not a file write)
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Resolve relative paths
if [[ ! "$FILE_PATH" = /* ]]; then
  FILE_PATH="$(pwd)/$FILE_PATH"
fi

# Check if the file is inside a protected data directory
# CUSTOMIZE: Replace __TRACKER_PATH__ with your actual data path when activated
if [[ "$FILE_PATH" == *"__TRACKER_PATH__"* ]]; then
  # If an authorized writer flag exists, allow
  if [ -f /tmp/.tracker-write-authorized ]; then
    exit 0
  fi

  # Otherwise block
  cat <<'DENY'
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "BLOCKED: Direct write to protected data. Trigger the Clerk for status updates, or set the write flag if you are Admin."
  }
}
DENY
  exit 0
fi

# Allow all other writes
exit 0
