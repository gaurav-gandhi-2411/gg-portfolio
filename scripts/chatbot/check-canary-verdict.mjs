#!/usr/bin/env node
// Thin CLI wrapper around canary-verdict.mjs's computeVerdict(): reads the
// /api/chat response body from stdin, prints the verdict, exits 0 or 1.
// Called from .github/workflows/chat-canary.yml as
// `echo "$BODY" | node scripts/chatbot/check-canary-verdict.mjs`.
//
// All of the actual logic lives in canary-verdict.mjs, specifically so it
// can be called directly from canary-verdict.smoketest.mjs without shelling
// out -- see that module's header for why this split exists.

import { computeVerdict } from "./canary-verdict.mjs";

let body = "";
process.stdin.on("data", (chunk) => (body += chunk));
process.stdin.on("end", () => {
  const verdict = computeVerdict(body);
  for (const line of verdict.stdout) console.log(line);
  for (const line of verdict.stderr) console.error(line);
  process.exit(verdict.exitCode);
});
