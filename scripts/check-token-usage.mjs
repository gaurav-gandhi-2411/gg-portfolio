#!/usr/bin/env node
// Design tokens are the one visual system this site is supposed to have
// (app/globals.css). This check fails a change that quietly steps outside
// it: a raw hex color, a font-size utility from Tailwind's default type
// scale instead of this project's own, or a transition duration/easing
// utility from Tailwind's default motion values instead of this project's
// own `--dur-*`/`--ease-*` tokens.
//
// WHY THIS EXISTS, with a real example rather than a hypothetical one: while
// fixing components/metric-provenance.tsx during this same production-audit
// round, a rewrite of its className list silently dropped
// `duration-[var(--dur-fast)] ease-[var(--ease-out-soft)]` and replaced it
// with the bare `duration-150 ease-out` — Tailwind's own defaults, not this
// project's motion tokens. It rendered fine, typechecked fine, and passed
// every existing test; it was only caught by manually diffing the file
// against its prior committed version. A gate that would have failed the
// build on sight is cheaper than a manual diff nobody is required to run.
// GG's own audit separately found 18 sites already doing this across the
// codebase by grepping for it by hand — this makes that grep a standing
// gate instead of a one-time sweep.
//
// SCOPE, stated rather than implied (CHECKS.md's own recurring lesson: a
// check that covers less than its name implies is this repo's most-repeated
// defect class):
//
//   covered:     components/**/*.tsx, app/**/*.tsx, and the site's
//                component-scoped CSS files (app/*.css EXCEPT globals.css).
//   NOT covered: app/globals.css itself — the canonical token *definitions*
//                live there (the hex values behind --graphite-950, the
//                --dur-fast/--ease-out-soft values themselves, etc.), so it
//                is the one place these literals are supposed to appear.
//                Also not covered: content/**, scripts/**, tests/**, docs —
//                none of those carry className strings a visitor's browser
//                ever parses.
//
// WHY PLAIN TAILWIND SPACING UTILITIES (px-3.5, gap-2, -my-2.5, ...) ARE NOT
// FLAGGED: this project never overrides Tailwind v4's own `--spacing` base
// unit (no `--spacing:` line in globals.css), and every `--space-N` token is
// defined as `calc(var(--spacing) * N)` on the exact same N Tailwind's own
// numeric utilities use — so `p-4` and `p-[var(--space-4)]` compute to the
// identical value today. That is a real indirection/consistency question,
// not a value that has actually drifted, so it is out of this check's scope
// on purpose; an arbitrary bracketed spacing value that ISN'T on that scale
// at all (mt-[13px], gap-[22px]) is a real drift and IS flagged below.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CODE_ROOTS = [
  { dir: path.join(ROOT, "components"), exts: [".tsx"] },
  { dir: path.join(ROOT, "app"), exts: [".tsx"] },
];

// app/*.css except globals.css (the token-definition file itself).
const CSS_EXCLUDE = new Set(["globals.css"]);

// next/og image routes render through Satori, a separate, non-DOM renderer
// with no access to CSS custom properties or Tailwind classes at all — a
// hex literal here isn't drift, it's the only thing this runtime accepts.
const PATH_EXCLUDE_RE = /opengraph-image\.tsx$/;

// Tailwind's default font-size scale, MINUS two sizes this project already
// investigated and deliberately kept (see globals.css's own "BL-2" comment
// beside --text-caption/body/body-lg): `text-body-lg` (1.125rem) already
// replaced every `text-lg` usage codebase-wide (0 remain — if one reappears
// it WILL be caught, "lg" stays in this list). `text-sm` was tried and
// reverted — growing 14px to `text-body`'s 14.4px broke a real flex-wrap
// layout (screenshot-diff caught it), so `--text-body` stays defined but
// unadopted, and bare `text-sm` is the correct, current choice, not drift.
// `text-base` was never a migration candidate at all (16px has no rung on
// the ladder within a safe margin either direction). `text-xs`, by
// contrast, is fully replaced already (55/55 usages, per the same
// comment) — any `text-xs` found below is a regression back into ground
// this project already covered, not an untouched area.
const DEFAULT_FONT_SIZES = [
  "3xs", "2xs", "xs", "lg", "xl",
  "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "8xl", "9xl",
];
const FONT_SIZE_RE = new RegExp(`(?<![\\w-])text-(${DEFAULT_FONT_SIZES.join("|")})(?![\\w-])`, "g");

// Tailwind's default transition duration/easing utilities. This project's
// own values (--dur-instant/fast/base/slow/ambient,
// --ease-out-soft/in-out-soft/spring) are consumed as arbitrary values —
// duration-[var(--dur-fast)], ease-[var(--ease-out-soft)] — never as a bare
// utility name, so any bare duration-N or ease-word is a default that
// slipped through instead.
const DEFAULT_DURATIONS = ["75", "100", "150", "200", "300", "500", "700", "1000"];
const DURATION_RE = new RegExp(`(?<![\\w-])duration-(${DEFAULT_DURATIONS.join("|")})(?![\\w-])`, "g");
const DEFAULT_EASES = ["linear", "in", "out", "in-out"];
const EASE_RE = new RegExp(`(?<![\\w-])ease-(${DEFAULT_EASES.join("|")})(?![\\w-])`, "g");

// A raw hex color literal, 3/4/6/8 hex digits, the shapes browsers accept.
const HEX_RE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/g;

// An arbitrary spacing bracket value that ISN'T routed through a
// --space-* token — e.g. mt-[13px], gap-[1.25rem], px-[10px]. Scoped to the
// margin/padding/gap/space-between prefixes, which are what "spacing scale"
// actually means here; w-[...]/h-[...]/inset-[...] routinely need one-off
// pixel-exact values unrelated to rhythm and are out of scope on purpose.
const SPACING_PREFIXES = [
  "m", "mt", "mr", "mb", "ml", "mx", "my",
  "p", "pt", "pr", "pb", "pl", "px", "py",
  "gap", "gap-x", "gap-y", "space-x", "space-y",
];
const SPACING_ARBITRARY_RE = new RegExp(
  `(?<![\\w-])(?:-)?(?:${SPACING_PREFIXES.join("|")})-\\[(?!var\\(--space-)([^\\]]+)\\]`,
  "g"
);

/**
 * Blank out comments so a rationale that names a hex value, a Tailwind
 * default, or an arbitrary spacing value (to explain why NOT to use it, or
 * why a specific exception is deliberate) is not itself flagged as an
 * occurrence. Replaces with spaces rather than deleting, so reported line
 * numbers still match the file. Same technique as check-no-em-dash.mjs;
 * handles both `//` line comments and `/* *\/` block comments, which covers
 * both the .tsx and .css files this check scans.
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

/**
 * Pre-existing, deliberate exceptions, each citing the reasoning already on
 * record beside the code — not a way to silence the check, a way to record
 * a judgment call the same way an inline suppression comment would, in a
 * codebase-wide list that's easy to audit. Keyed by file:line so moving the
 * line forces a conscious re-check rather than silently following the code.
 */
const ALLOWLIST = new Set([
  // -my-[5px] is deliberately off the spacing scale: it keeps a 44px tap
  // target from bulking out the pill row visually, documented at length in
  // the comment immediately above it in components/project-filter.tsx.
  "components/project-filter.tsx:175:-my-[5px]",
  // Pre-existing debt, not fixed here: `var(--ease-out, ease-out)` — the
  // custom property `--ease-out` is never defined anywhere in this
  // codebase (confirmed by grep), so the literal `ease-out` fallback is
  // not a rare edge case, it is 100% of what actually runs. hero.css:685
  // has the same pattern with a different, also-undefined fallback curve
  // (cubic-bezier(0.16, 1, 0.3, 1), not this project's --ease-out-soft) —
  // that one isn't caught by this check's word-boundary regex (it reads as
  // part of the `--ease-out` custom-property NAME, not the keyword), but
  // it's the same debt. Fixing either risks changing this hero
  // transition's actual visual timing without a design decision behind it
  // (--ease-out-soft is a different curve from either fallback) — left for
  // the visual-unification pass to resolve deliberately, not silently
  // swapped in a token-lint fix.
  "app/hero.css:104:ease-out",
]);

function walk(dir, exts, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, exts, out);
    else if (exts.includes(path.extname(entry))) out.push(full);
  }
  return out;
}

const tsxFiles = CODE_ROOTS.flatMap(({ dir, exts }) => {
  try {
    return walk(dir, exts);
  } catch {
    return [];
  }
}).filter((f) => !PATH_EXCLUDE_RE.test(f));

let cssFiles = [];
try {
  cssFiles = readdirSync(path.join(ROOT, "app"))
    .filter((f) => f.endsWith(".css") && !CSS_EXCLUDE.has(f))
    .map((f) => path.join(ROOT, "app", f));
} catch {
  cssFiles = [];
}

const allFiles = [...tsxFiles, ...cssFiles];

if (allFiles.length === 0) {
  console.error("check-token-usage: walked 0 files, so the roots are wrong rather than the repo.");
  process.exit(1);
}

const violations = [];

function scan(file, re, kind, suggest) {
  const src = readFileSync(file, "utf8");
  const rel = path.relative(ROOT, file).replace(/\\/g, "/");
  // Comment-stripped for matching (so an explanatory comment naming the
  // thing not to do isn't itself a hit), but the ORIGINAL line is what gets
  // reported, so the printed excerpt still reads correctly.
  const original = src.split("\n");
  stripComments(src).split("\n").forEach((line, idx) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(line))) {
      const key = `${rel}:${idx + 1}:${m[0]}`;
      if (ALLOWLIST.has(key)) continue;
      violations.push({
        where: `${rel}:${idx + 1}`,
        kind,
        found: m[0],
        suggest,
        text: original[idx].trim().slice(0, 100),
      });
    }
  });
}

for (const file of allFiles) {
  if (file === fileURLToPath(import.meta.url)) continue;
  scan(file, HEX_RE, "raw hex color", "use a --color-*/--graphite-*/--indigo etc. token instead");
  scan(file, FONT_SIZE_RE, "Tailwind default font size", "use this project's own text-caption/body/body-lg/lead/title/heading/display scale");
  scan(file, DURATION_RE, "Tailwind default transition duration", "use duration-[var(--dur-instant|fast|base|slow|ambient)]");
  scan(file, EASE_RE, "Tailwind default easing", "use ease-[var(--ease-out-soft|in-out-soft|spring)]");
  scan(file, SPACING_ARBITRARY_RE, "arbitrary spacing value off the scale", "use the matching -[var(--space-N)] token, or a plain scale utility if one matches");
}

console.log(`check-token-usage: scanned ${allFiles.length} file(s) for off-token colors, type sizes, and motion values\n`);

if (violations.length > 0) {
  console.error(`FAIL: ${violations.length} off-token value(s):\n`);
  for (const v of violations) {
    console.error(`  ${v.where}  [${v.kind}: "${v.found}"] — ${v.suggest}`);
    console.error(`      ${v.text}`);
  }
  process.exit(1);
}

console.log(`OK: no raw hex, default font-size, default motion, or off-scale spacing values in ${allFiles.length} file(s).`);
