// Applicability detector for the /ask live-preview guard (ask-live-guard.yml).
//
// Decides whether a PR changes any package that /api/chat depends on, by diffing the base and head
// package.json + package-lock.json against scripts/ask-guard/guarded-packages.json. Pure functions
// are exported for ask-guard.smoketest.mjs; the CLI at the bottom is what the workflow runs:
//
//   node scripts/ask-guard/detect.mjs --base-pkg F --base-lock F --head-pkg F --head-lock F
//
// Prints `applicable=true|false` (+ a reason per changed entry) and appends the same line to
// $GITHUB_OUTPUT. Exit 0 = decided; exit 2 = could not decide (missing/unparseable file). The
// workflow treats exit 2 as a FAILED check, never as "not applicable" (rule 98a, fail closed).
//
// A lockfile-only bump counts: lockfile entries are matched by the last `node_modules/<name>`
// segment of every key (so nested copies and transitive deps are covered), and the compared value
// includes the integrity hash, so a re-resolved identical version is also a change.

import { appendFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CONFIG_PATH = join(HERE, "guarded-packages.json");

const DEP_SECTIONS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
  "overrides",
];

/** @param {string} name @param {string[]} patterns */
export function isGuarded(name, patterns) {
  return patterns.some((p) => (p.endsWith("*") ? name.startsWith(p.slice(0, -1)) : name === p));
}

/** Last `node_modules/<name>` segment of a lockfile key, or null for the root ("") entry. */
export function lockKeyToName(key) {
  const marker = "node_modules/";
  const i = key.lastIndexOf(marker);
  return i === -1 ? null : key.slice(i + marker.length);
}

/**
 * Flatten the guarded slice of a package.json + package-lock.json into comparable entries.
 * @returns {Map<string, string>} stable entry id -> value
 */
export function collectGuarded(pkg, lock, patterns) {
  if (!pkg || typeof pkg !== "object") throw new Error("package.json is not an object");
  if (!lock || typeof lock.packages !== "object" || lock.packages === null) {
    throw new Error("package-lock.json has no `packages` map (lockfileVersion < 2?)");
  }
  const out = new Map();
  for (const section of DEP_SECTIONS) {
    for (const [name, spec] of Object.entries(pkg[section] ?? {})) {
      // overrides can be nested objects; stringify keeps any change visible.
      if (isGuarded(name, patterns)) out.set(`package.json ${section}.${name}`, JSON.stringify(spec));
    }
  }
  for (const [key, entry] of Object.entries(lock.packages)) {
    const name = lockKeyToName(key);
    if (name !== null && isGuarded(name, patterns)) {
      out.set(`lock ${key}`, `${entry.version ?? "?"} ${entry.integrity ?? entry.resolved ?? ""}`.trim());
    }
  }
  return out;
}

/** @returns {{ applicable: boolean, reasons: string[] }} */
export function diffGuarded(baseMap, headMap) {
  const reasons = [];
  for (const id of [...new Set([...baseMap.keys(), ...headMap.keys()])].sort()) {
    const b = baseMap.get(id);
    const h = headMap.get(id);
    if (b === h) continue;
    if (b === undefined) reasons.push(`added   ${id}: ${h}`);
    else if (h === undefined) reasons.push(`removed ${id}: was ${b}`);
    else reasons.push(`changed ${id}: ${b} -> ${h}`);
  }
  return { applicable: reasons.length > 0, reasons };
}

export function detect({ basePkg, baseLock, headPkg, headLock, patterns }) {
  if (!Array.isArray(patterns) || patterns.length === 0) {
    throw new Error("guarded package list is empty -- refusing to report 'not applicable' vacuously");
  }
  return diffGuarded(collectGuarded(basePkg, baseLock, patterns), collectGuarded(headPkg, headLock, patterns));
}

function main(argv) {
  const args = Object.fromEntries(
    argv.slice(2).reduce((acc, a, i, all) => (a.startsWith("--") ? [...acc, [a.slice(2), all[i + 1]]] : acc), [])
  );
  for (const k of ["base-pkg", "base-lock", "head-pkg", "head-lock"]) {
    if (!args[k]) throw new Error(`missing --${k}`);
  }
  const read = (p) => JSON.parse(readFileSync(p, "utf8"));
  const patterns = read(args.config ?? DEFAULT_CONFIG_PATH).packages;
  const { applicable, reasons } = detect({
    basePkg: read(args["base-pkg"]),
    baseLock: read(args["base-lock"]),
    headPkg: read(args["head-pkg"]),
    headLock: read(args["head-lock"]),
    patterns,
  });
  console.log(`guarded patterns: ${patterns.length}; changed entries: ${reasons.length}`);
  for (const r of reasons) console.log(`  ${r}`);
  console.log(`applicable=${applicable}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `applicable=${applicable}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main(process.argv);
  } catch (err) {
    console.error(`DETECT_ERROR: ${err.message}`);
    process.exit(2);
  }
}
