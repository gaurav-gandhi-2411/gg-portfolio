// Resume-pool vs. products.ts project coverage (run locally:
// node scripts/check-resume-project-coverage.mjs; wired into ci.yml).
//
// WHY THIS EXISTS: content/products.ts grew a 14th product
// ("adk-tracegauge", PR #144, 2026-08-18) and content/resume-data.json's
// project pool stayed at 13 -- its own _readme still said "13-project pool"
// two days later, and nothing compared the two counts. That is this repo's
// most-repeated defect (CHECKS.md): two sets that are supposed to describe
// the same thing, with no check reading either against the other, so a
// number drifts and nothing prints a denominator that would show it moving.
//
// Two independently-derived sets, same shape as check-card-consistency.mjs's
// flat-scan-vs-block-parse pattern:
//
//   products  -- a flat regex scan of content/products.ts for every
//                `slug: "..."` occurrence. Same pattern check-card-
//                consistency.mjs already uses and cross-validates, so this
//                script trusts it rather than re-deriving a second reading.
//   resumePool -- content/resume-data.json's entries where
//                 section === "project", read by each entry's own `project`
//                 field (already the real product slug -- e.g. "proj:mmfr"'s
//                 project field is "multimodal-fashion-recommender", not
//                 "mmfr" -- confirmed 2026-08-20, no prefix-mapping table
//                 needed the way check-card-consistency.mjs's metrics.json
//                 IDs require one).
//
// Fails on drift in EITHER direction: a product with no resume entry (the
// gap this check exists for) and a resume entry naming a product that no
// longer exists in products.ts (the same failure this repo has already hit
// once, the other way, in check-resume-pdf-consistency.mjs's
// EXPECTED_PDF_COVERAGE list) -- both printed by name, never just a count.
//
// This does NOT check bullet content, priority, or whether a project makes
// it into any given resume *variant* (scripts/lib/resume-select.mjs decides
// that per-JD, deliberately). It only checks that every live product has a
// bullet to be selected from at all.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PRODUCTS_PATH = join(ROOT, "content", "products.ts");
const RESUME_DATA_PATH = join(ROOT, "content", "resume-data.json");

const productsSrc = readFileSync(PRODUCTS_PATH, "utf8").replace(/\r\n/g, "\n");
const products = new Set([...productsSrc.matchAll(/\bslug:\s*"([\w-]+)"/g)].map((m) => m[1]));

if (products.size === 0) {
  console.error(`check-resume-project-coverage: matched 0 slugs in ${PRODUCTS_PATH}. The regex is out of step with the file, not the file with itself.`);
  process.exit(1);
}

const resumeData = JSON.parse(readFileSync(RESUME_DATA_PATH, "utf8"));
const resumePool = new Set(
  resumeData.entries.filter((e) => e.section === "project" && e.project).map((e) => e.project)
);

if (resumePool.size === 0) {
  console.error(`check-resume-project-coverage: found 0 section:"project" entries in ${RESUME_DATA_PATH}.`);
  process.exit(1);
}

const missingFromResume = [...products].filter((p) => !resumePool.has(p)).sort();
const staleInResume = [...resumePool].filter((p) => !products.has(p)).sort();

console.log(
  `check-resume-project-coverage: ${products.size} product(s) in products.ts, ` +
    `${resumePool.size} project entry/entries in resume-data.json's pool.`
);

if (missingFromResume.length > 0 || staleInResume.length > 0) {
  console.log("\nFAIL — the two sets disagree:\n");
  if (missingFromResume.length > 0) {
    console.log(`  in products.ts, no resume-data.json entry: ${missingFromResume.join(", ")}`);
    console.log("    The resume variant selector can never surface this product, no matter the JD,");
    console.log('    because it is not in the pool at all. Add a "proj:<slug>" entry with `project`');
    console.log("    set to the exact products.ts slug, sourced to its case study / provenance.md,");
    console.log("    in the same voice as the existing project bullets.");
  }
  if (staleInResume.length > 0) {
    console.log(`  in resume-data.json's pool, no matching products.ts slug: ${staleInResume.join(", ")}`);
    console.log("    Either the product was renamed/removed and this entry is stale, or its");
    console.log("    `project` field has a typo relative to products.ts's `slug`.");
  }
  console.log("");
  process.exit(1);
}

console.log("\nOK — every products.ts product has a resume-data.json project entry, and vice versa.");
