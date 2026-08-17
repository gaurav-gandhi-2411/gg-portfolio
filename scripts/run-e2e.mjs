#!/usr/bin/env node
// Runs the Playwright suite and makes its real status the last thing on stdout
// and the code this process exits with.
//
// Why this exists: a run that reported 15 failures was read as green, because
// the shell chain around it ended in `tail` and returned tail's status rather
// than Playwright's. Playwright had said so plainly, 500 lines up, in a line
// nobody re-reads. That is the same shape as every scoped-by-convention gate
// in CHECKS.md: the number was printed and not read.
//
// So the contract here is narrow. The banner is last, it names the counts and
// the exit code together, and it says FAILED in a form that survives a `tail`.
// Anything this cannot determine is a failure, never a pass: an unparseable
// summary with a zero exit still exits non-zero, because "the suite passed"
// and "I could not tell what the suite did" must not look the same.
//
// Arguments pass straight through: node scripts/run-e2e.mjs e2e/nav.spec.ts --project=desktop

import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const chunks = [];

const child = spawn("npx", ["playwright", "test", ...args], {
  shell: process.platform === "win32",
  stdio: ["inherit", "pipe", "pipe"],
});

for (const stream of [child.stdout, child.stderr]) {
  stream.on("data", (d) => {
    chunks.push(d);
    process.stdout.write(d);
  });
}

child.on("error", (err) => {
  banner(null, `could not start playwright: ${err.message}`);
  process.exit(1);
});

child.on("close", (code) => {
  const out = Buffer.concat(chunks).toString("utf8");
  const counts = {};
  for (const [, n, label] of out.matchAll(/^\s+(\d+)\s+(passed|failed|skipped|flaky|did not run|interrupted)\b/gm)) {
    counts[label] = (counts[label] ?? 0) + Number(n);
  }

  const summary = Object.entries(counts)
    .map(([label, n]) => `${n} ${label}`)
    .join(", ");

  // A run that produced no recognisable summary is not a passing run, whatever
  // it exited with. Same for one that reports work it never got to.
  if (Object.keys(counts).length === 0) {
    banner(code, "no test summary found in output, so this run proves nothing");
    process.exit(code === 0 ? 1 : code);
  }
  if (counts["did not run"] || counts.interrupted) {
    banner(code, `${summary} -- the run stopped early, so the untested part is unknown`);
    process.exit(code === 0 ? 1 : code);
  }

  banner(code, summary);
  process.exit(code ?? 1);
});

function banner(code, detail) {
  const status = code === 0 ? "PASSED" : "FAILED";
  const line = "=".repeat(72);
  process.stdout.write(`\n${line}\ne2e ${status}  exit=${code ?? "unknown"}  ${detail}\n${line}\n`);
}
