import { ResearchPaperList } from "@/components/research-paper-list";
import { Section } from "@/components/section";
import { researchPapers } from "@/content/research";

/**
 * Wave 6: title, the abstract's thesis sentence in the body voice
 * (verbatim excerpt), and a one-line status in plain language.
 *
 * Wave 13 — desktop composition: at lg the paper splits into a two-column
 * spread (title + status + links left, thesis right), filling the
 * 1024–1600px band with the same content instead of stacking it in a
 * narrow strand. Below lg, unchanged (breakpoint moved from xl to lg in the 2026-07-30 UI/UX wave).
 *
 * GG's launch-review round two dropped the RevealGroup wrapper — see
 * components/sections/about.tsx's header for why. Each card is a
 * `.section-card` (app/sections-motion.css) for the pointer tilt, replacing
 * the first pass's hand-written hover/focus-within utility classes.
 *
 * GG's launch-review round three: "same on Research" (whole-card click
 * target, see components/project-card.tsx's own header). The benchmark's
 * case-study link carries `.card-stretch-link`; arXiv/Repo carry
 * `.card-clickable` to keep landing on themselves (app/globals.css has
 * both rules' full reasoning).
 *
 * refresh-2026-09: the card markup itself moved to
 * components/research-paper-list.tsx, shared with the standalone /research
 * page (app/research/page.tsx) — this component now only owns the section
 * shell and card gap.
 */
export function Research() {
  return (
    <Section id="research" label="Research" width="wide">
      {/*
       * The papers sit in the same card as an Experience entry: same border,
       * same surface, same radius, same padding step. Before this they were
       * bare articles on the page background, so the one section made of
       * long-form claims was also the only one with nothing holding it, and
       * the ragged column gap between a five-line title and a three-line
       * thesis read as a layout that had come apart rather than as two
       * columns. The card gives the gap an edge to be measured against.
       *
       * gap-6 rather than gap-10 for the same reason it is gap-6 in
       * Experience: once each item has a border, the border is doing the
       * separating and the old whitespace is just distance.
       */}
      <ResearchPaperList papers={researchPapers} />
    </Section>
  );
}
