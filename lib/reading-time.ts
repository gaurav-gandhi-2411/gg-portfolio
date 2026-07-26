import type { CaseStudy } from "@/content/types";

const WORDS_PER_MINUTE = 225;

/** Word count across every prose field of a case study — decisions/results
 * labels and values are short and not prose, so only the paragraph-shaped
 * fields count toward the estimate. */
export function caseStudyReadingMinutes(study: CaseStudy): number {
  const paragraphs = [
    study.dek,
    ...study.problem,
    ...study.approach,
    ...(study.architecture?.intro ? [study.architecture.intro] : []),
    ...(study.architecture?.note ? [study.architecture.note] : []),
    ...(study.decisions?.map((d) => `${d.title} ${d.body}`) ?? []),
    ...(study.story?.body ?? []),
    ...(study.closing ?? []),
  ];
  const words = paragraphs.join(" ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
