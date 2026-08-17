#!/usr/bin/env node
// No em dash character in anything a visitor reads.
//
// WHY THIS EXISTS: it is a standing copy rule, and it is the kind of rule that
// cannot be held by intention. An em dash arrives one sentence at a time, in a
// file nobody is looking at, months after the rule was agreed. Every prior
// sweep was a grep somebody remembered to run.
//
// SCOPE, stated rather than implied, because a check that quietly covers less
// than its name is this repo's most-repeated defect (CHECKS.md):
//
//   covered: string literals and JSX text in components/**/*.tsx, and string
//            literals in content/**/*.ts. That is what renders.
//
//   NOT covered: code comments, docs/**, reports/**, PLAN.md, CHECKS.md,
//            spec*.md, README.md, and this file. Those are written for people
//            working on the repo, not for visitors, and the rule is about the
//            site's voice. content/provenance.md and content/*.json are
//            excluded for a different and worse reason, recorded below.
//
// KNOWN GAP: content/provenance.md, content/metrics.json and
// content/resume-data.json DO render (provenance panels, metric values, the
// resume page) and DO contain em dashes. They are excluded here because their
// content is quoted source material, and rewriting a quoted source to satisfy
// a house style rule would be falsifying the quote. The rule loses to
// accuracy. Named here so the exclusion is a decision on the record rather
// than a hole discovered later.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EM = "—";

const ROOTS = [
  { dir: path.join(ROOT, "components"), exts: [".tsx"] },
  { dir: path.join(ROOT, "content"), exts: [".ts"] },
  { dir: path.join(ROOT, "app"), exts: [".tsx"] },
];

function walk(dir, exts, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, exts, out);
    } else if (exts.includes(path.extname(entry))) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Blank out comments so a rationale that mentions an em dash is not itself a
 * violation. Replaces with spaces rather than deleting, so reported line
 * numbers still match the file.
 */
function stripComments(src) {
  let out = "";
  let i = 0;
  let state = "code";
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (state === "code" && two === "/*") {
      state = "block";
      out += "  ";
      i += 2;
      continue;
    }
    if (state === "block" && two === "*/") {
      state = "code";
      out += "  ";
      i += 2;
      continue;
    }
    if (state === "code" && two === "//") {
      state = "line";
      out += "  ";
      i += 2;
      continue;
    }
    if (state === "line" && src[i] === "\n") {
      state = "code";
      out += "\n";
      i += 1;
      continue;
    }
    if (state === "code") {
      out += src[i];
    } else {
      out += src[i] === "\n" ? "\n" : " ";
    }
    i += 1;
  }
  return out;
}

const files = ROOTS.flatMap(({ dir, exts }) => {
  try {
    return walk(dir, exts);
  } catch {
    return [];
  }
});

if (files.length === 0) {
  console.error("check-no-em-dash: walked 0 files — the roots are wrong, not the repo.");
  process.exit(1);
}

const violations = [];
for (const file of files) {
  if (file === fileURLToPath(import.meta.url)) continue;
  const src = readFileSync(file, "utf8");
  if (!src.includes(EM)) continue;
  const stripped = stripComments(src);
  stripped.split("\n").forEach((line, idx) => {
    if (!line.includes(EM)) return;
    violations.push({
      file: path.relative(ROOT, file).replace(/\\/g, "/"),
      line: idx + 1,
      text: line.trim().slice(0, 110),
    });
  });
}

console.log(`check-no-em-dash: scanned ${files.length} rendering file(s) for the em dash character\n`);

if (violations.length > 0) {
  console.error(`FAIL: ${violations.length} em dash character(s) in copy a visitor reads:\n`);
  for (const v of violations) console.error(`  ${v.file}:${v.line}\n      ${v.text}`);
  console.error(
    "\nUse a comma, a colon, a full stop, or a new sentence. If the character is genuinely " +
      "part of quoted source material, the quote belongs in content/provenance.md, which this " +
      "check deliberately does not scan (see its header)."
  );
  process.exit(1);
}

console.log(`OK: no em dash in ${files.length} rendering file(s).`);
