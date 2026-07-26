import { CATEGORIES } from "../../content/types";

/**
 * Wave 15 — every /projects/[category] route, derived from the real
 * CATEGORIES registry — not a hardcoded list that goes stale if a category
 * is ever added, renamed, or removed.
 */
export const categoryIds: string[] = CATEGORIES.map((c) => c.id);
