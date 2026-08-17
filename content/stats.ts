/**
 * The three numbers from the professional record that are worth stating on
 * the homepage before anyone scrolls into a role ladder.
 *
 * Each one carries the `sourceRef` of the exact bullet it is taken from, and
 * scripts/check-stats-attribution.mjs fails the build if that ref is not in
 * content/experience.ts. That is the whole point of the field: a headline
 * number on a portfolio is the easiest thing in the world to round up once
 * and never revisit, and the bullet it came from is the only thing that can
 * contradict it. Tying them together means editing one without the other is
 * a failing check rather than a discrepancy nobody notices.
 *
 * `value` is deliberately not parsed out of the bullet text. The bullet is a
 * sentence and the stat is a display string, and a regex that tried to derive
 * one from the other would be a parser standing between two things a human
 * should keep in agreement on purpose.
 */
export type HeadlineStat = {
  /** Display string, as it renders. */
  value: string;
  /** What the number is, in the same voice as the rest of the page. */
  label: string;
  /** The role-ladder bullet this number is taken from, verbatim. */
  sourceRef: string;
};

export const headlineStats: HeadlineStat[] = [
  {
    value: "$10M+",
    label: "a year saved by displacing manual document review",
    sourceRef: "resume:indium-ds-docunderstanding",
  },
  {
    value: "~70%",
    label: "of earner document verification automated",
    sourceRef: "resume:indium-senior-vit",
  },
  {
    value: "50M+",
    label: "documents behind the transformer it was pretrained on",
    sourceRef: "resume:indium-ds-docunderstanding",
  },
];
