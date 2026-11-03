// Removes raw chunk references from answer prose.
//
// The model is shown each chunk's sourceRef/id so it can fill the structured
// `citations` array, and sometimes copies one into the sentence itself
// (the shipped openai/gpt-oss-120b wrote "the `warmer:hinglish-fix`, which..."
// into project-warmer-hinglish). ask-panel renders answer text as plain text,
// so a visitor sees the internal ref. The structured citations already carry
// the attribution, so the prose copy is pure noise.
//
// Matching is against the set of KNOWN refs (chunk ids and sourceRefs), never
// a generic `\w+:\w+` pattern, so "10:30 IST", "3:1", "https://..." and
// "Note: ..." can never be touched.
//
// Shapes covered, each with an optional "#N" suffix (ids carry it, sourceRefs
// do not, so both are in the known set): bare, `backticked`, [bracketed],
// (parenthesized). A ref embedded in a longer token (a path segment, a longer
// unknown ref) is left alone.

/** A match preceded or followed by these would be the middle of a longer token. */
const NOT_BEFORE = String.raw`(?<![\w/:#-])`;
const NOT_AFTER = String.raw`(?![\w#-])`;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builds a stripper bound to a set of known refs. Pure; the returned function
 * is idempotent (its output contains no known ref, so a second pass finds
 * nothing to replace and returns the text untouched).
 */
export function buildCitationTagStripper(knownRefs: Iterable<string>): (text: string) => string {
  // Longest first so "x:y#2" wins over its prefix "x:y".
  const refs = [...new Set(knownRefs)]
    .filter((r) => r.length > 0)
    .sort((a, b) => b.length - a.length);
  if (refs.length === 0) return (text) => text;
  const ref = refs.map(escapeRegExp).join("|");
  const pattern = new RegExp(
    `\`\\s*(?:${ref})\\s*\`|\\[\\s*(?:${ref})\\s*\\]|\\(\\s*(?:${ref})\\s*\\)|${NOT_BEFORE}(?:${ref})${NOT_AFTER}`,
    "g"
  );

  return (text: string): string => {
    let removed = false;
    const stripped = text.replace(pattern, () => {
      removed = true;
      return "";
    });
    if (!removed) return text;
    // Tidy only what a removal can leave behind, and only on this path, so
    // text without a tag is returned byte-identical.
    return stripped
      .replace(/\(\s*\)|\[\s*\]/g, "")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/[ \t]+([,.;:!?])/g, "$1")
      .replace(/[ \t]+$/gm, "")
      .trim();
  };
}
