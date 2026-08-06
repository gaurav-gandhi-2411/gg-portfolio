// Pure text-parsing logic for content/provenance.md, split out of
// lib/provenance.ts specifically so it has zero imports (no fs, no
// server-only, no path aliases) and can run under plain
// `node --experimental-strip-types --test` — see
// lib/provenance-parse.test.ts for the fixture-per-parse-shape coverage
// this module exists to make possible.

export interface ProvenanceRow {
  claim: string;
  source: string;
}

export interface RejectedRow {
  line: string;
  reason: "ambiguous-pipe-split" | "duplicate-id";
}

export interface ParsedProvenance {
  rows: Map<string, ProvenanceRow>;
  rejected: RejectedRow[];
}

const ROW_RE = /^\| `([a-zA-Z0-9:_.#-]+)` \| (.*) \| (.*) \|$/;

/**
 * Parses content/provenance.md's `| \`id\` | claim | source |` table rows.
 * Two rows are rejected rather than trusted on a best guess (GG's explicit
 * call, 2026-08-06 — "a wrong citation rendered next to a real number is
 * worse than no citation"):
 *
 * 1. A candidate line whose plain `" | "` split doesn't come out to exactly
 *    3 segments (`` `id` ``, claim, source). ROW_RE's two `(.*)` groups are
 *    greedy and WILL match a 4-column row (a different table elsewhere in
 *    the file that happens to also open with `` | `id` | `` — e.g. this
 *    file's wave-20 "old value / new value / source" correction ledger)
 *    by mis-partitioning claim/source at the wrong pipe. Real bug found
 *    authoring this check: `style-maitri:intent-accuracy` and
 *    `style-maitri:catalogue-size` each had exactly this collision —
 *    ROW_RE matched their real 3-column row AND a 4-column ledger row
 *    sharing the same id, and because a plain `Map.set()` scan takes
 *    whichever match comes last, the ledger row's misparsed content was
 *    silently winning over the real one.
 * 2. Two or more DIFFERENT, individually well-formed (non-ambiguous) rows
 *    sharing the same id. Rather than guess which is authoritative, both
 *    are dropped — this id resolves to no provenance until the duplicate
 *    is fixed in content/provenance.md.
 *
 * Every rejected line is returned, not just counted, so a caller can
 * report exactly what got hidden and why (rule 65b/85a: a control's
 * coverage gap must be visible, not silently "unverifiable").
 */
export function parseProvenanceText(text: string): ParsedProvenance {
  const candidates: { id: string; row: ProvenanceRow; line: string }[] = [];
  const rejected: RejectedRow[] = [];

  for (const line of text.split(/\r?\n/)) {
    const m = line.match(ROW_RE);
    if (!m) continue;
    if (line.split(" | ").length !== 3) {
      rejected.push({ line, reason: "ambiguous-pipe-split" });
      continue;
    }
    candidates.push({ id: m[1], row: { claim: m[2], source: m[3] }, line });
  }

  const byId = new Map<string, typeof candidates>();
  for (const c of candidates) {
    const list = byId.get(c.id) ?? [];
    list.push(c);
    byId.set(c.id, list);
  }

  const rows = new Map<string, ProvenanceRow>();
  for (const [id, list] of byId) {
    if (list.length > 1) {
      for (const c of list) rejected.push({ line: c.line, reason: "duplicate-id" });
      continue;
    }
    rows.set(id, list[0].row);
  }

  return { rows, rejected };
}

export interface Citation {
  file: string;
  line?: number;
  commitSha?: string;
}

// A Source cell's prose can embed several backtick-quoted `path[:line][@sha]`
// tokens (a decision row often cites both an ADR and the file the shipped
// number actually lives in — see gold-rate-tracker's `gold:direction-baseline`,
// cited from three different results/decisions/story rows against two
// distinct files). Extracting all of them, not just the first, avoids
// guessing which one is "the" source when the prose cites more than one.
const CITATION_RE = /`([\w./-]+\.[a-zA-Z0-9]+)(:[\d,-]+)?(@[0-9a-f]{7,40})?`/g;
const COMMIT_PROSE_RE = /commit `([0-9a-f]{7,40})`/;
const DATE_RE = /\b(\d{4}-\d{2}-\d{2})\b/;

function firstLineNumber(range: string | undefined): number | undefined {
  if (!range) return undefined;
  const n = Number(range.slice(1).split(/[,-]/)[0]);
  return Number.isNaN(n) ? undefined : n;
}

export function stripRepoPrefix(file: string, repoSlug: string | undefined): string {
  return repoSlug && file.startsWith(`${repoSlug}/`) ? file.slice(repoSlug.length + 1) : file;
}

/** Every backtick-quoted file citation in a Source cell, in order of appearance. */
export function extractCitations(sourceText: string, repoSlug: string | undefined): Citation[] {
  const commitFromProse = sourceText.match(COMMIT_PROSE_RE)?.[1];
  return [...sourceText.matchAll(CITATION_RE)].map((m) => ({
    file: stripRepoPrefix(m[1], repoSlug),
    line: firstLineNumber(m[2]),
    commitSha: m[3]?.slice(1) ?? commitFromProse,
  }));
}

/** First ISO date found in the claim or source text, preferring the source cell. */
export function extractMeasuredDate(claim: string, source: string): string | undefined {
  return source.match(DATE_RE)?.[1] ?? claim.match(DATE_RE)?.[1];
}
