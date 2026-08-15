// BL-9 — tier 1 of project search: plain keyword/substring matching, the
// default every visitor gets with zero model dependency (see
// components/project-search.tsx's module header for the two-tier design).
//
// Deliberately NOT the IDF-weighted lexical scorer lib/chatbot/retrieve.ts
// uses — that scorer earns its complexity over a 400+ chunk prose corpus
// where common words need down-weighting against rare ones. This corpus is
// 13 short project summaries; plain substring/token-overlap matching is the
// literal, simplest thing that satisfies "search box... plain keyword/
// substring matching" and is easy to reason about with zero training data.

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "for",
  "in",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "with",
]);

/** Lowercases and splits a query into tokens, dropping stopwords and
 * single-character noise (matches lib/chatbot/retrieve.ts's tokenize shape,
 * duplicated locally rather than imported — that module also pulls in a
 * corpus-wide document-frequency table this tier has no use for). */
export function tokenizeQuery(query: string): string[] {
  const matches = query.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return matches.filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Keyword/substring relevance of `query` against one project's searchable
 * text (see lib/search/searchable-text.ts). Two signals, summed:
 *   - whole-phrase substring match (the trimmed, lowercased query appears
 *     verbatim in the text) — a strong signal, weighted 0.6.
 *   - fraction of query tokens that appear as a substring anywhere in the
 *     text — weighted 0.4, so a multi-word query that partially matches
 *     still ranks above one that matches nothing.
 * Returns a score in [0, 1]; 0 for an empty query or empty text.
 * @param query - the visitor's raw input, not yet tokenized
 * @param searchableText - this project's buildSearchableText() output
 */
export function keywordScore(query: string, searchableText: string): number {
  const trimmed = query.trim().toLowerCase();
  const text = searchableText.toLowerCase();
  if (trimmed.length === 0 || text.length === 0) return 0;

  const phraseMatch = text.includes(trimmed) ? 0.6 : 0;

  const tokens = tokenizeQuery(trimmed);
  const tokenScore =
    tokens.length === 0 ? 0 : (0.4 * tokens.filter((t) => text.includes(t)).length) / tokens.length;

  return phraseMatch + tokenScore;
}
