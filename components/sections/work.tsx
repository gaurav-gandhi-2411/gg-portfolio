import { ProjectGrid } from "@/components/project-grid";
import { Section } from "@/components/section";
import { workLede } from "@/content/about";
import { liveProductCount, products } from "@/content/products";

/**
 * Wave 13 — the tiering (and the wave-12 five-card tease) is retired: the
 * home Work section now carries all 12 projects in AI/ML-depth order with
 * category filters, sharing one grid with /projects. Filtering 5 teaser
 * cards would have been pointless — the filters and the depth ordering
 * only mean something over the full set.
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
      <ProjectGrid />
    </Section>
  );
}
