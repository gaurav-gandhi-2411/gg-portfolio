// BL-9 — the one function that decides what text represents a project for
// search, shared by both sides of the build-time/runtime split:
//   1. scripts/search/build-project-embeddings.mjs (Node, build-time —
//      embeds this text with the local ONNX model)
//   2. components/project-search.tsx (browser, runtime — scores this same
//      text against the visitor's query for the always-available keyword
//      tier)
//
// Kept dependency-free and alias-free on purpose: scripts/search/
// build-project-embeddings.mjs imports this file directly via a relative
// path under plain Node (no bundler, see that script's own header), which
// cannot resolve the "@/..." path alias Next's webpack build resolves for
// the client component. A shared function that only the client could import
// would let the build-time and runtime text silently drift apart — the same
// failure class CHECKS.md exists to name.
//
// Category IDs are deliberately pre-resolved to their display labels by the
// caller (content/types.ts's CATEGORIES) rather than imported here, for the
// same alias reason.

export interface SearchableProductInput {
  name: string;
  tagline: string;
  techChips?: string[];
  /** Category labels ("LLM & Agents"), not ids ("llm-agents") — labels are
   * prose the embedding model can use; ids are URL vocabulary, not text. */
  categoryLabels: string[];
}

/**
 * Builds the one searchable string for a project: name, tagline, tech
 * chips, and category labels, period-joined so the embedding model reads it
 * as short sentences rather than a run-on phrase.
 * @param input - the fields that make up a project's searchable identity
 * @returns a single string, embedded at build time and substring-matched at
 *   query time
 */
export function buildSearchableText(input: SearchableProductInput): string {
  const parts = [input.name, input.tagline, ...(input.techChips ?? []), ...input.categoryLabels];
  return parts.filter((p) => p.length > 0).join(". ");
}
