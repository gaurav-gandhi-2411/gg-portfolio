import metricsJson from "@/content/metrics.json";
import type { ProductMetric } from "@/content/types";

interface MetricEntry {
  label: string;
  value: string;
  repo: string;
  source_file: string;
  source_line: number | null;
  commit_sha: string | null;
  measured_at: string | null;
}

const metrics = metricsJson.metrics as Record<string, MetricEntry>;

/**
 * Wave 13 — the one bridge between the machine-refreshable metric store
 * (content/metrics.json, rewritten weekly by the metrics-refresh workflow
 * via a reviewed PR) and the typed content layer. Throws on a missing id,
 * so a metric referenced by products.ts but absent from metrics.json fails
 * the build — that throw IS the validation (rule 65b: no sourceRef, no ship).
 */
export function refreshableMetric(id: string): ProductMetric {
  const entry = metrics[id];
  if (!entry) {
    throw new Error(
      `content/metrics.json has no entry "${id}" — every product metric must live in the refreshable store (wave 13).`
    );
  }
  return { label: entry.label, value: entry.value, sourceRef: id };
}
