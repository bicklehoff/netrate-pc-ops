#!/usr/bin/env node
// Session-start verifier. Reads a `handoff-git-state v1` block (from the prior
// session's relay) and refuses to proceed if the current git state diverges.
//
// Usage:
//   # Paste the fenced block (or just the inner lines) on stdin:
//   cat /tmp/last-handoff.txt | node scripts/session-start-verify.mjs
//
//   # Or pass a file:
//   node scripts/session-start-verify.mjs path/to/handoff.txt
//
// Exit codes:
//   0  — all referenced state matches reality (safe to act on the handoff)
//   1  — drift detected; details on stderr (do NOT trust the handoff blindly)
//   2  — bad input (no parseable block)
//
// Drift policy:
//   - branch missing locally          → fail (worktree may have been cleaned)
//   - origin_head moved               → fail (someone pushed since handoff)
//   - stash_count differs             → warn only (stash drops/adds happen)
//   - files_changed_vs_main differs   → fail (rebase or new merges shifted base)
//
// This is the read-side of eod-verify.mjs. Both must change together.

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

function readInput() {
  const file = process.argv[2];
  if (file) return readFileSync(file, "utf8");
  return readFileSync(0, "utf8"); // stdin
}

function parse(raw) {
  // Strip the markdown fence if present.
  const body = raw
    .replace(/^```handoff-git-state v1\s*\n/m, "")
    .replace(/\n```\s*$/m, "");
  const out = {};
  let inFiles = false;
  const fileLines = [];
  for (const line of body.split("\n")) {
    if (inFiles) {
      if (line.startsWith("  ")) {
        fileLines.push(line.slice(2));
        continue;
      }
      inFiles = false;
    }
    const m = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!m) continue;
    const [, key, val] = m;
    if (key === "files_changed_vs_main") {
      inFiles = true;
      continue;
    }
    out[key] = val;
  }
  out.files_changed_vs_main = fileLines.join("\n").trim();
  return out;
}

function fail(msg) {
  process.stderr.write(`session-start-verify: ${msg}\n`);
  process.exit(1);
}

let raw;
try {
  raw = readInput();
} catch (e) {
  process.stderr.write(`session-start-verify: cannot read input (${e.message})\n`);
  process.exit(2);
}

const expected = parse(raw);
if (!expected.branch || !expected.head || !expected.origin_head) {
  process.stderr.write(
    "session-start-verify: input missing required fields (branch, head, origin_head)\n",
  );
  process.exit(2);
}

// Best-effort fetch so origin refs are current.
try {
  execSync(`git fetch origin ${expected.branch} main --quiet`, { stdio: "ignore" });
} catch {
  /* offline ok */
}

const drift = [];

// 1. Branch must exist somewhere reachable (local OR remote).
const localExists = git(`rev-parse --verify --quiet refs/heads/${expected.branch}`);
const remoteExists = git(`rev-parse --verify --quiet refs/remotes/origin/${expected.branch}`);
if (!localExists && !remoteExists) {
  drift.push(`branch '${expected.branch}' no longer exists locally OR on origin`);
}

// 2. origin_head must still match. If it moved, someone pushed since EOD —
//    next session must NOT assume the handoff describes current state.
if (remoteExists) {
  const currentOrigin = git(`rev-parse origin/${expected.branch}`);
  if (currentOrigin && currentOrigin !== expected.origin_head) {
    drift.push(
      `origin/${expected.branch} moved: handoff said ${expected.origin_head.slice(0, 7)}, now ${currentOrigin.slice(0, 7)}`,
    );
  }
}

// 3. Diff stat vs origin/main — recompute and compare.
const currentDiff =
  git(`diff origin/main...origin/${expected.branch} --stat`) ||
  git(`diff origin/main...${expected.branch} --stat`) ||
  "";
const norm = (s) => s.replace(/\s+/g, " ").trim();
if (norm(currentDiff) !== norm(expected.files_changed_vs_main)) {
  drift.push(
    `files_changed_vs_main differs from handoff:\n  HANDOFF:\n${indent(expected.files_changed_vs_main)}\n  NOW:\n${indent(currentDiff || "(empty)")}`,
  );
}

// 4. Stash count — warn only.
const currentStashCount = (git("stash list") || "").split("\n").filter(Boolean).length;
if (String(currentStashCount) !== String(expected.stash_count)) {
  process.stderr.write(
    `session-start-verify: warning — stash_count differs (handoff ${expected.stash_count}, now ${currentStashCount})\n`,
  );
}

function indent(s) {
  return s
    .split("\n")
    .map((l) => "    " + l)
    .join("\n");
}

if (drift.length) {
  process.stderr.write(
    `session-start-verify: HANDOFF DOES NOT MATCH REALITY — do not act on it.\n\n` +
      drift.map((d) => "- " + d).join("\n") +
      "\n\nRecover by reading the source-of-truth git state directly:\n" +
      `  git log origin/main..origin/${expected.branch} --stat\n`,
  );
  process.exit(1);
}

process.stdout.write(
  `session-start-verify: ok (branch=${expected.branch}, head=${expected.head.slice(0, 7)})\n`,
);
