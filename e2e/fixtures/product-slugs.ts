import { products } from "../../content/products";

/**
 * fix/remove-view-transitions — every case-study slug, derived from the real
 * product registry (never a hardcoded list that goes stale when a project is
 * added or removed). Used by e2e/nav-crash-regression.spec.ts to cover every
 * home/projects -> case-study route pair a real visitor could click.
 */
export const productSlugs: string[] = products.map((p) => p.slug);
