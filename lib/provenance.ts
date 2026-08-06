import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

import metricsJson from "@/content/metrics.json";

interface MetricEntry {
  label: string;
  value: string;
  repo: string;
  source_file: string;
  source_line: number | null;
  commit_sha: string | null;
  measured_at: string | null;
}

export interface ProvenanceCitation {
  file: string;
  line?: number;
  commitSha?: string;
  /** Direct GitHub blob link — omitted when the repo is private or unresolvable. */
  url?: string;
}

export interface ProvenanceInfo {
  /** content/provenance.md's Source cell for this ref, verbatim — always present. */
  sourceText: string;
  citations: ProvenanceCitation[];
  /** The specific date this number was measured, when one is resolvable. */
  measuredAt?: string;
  /** Falls back to the case study's own verifiedAt when no specific measuredAt exists. */
  verifiedAt: string;
}

const metrics = (metricsJson as { metrics: Record<string, MetricEntry> }).metrics;

let provenanceRowsCache: Map<string, { claim: string; source: string }> | null = null;

// Same row shape scripts/check-metric-freshness.mjs's parseProvenance() reads
// (a `| \`id\` | claim | source |` markdown table row) — reimplemented here
// rather than imported, since that script is a standalone CI entrypoint, not
// a module meant to be pulled into the Next.js build.
function parseProvenanceRows(): Map<string, { claim: string; source: string }> {
  if (provenanceRowsCache) return provenanceRowsCache;
  const text = readFileSync(path.join(process.cwd(), "content", "provenance.md"), "utf8");
  const rows = new Map<string, { claim: string; source: string }>();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\| `([a-zA-Z0-9:_.#-]+)` \| (.*) \| (.*) \|$/);
    if (!m) continue;
    rows.set(m[1], { claim: m[2], source: m[3] });
  }
  provenanceRowsCache = rows;
  return rows;
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

function stripRepoPrefix(file: string, repoUrl: string | undefined): string {
  const repoSlug = repoUrl?.split("/").pop();
  return repoSlug && file.startsWith(`${repoSlug}/`) ? file.slice(repoSlug.length + 1) : file;
}

function firstLineNumber(range: string | undefined): number | undefined {
  if (!range) return undefined;
  const n = Number(range.slice(1).split(/[,-]/)[0]);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * Resolves a case-study result's sourceRef into display-ready provenance.
 * content/metrics.json (the machine-refreshed layer, wave 13) wins when a
 * ref has an entry there — it's already structured, with a real commit_sha
 * and measured_at. Otherwise falls back to parsing the matching
 * content/provenance.md row's free-text Source cell for a best-effort
 * file/commit/date. Returns null only when the ref has no provenance.md row
 * at all — a content bug (every sourceRef must have one, rule 65b) this
 * surfaces to the page rather than hiding.
 */
export function getProvenance(
  sourceRef: string,
  repoUrl: string | undefined,
  studyVerifiedAt: string
): ProvenanceInfo | null {
  const row = parseProvenanceRows().get(sourceRef);
  const metric = metrics[sourceRef];

  if (metric) {
    const isPublicFile = !metric.source_file.includes("(private)");
    const line = metric.source_line ?? undefined;
    const url =
      metric.commit_sha && isPublicFile
        ? `https://github.com/${metric.repo}/blob/${metric.commit_sha}/${metric.source_file}${line ? `#L${line}` : ""}`
        : undefined;
    return {
      sourceText: row?.source ?? metric.label,
      citations: isPublicFile
        ? [{ file: metric.source_file, line, commitSha: metric.commit_sha ?? undefined, url }]
        : [],
      measuredAt: metric.measured_at ?? undefined,
      verifiedAt: studyVerifiedAt,
    };
  }

  if (!row) {
    console.warn(`[provenance] sourceRef "${sourceRef}" has no content/provenance.md row — rendering without a source popover.`);
    return null;
  }

  const commitFromProse = row.source.match(COMMIT_PROSE_RE)?.[1];
  const citations = [...row.source.matchAll(CITATION_RE)].map((m) => {
    const file = stripRepoPrefix(m[1], repoUrl);
    const line = firstLineNumber(m[2]);
    const commitSha = m[3]?.slice(1) ?? commitFromProse;
    const url = repoUrl ? `${repoUrl}/blob/${commitSha ?? "HEAD"}/${file}${line ? `#L${line}` : ""}` : undefined;
    return { file, line, commitSha, url };
  });
  const measuredAt = row.source.match(DATE_RE)?.[1] ?? row.claim.match(DATE_RE)?.[1];

  return { sourceText: row.source, citations, measuredAt, verifiedAt: studyVerifiedAt };
}
