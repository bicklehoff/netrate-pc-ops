#!/usr/bin/env node
// EOD verifier. Refuses to emit a handoff git_state block unless the working
// tree is clean and the current branch is fully pushed to origin.
//
// Usage:
//   node scripts/eod-verify.mjs                 # emit block to stdout (exit 0)
//   node scripts/eod-verify.mjs --json          # emit JSON instead of fenced markdown
//
// Failure modes (exit 1, message to stderr):
//   - working tree has uncommitted or untracked files
//   - HEAD has commits not on origin/<branch>
//   - branch is detached / no upstream
//
// Output (default, fenced markdown — paste verbatim into the handoff relay):
//   ```handoff-git-state v1
//   branch:        <name>
//   head:          <sha>
//   origin_head:   <sha>          (must equal head)
//   base:          origin/main @ <sha>
//   stash_count:   <n>
//   files_changed_vs_main:
//     <git diff --stat output, indented>
//   ```
//
// The session-start verifier reads this block and refuses to proceed if any
// field drifts from current git state.

import { execSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const asJson = args.has("--json");

function git(cmd) {
  return execSync(`git ${cmd}`, { encoding: "utf8" }).trim();
}

function fail(msg) {
  process.stderr.write(`eod-verify: ${msg}\n`);
  process.exit(1);
}

// 1. Branch + upstream sanity
let branch;
try {
  branch = git("rev-parse --abbrev-ref HEAD");
} catch {
  fail("not in a git repo");
}
if (branch === "HEAD") fail("detached HEAD — checkout a branch first");
if (branch === "main") {
  fail("on main — cross-session work must live on a feature branch");
}

let upstream;
try {
  upstream = git(`rev-parse --abbrev-ref --symbolic-full-name @{u}`);
} catch {
  fail(`branch '${branch}' has no upstream — run: git push -u origin ${branch}`);
}

// 2. Working tree must be clean (no staged, unstaged, or untracked)
const status = git("status --porcelain=v1");
if (status) {
  fail(
    `working tree not clean. Commit + push ("wip:" is fine) or explicitly abandon:\n${status
      .split("\n")
      .map((l) => "  " + l)
      .join("\n")}`,
  );
}

// 3. All commits must be pushed
const unpushed = git(`log ${upstream}..HEAD --oneline`);
if (unpushed) {
  fail(
    `unpushed commits on '${branch}'. Run: git push\n${unpushed
      .split("\n")
      .map((l) => "  " + l)
      .join("\n")}`,
  );
}

// 4. Gather the block
const head = git("rev-parse HEAD");
const originHead = git(`rev-parse ${upstream}`);
if (head !== originHead) {
  fail(
    `local HEAD (${head.slice(0, 7)}) and ${upstream} (${originHead.slice(0, 7)}) diverged — sync before EOD`,
  );
}

// fetch origin/main quietly so the diff is meaningful (best-effort; offline ok)
try {
  execSync("git fetch origin main --quiet", { stdio: "ignore" });
} catch {
  /* offline — fall through and use whatever origin/main we have locally */
}

const mainSha = git("rev-parse origin/main");
const diffStat = git(`diff origin/main...HEAD --stat`) || "(no diff vs origin/main)";
let stashCount = 0;
try {
  stashCount = git("stash list").split("\n").filter(Boolean).length;
} catch {
  /* no stash storage yet */
}

const block = {
  schema: "handoff-git-state v1",
  branch,
  head,
  origin_head: originHead,
  base: { ref: "origin/main", sha: mainSha },
  stash_count: stashCount,
  files_changed_vs_main: diffStat,
};

if (asJson) {
  process.stdout.write(JSON.stringify(block, null, 2) + "\n");
} else {
  const indent = (s) =>
    s
      .split("\n")
      .map((l) => "  " + l)
      .join("\n");
  process.stdout.write(
    [
      "```handoff-git-state v1",
      `branch:        ${branch}`,
      `head:          ${head}`,
      `origin_head:   ${originHead}`,
      `base:          origin/main @ ${mainSha}`,
      `stash_count:   ${stashCount}`,
      `files_changed_vs_main:`,
      indent(diffStat),
      "```",
      "",
    ].join("\n"),
  );
}
