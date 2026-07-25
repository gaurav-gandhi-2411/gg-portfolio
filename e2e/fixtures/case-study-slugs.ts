import { caseStudies } from "../../content/case-studies/index";

/**
 * Every /work/[slug] route, derived from the real registry — not a
 * hardcoded list that goes stale the next time a project is added (e.g.
 * reclaim, added this wave) or removed.
 */
export const caseStudySlugs: string[] = Object.keys(caseStudies);
