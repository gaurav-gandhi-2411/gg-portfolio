import { ProjectGrid } from "@/components/project-grid";
import { Section } from "@/components/section";
import { workLede } from "@/content/about";
import { liveProductCount, products } from "@/content/products";

/**
 * Wave 13 — the tiering is retired: the home Work section carries every
 * project in AI/ML-depth order with category filters, sharing one grid
 * with /projects.
 *
 * Wave 15 — the flat full-set view is replaced with a progressive-disclosure
 * tease: 4 cards per active filter (including "All"), then "See all N →" to
 * the matching /projects or /projects/[category] page. Filters stay instant;
 * the depth ordering now determines which 4 lead each view.
 */
export function Work() {
  return (
    <Section
      id="work"
      label="Work"
      width="wide"
      // Both counts derived, never hand-typed (rule 65b).
      labelNote={`${products.length} projects · ${liveProductCount(products)} live`}
      lede={workLede}
    >
      <ProjectGrid capAllAt4 />
    </Section>
  );
}
