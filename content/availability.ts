/**
 * Wave 16 — single source of truth for the "what I'm looking for" sentence,
 * which previously lived as separately hand-typed copies in
 * components/sections/contact.tsx and components/case-study-page.tsx's
 * "Work with me" CTA (they had already drifted to near-identical but not
 * byte-identical wording). `summary` is rendered verbatim by both; the
 * array fields are structured for future use (e.g. a badge or filter) but
 * not yet rendered anywhere.
 *
 * Not a numeric claim, so no sourceRef — matches content/site.ts's
 * `status` field, which is the same kind of one-liner and carries none
 * (rule 65b only requires sourceRef on displayed numbers/claims-with-a-
 * figure, not on role-seeking prose).
 */
export interface Availability {
  /** Short badge string — mirrors content/site.ts's `status` field. */
  status: string;
  roleTypes: string[];
  engagementTypes: string[];
  /** The full sentence, rendered verbatim in the Contact section and the case-study CTA. */
  summary: string;
}

export const availability: Availability = {
  status: "Open to Senior AI/ML roles",
  roleTypes: ["Lead Applied AI Scientist", "Senior Applied AI Scientist"],
  engagementTypes: ["Full-time roles", "Select AI/ML consulting engagements"],
  summary:
    "I'm looking for Lead or Senior Applied AI roles, and I take on select AI/ML consulting engagements.",
};
