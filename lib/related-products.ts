import type { CategoryId, Product } from "@/content/types";

const MAX_RELATED = 3;

export interface RelatedProduct {
  product: Product;
  sharedCategories: CategoryId[];
}

/**
 * Wave 16 — case-study "Related projects" rail. Every Product already
 * carries `categories` (wave 13), so relatedness is derived, not curated:
 * any project sharing at least one category with `current`, ranked by how
 * many categories it shares (most related first). `Array#sort` is
 * spec-guaranteed stable (ES2019+), so ties fall back to `all`'s original
 * order for free — no explicit tiebreaker needed.
 */
export function relatedProducts(current: Product, all: Product[]): RelatedProduct[] {
  return all
    .filter((p) => p.slug !== current.slug)
    .map((p) => ({
      product: p,
      sharedCategories: p.categories.filter((c) => current.categories.includes(c)),
    }))
    .filter((r) => r.sharedCategories.length > 0)
    .sort((a, b) => b.sharedCategories.length - a.sharedCategories.length)
    .slice(0, MAX_RELATED);
}
