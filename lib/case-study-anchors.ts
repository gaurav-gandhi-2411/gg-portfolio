import type { CaseStudy } from "@/content/types";

/**
 * The one place a case study's section headings and their anchors are decided.
 *
 * Why it exists: /ask cites a chunk, and a chunk knows which section of which
 * case study it came from, so the citation can land on that section rather
 * than on the top of a 7-minute page. That only works if the fragment the
 * chatbot index emits is the id the page actually renders.
 *
 * Those two lived in different files, in different languages, maintained by
 * different hands: the headings as string literals inside
 * components/case-study-page.tsx, the chunks inside
 * scripts/chatbot/build-index.mjs. Deriving a fragment in the indexer by
 * re-typing "Results, the honest numbers" would have been a link that goes
 * somewhere plausible and silently stops going anywhere the day someone
 * rewords a heading, which is this repo's most-repeated defect in its most
 * annoying form: a link that scrolls nowhere looks like a browser being
 * slow, not like a bug.
 *
 * So both import this. The page renders `SECTION_TITLES.problem` and the
 * indexer emits `anchorFor("problem")`, and there is no third copy to drift.
 * e2e/ask-deep-links.spec.ts closes the loop from the other end by loading
 * every case study and asserting each emitted fragment resolves to a real
 * element, which is a set derived from the rendered DOM rather than from
 * this file, so the two cannot both be wrong in the same direction.
 */

/** Section keys, matching the chunk kinds scripts/chatbot/build-index.mjs emits. */
export const SECTION_TITLES = {
  problem: "The problem",
  approach: "How it works",
  architecture: "Architecture",
  decisions: "Key decisions, and why",
  results: "Results, the honest numbers",
  closing: "What this means if you need something similar",
} as const;

export type SectionKey = keyof typeof SECTION_TITLES;

/**
 * A heading's DOM id. Must stay identical to what SectionHeading renders,
 * which it does by being the function SectionHeading calls.
 */
export function headingId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The anchor for a fixed section, e.g. "results-the-honest-numbers". */
export function anchorFor(key: SectionKey): string {
  return headingId(SECTION_TITLES[key]);
}

/**
 * The story section's heading is the story's own title, not a fixed string,
 * so its anchor has to be computed per case study rather than looked up.
 * Returns null when the study has no story, so a caller cannot accidentally
 * emit a fragment for a section that was never rendered.
 */
export function storyAnchor(study: Pick<CaseStudy, "story">): string | null {
  return study.story ? headingId(study.story.title) : null;
}

/**
 * The url a citation should point at.
 *
 * A missing anchor degrades to the plain case-study url rather than to a
 * broken fragment: landing at the top of the right page is a worse answer
 * than landing on the right paragraph, and a much better one than a link
 * that appears to do nothing.
 */
export function caseStudyUrl(slug: string, anchor: string | null | undefined): string {
  return anchor ? `/work/${slug}#${anchor}` : `/work/${slug}`;
}
