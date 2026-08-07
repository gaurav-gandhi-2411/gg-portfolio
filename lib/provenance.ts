import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

import metricsJson from "@/content/metrics.json";
import {
  extractCitations,
  extractMeasuredDate,
  parseProvenanceText,
  type ParsedProvenance,
} from "@/lib/provenance-parse";

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
  /** Direct GitHub blob link — only ever built for the structured (metrics.json) tier. */
  url?: string;
}

export interface ProvenanceInfo {
  /**
   * "structured" = content/metrics.json, machine-refreshed via a reviewed
   * PR, carries a real commit_sha — rendered as a normal clean citation.
   * "prose" = parsed out of content/provenance.md's free-text Source cell.
   * GG's explicit call (2026-08-06): a wrong citation next to a real
   * number is worse than no citation, so this tier is rendered as the raw
   * row text, verbatim — never as a citation this parser claims to have
   * extracted. `citations` is still populated for this tier (consumed by
   * the audit dump, scripts/audit-provenance-mapping.ts), just not
   * rendered as links by components/metric-provenance.tsx.
   */
  tier: "structured" | "prose";
  /** The provenance.md Source cell's prose, verbatim (or the metric's own label if no row parsed for a structured-only ref). */
  sourceText: string;
  citations: ProvenanceCitation[];
  /** The specific date this number was measured, when one is resolvable. */
  measuredAt?: string;
  /** Falls back to the case study's own verifiedAt when no specific measuredAt exists. */
  verifiedAt: string;
  /** Prose tier's honest fallback link — the site's own provenance.md, never a parsed/interpreted file citation. */
  provenanceDocUrl?: string;
}

const PROVENANCE_DOC_URL = "https://github.com/gaurav-gandhi-2411/gg-portfolio/blob/main/content/provenance.md";

const metrics = (metricsJson as { metrics: Record<string, MetricEntry> }).metrics;

let parsedCache: ParsedProvenance | null = null;

function getParsedProvenance(): ParsedProvenance {
  if (parsedCache) return parsedCache;
  const text = readFileSync(path.join(process.cwd(), "content", "provenance.md"), "utf8");
  parsedCache = parseProvenanceText(text);
  return parsedCache;
}

/** Diagnostics for scripts/audit-provenance-mapping.ts — never imported by page code. */
export function getProvenanceParseStats(): ParsedProvenance {
  return getParsedProvenance();
}

function stripRepoSlug(repoUrl: string | undefined): string | undefined {
  return repoUrl?.split("/").pop();
}

/**
 * Resolves a case-study result's sourceRef into display-ready provenance.
 * content/metrics.json (the machine-refreshed layer, wave 13) wins when a
 * ref has an entry there. Otherwise falls back to the matching
 * content/provenance.md row, parsed by lib/provenance-parse.ts — which
 * fails closed (returns no row) on an ambiguous or duplicate match rather
 * than guessing. Returns null when the ref has no usable provenance at
 * all: no provenance.md row parsed for it, or the row that would have
 * matched was rejected as ambiguous/duplicate. That null is a content gap
 * this function surfaces (see the console.warn below) rather than papering
 * over with a best guess.
 */
export function getProvenance(
  sourceRef: string,
  repoUrl: string | undefined,
  studyVerifiedAt: string
): ProvenanceInfo | null {
  const { rows } = getParsedProvenance();
  const row = rows.get(sourceRef);
  const metric = metrics[sourceRef];

  if (metric) {
    const isPublicFile = !metric.source_file.includes("(private)");
    const line = metric.source_line ?? undefined;
    const url =
      metric.commit_sha && isPublicFile
        ? `https://github.com/${metric.repo}/blob/${metric.commit_sha}/${metric.source_file}${line ? `#L${line}` : ""}`
        : undefined;
    return {
      tier: "structured",
      sourceText: row?.source ?? metric.label,
      citations: isPublicFile
        ? [{ file: metric.source_file, line, commitSha: metric.commit_sha ?? undefined, url }]
        : [],
      measuredAt: metric.measured_at ?? undefined,
      verifiedAt: studyVerifiedAt,
    };
  }

  if (!row) {
    console.warn(
      `[provenance] sourceRef "${sourceRef}" has no usable content/provenance.md row (missing, ambiguous, or duplicate) — rendering without a source popover.`
    );
    return null;
  }

  const repoSlug = stripRepoSlug(repoUrl);
  const citations = extractCitations(row.source, repoSlug);
  const measuredAt = extractMeasuredDate(row.claim, row.source);

  return {
    tier: "prose",
    sourceText: row.source,
    citations,
    measuredAt,
    verifiedAt: studyVerifiedAt,
    provenanceDocUrl: PROVENANCE_DOC_URL,
  };
}
