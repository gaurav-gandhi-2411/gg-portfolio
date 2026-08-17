#!/usr/bin/env node
// Every homepage headline stat must point at a bullet that exists in the role
// ladder, and that bullet must still contain the number the stat displays.
//
// WHY THIS EXISTS: content/stats.ts renders three figures from paid work.
// They are the only numbers on the homepage a reader cannot verify by
// clicking something, which makes them the only ones where a quiet drift
// costs credibility rather than a broken link. The failure mode is not
// malice, it is ordinary editing: the resume bullet gets rewritten, "$10M+"
// becomes "$12M+" in one file, and the other keeps saying the old thing
// forever because nothing compares them.
//
// Two assertions, deliberately separate:
//
//   1. the sourceRef resolves to a real bullet in content/experience.ts.
//      Catches a ref that was renamed or deleted.
//   2. the digits in the stat's `value` appear in that bullet's text.
//      Catches the ref still resolving while the two numbers have diverged,
//      which assertion 1 cannot see and is the more likely of the two.
//
// Assertion 2 compares digits only, not the display string: the bullet says
// "Automated roughly 70%" and the stat says "~70%", which are the same claim
// in two registers. Comparing "70" against the bullet is the strongest check
// that does not force the two to be written identically. This is the same
// reasoning as CHECKS.md instance 1: a check that asserts something weaker
// than it appears to (the value merely appearing SOMEWHERE in the file) is
// worse than no check, so this scopes the search to the referenced bullet.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STATS_PATH = path.join(ROOT, "content", "stats.ts");
const EXPERIENCE_PATH = path.join(ROOT, "content", "experience.ts");

const statsSrc = readFileSync(STATS_PATH, "utf8");
const experienceSrc = readFileSync(EXPERIENCE_PATH, "utf8");

// Each stat is a { value, label, sourceRef } object literal.
const stats = [...statsSrc.matchAll(/\{\s*value:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*sourceRef:\s*"([^"]+)",?\s*\}/g)].map(
  (m) => ({ value: m[1], label: m[2], sourceRef: m[3] })
);

// Fail closed rather than passing an empty set: a parser that silently matches
// nothing is the exact shape this repo keeps writing down (CHECKS.md).
// `sourceRef: "` with the quote, not a bare `sourceRef:`. The bare form also
// matches the field in the HeadlineStat type declaration above the data,
// which made the first run of this check report 3 parsed against 4 declared
// and fail on itself. It failing closed rather than passing is the only
// reason that was a two-minute fix.
const declaredCount = (statsSrc.match(/sourceRef:\s*"/g) ?? []).length;
if (stats.length === 0 || stats.length !== declaredCount) {
  console.error(
    `check-stats-attribution: parsed ${stats.length} stat(s) but content/stats.ts declares ` +
      `${declaredCount} sourceRef(s) — the parser is out of step with the file, not the file with itself.`
  );
  process.exit(1);
}

// Bullets are { text: "...", sourceRef: "..." } in content/experience.ts.
const bullets = new Map(
  [...experienceSrc.matchAll(/text:\s*"((?:[^"\\]|\\.)*)",\s*\n\s*sourceRef:\s*"([^"]+)"/g)].map((m) => [
    m[2],
    m[1],
  ])
);

if (bullets.size === 0) {
  console.error("check-stats-attribution: parsed 0 bullets from content/experience.ts — parser broken?");
  process.exit(1);
}

console.log(
  `check-stats-attribution: ${stats.length} headline stat(s) against ${bullets.size} role-ladder bullet(s)\n`
);

const failures = [];
for (const stat of stats) {
  const bullet = bullets.get(stat.sourceRef);
  if (!bullet) {
    failures.push(`${stat.value}: sourceRef "${stat.sourceRef}" is not a bullet in content/experience.ts`);
    console.log(`  [FAIL] ${stat.value.padEnd(8)} ${stat.sourceRef}  (ref not found)`);
    continue;
  }
  const digits = stat.value.replace(/[^0-9]/g, "");
  if (digits.length === 0) {
    failures.push(`${stat.value}: no digits to check, so this stat cannot be tied to its bullet`);
    console.log(`  [FAIL] ${stat.value.padEnd(8)} ${stat.sourceRef}  (no digits)`);
    continue;
  }
  if (!bullet.replace(/[^0-9]/g, "").includes(digits)) {
    failures.push(
      `${stat.value}: the digits "${digits}" do not appear in the bullet it cites (${stat.sourceRef})`
    );
    console.log(`  [FAIL] ${stat.value.padEnd(8)} ${stat.sourceRef}  (value not in bullet)`);
    continue;
  }
  console.log(`  [ok]   ${stat.value.padEnd(8)} ${stat.sourceRef}`);
}

if (failures.length > 0) {
  console.error(`\nFAIL: ${failures.length} stat(s) are not backed by the bullet they cite:\n`);
  for (const f of failures) console.error(`  - ${f}`);
  console.error(
    "\nEither the role ladder changed and the stat did not, or the stat was edited on its own. " +
      "Both files state the same fact and both have to say it."
  );
  process.exit(1);
}

console.log(`\nOK: all ${stats.length} headline stat(s) trace to a role-ladder bullet that still contains them.`);
