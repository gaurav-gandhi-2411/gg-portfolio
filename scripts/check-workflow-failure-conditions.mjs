#!/usr/bin/env node
// Fails if any .github/workflows/*.yml `if:` compares a step's outcome/
// conclusion (or a job's needs.<job>.result) against 'failure' without a
// failure()/always()/cancelled() call in the same expression.
//
// WHY THIS EXISTS — see scripts/lib/workflow-failure-conditions.mjs's header
// for the incident (chat-canary.yml's two alerting steps silently skipped on
// every real probe failure since 2026-09-23, PR #196). GitHub Actions
// implicitly prepends `success() &&` to any `if:` that doesn't itself
// reference a status-check function, so a condition written to fire ON
// failure — with no failure()/always()/cancelled() in it — instead fires only
// when nothing has failed yet, which for an alerting step means never. This
// caught that exact shape in chat-canary.yml before the fix in this same PR,
// and stays wired into ci.yml so the shape can't come back unnoticed the way
// PR #196 reintroduced it once already.
//
// Zero dependencies, no YAML library — the parsing this needs (find `if:`
// lines, including `if: >`/`if: |` block scalars) is simple enough that a
// regex line-scan is the boring, correct choice, same posture as
// check-eval-trigger-covers-index-sources.mjs's workflowFilters().
//
// Run: node scripts/check-workflow-failure-conditions.mjs

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { findViolations } from "./lib/workflow-failure-conditions.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WORKFLOWS_DIR = join(ROOT, ".github", "workflows");

const files = readdirSync(WORKFLOWS_DIR).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));

console.log(`Checking ${files.length} workflow file(s) in .github/workflows/ for 'if:' ` +
  "conditions that compare an outcome/conclusion/result to 'failure' without a " +
  "failure()/always()/cancelled() call.\n");

const allViolations = [];
for (const file of files.sort()) {
  const fullPath = join(WORKFLOWS_DIR, file);
  const content = readFileSync(fullPath, "utf8");
  const repoRelative = relative(ROOT, fullPath).replace(/\\/g, "/");
  const violations = findViolations(content, repoRelative);
  for (const v of violations) allViolations.push(v);
}

if (allViolations.length > 0) {
  console.error(
    `FAIL — ${allViolations.length} condition(s) will implicitly get \`success() &&\` prepended ` +
      "by GitHub Actions, so they can never fire once the thing they check for failure has " +
      "actually failed:\n" +
      allViolations.map((v) => `  ${v.file}:${v.line}: if: ${v.expr}`).join("\n") +
      "\n\nAdd failure() (or always()/cancelled() if the step must also run on cancellation) " +
      "to each expression above, e.g. `if: failure() && steps.x.outcome == 'failure'`."
  );
  process.exit(1);
}

console.log(`PASS — no unreachable failure-alerting conditions found across ${files.length} workflow file(s).`);
