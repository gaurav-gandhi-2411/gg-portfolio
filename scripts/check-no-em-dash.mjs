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
//   covered: string literals and JSX text in components/**/*.tsx and
//            app/**/*.tsx, string literals in content/**/*.ts, and the
//            value-bearing fields of content/*.json.
//
//   NOT covered: code comments, and docs/reports/PLAN/CHECKS/spec/README.
//            Those are written for people working on the repo, not for
//            visitors, and the rule is about the site's voice.
//
// THE JSON RULE, and why the first version of this check was wrong about it.
//
// That first version excluded content/*.json wholesale, on the stated grounds
// that its contents were quoted source material and that rewriting a quote to
// satisfy a house style would falsify it. The reasoning is sound and it was
// applied to the wrong unit: it is true of a citation FIELD, not of a whole
// file. content/metrics.json holds both kinds. Its `value` fields are site
// copy and render on the homepage and on /projects; its `source_file`, `note`
// and `_readme` fields are citations and maintainer notes no visitor sees.
//
// The consequence was not theoretical. This check reported zero while two em
// dashes rendered on the homepage the entire time, in
// "Naive wins ... ships the honest baseline, not the model" and
// "~48GB ... never corrected upward". It was found by counting em dashes in
// production HTML, not by reading this file, and that is the only method that
// could have found it: the check and the reasoning behind the check were
// wrong in the same direction, so the check could not contradict itself.
//
// The unit is therefore the field, split by what renders:
//
//   covered   value, label, store_value_at_sync        (site copy)
//   excluded  source_file, source, verified_source, commit_sha, repo, note,
//             _readme, and anything else               (citations, internals)
//
// TWO DELIBERATE EXCLUSIONS, on the record rather than discovered later:
//
//   content/provenance.md. Its rendered surface is the Source cell of a
//   provenance panel, which is a citation string, and 12 of them render
//   across the case studies. Those genuinely are the source-material case the
//   original reasoning was reaching for. A citation is quoted, not written.
//
//   content/resume-data.json. It feeds public/resume.pdf and nothing else;
//   there is no /resume route. GG ruled explicitly that the resume follows
//   its own style guide, which permits one em dash per paragraph, and that
//   this rule governs the site rather than the resume.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EM = "—";

const CODE_ROOTS = [
  { dir: path.join(ROOT, "components"), exts: [".tsx"] },
  { dir: path.join(ROOT, "content"), exts: [".ts"] },
  { dir: path.join(ROOT, "app"), exts: [".tsx"] },
];

// Keys whose strings reach a visitor. Anything not listed is treated as a
// citation or an internal note and skipped, which is the conservative
// direction for a rule about voice: a false pass on a field nobody renders
// costs nothing, while a false pass on rendered copy is the thing this
// exists to stop, and is exactly what the previous version did.
const RENDERED_JSON_KEYS = new Set(["value", "label", "store_value_at_sync"]);
const JSON_FILES = ["metrics.json", "resume-metrics.json"];

function walk(dir, exts, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, exts, out);
    else if (exts.includes(path.extname(entry))) out.push(full);
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
    if (state === "code" && two === "/*") { state = "block"; out += "  "; i += 2; continue; }
    if (state === "block" && two === "*/") { state = "code"; out += "  "; i += 2; continue; }
    if (state === "code" && two === "//") { state = "line"; out += "  "; i += 2; continue; }
    if (state === "line" && src[i] === "\n") { state = "code"; out += "\n"; i += 1; continue; }
    out += state === "code" ? src[i] : src[i] === "\n" ? "\n" : " ";
    i += 1;
  }
  return out;
}

const violations = [];

// ---- code files -----------------------------------------------------------
const codeFiles = CODE_ROOTS.flatMap(({ dir, exts }) => {
  try {
    return walk(dir, exts);
  } catch {
    return [];
  }
});

if (codeFiles.length === 0) {
  console.error("check-no-em-dash: walked 0 code files, so the roots are wrong rather than the repo.");
  process.exit(1);
}

for (const file of codeFiles) {
  if (file === fileURLToPath(import.meta.url)) continue;
  const src = readFileSync(file, "utf8");
  if (!src.includes(EM)) continue;
  stripComments(src)
    .split("\n")
    .forEach((line, idx) => {
      if (!line.includes(EM)) return;
      violations.push({
        where: `${path.relative(ROOT, file).replace(/\\/g, "/")}:${idx + 1}`,
        text: line.trim().slice(0, 110),
      });
    });
}

// ---- json value fields ----------------------------------------------------
let jsonFieldsScanned = 0;
for (const name of JSON_FILES) {
  const full = path.join(ROOT, "content", name);
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(full, "utf8"));
  } catch (err) {
    // Fail closed: an unreadable or malformed data file is not a pass.
    console.error(`check-no-em-dash: could not parse content/${name}: ${err.message}`);
    process.exit(1);
  }
  const visit = (node, key, trail) => {
    if (Array.isArray(node)) {
      node.forEach((v, i) => visit(v, key, `${trail}[${i}]`));
    } else if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) visit(v, k, trail ? `${trail}.${k}` : k);
    } else if (typeof node === "string" && RENDERED_JSON_KEYS.has(key)) {
      jsonFieldsScanned += 1;
      if (node.includes(EM)) {
        violations.push({ where: `content/${name} at ${trail}`, text: node.slice(0, 110) });
      }
    }
  };
  visit(parsed, null, "");
}

if (jsonFieldsScanned === 0) {
  console.error(
    "check-no-em-dash: matched 0 rendered fields across " +
      `${JSON_FILES.join(", ")}. The key list is out of step with the data, not the data with itself.`
  );
  process.exit(1);
}

console.log(
  `check-no-em-dash: scanned ${codeFiles.length} rendering file(s) and ` +
    `${jsonFieldsScanned} rendered JSON field(s) for the em dash character\n`
);

if (violations.length > 0) {
  console.error(`FAIL: ${violations.length} em dash character(s) in copy a visitor reads:\n`);
  for (const v of violations) console.error(`  ${v.where}\n      ${v.text}`);
  console.error(
    "\nUse a comma, a colon, a full stop, or a new sentence. If the character is genuinely part " +
      "of a citation, it belongs in a source field or in content/provenance.md, neither of which " +
      "this check scans. See its header for why the split is by field rather than by file."
  );
  process.exit(1);
}

console.log(
  `OK: no em dash in ${codeFiles.length} rendering file(s) or ${jsonFieldsScanned} rendered JSON field(s).`
);
