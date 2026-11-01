import type { Product } from "../content/types.ts";

export type ProjectStatus = "Live" | "Offline" | "PyPI" | "Research";

/**
 * Direction B ("Product showcase") — derived from fields the card already
 * has, never a hand-typed label: "Offline" when a health check found the
 * product's live surface down (content/types.ts `offline`, which the type
 * makes exclusive with `liveUrl`), then "Live" over "PyPI" (a live surface
 * is the stronger claim when a project has both, e.g. AgentGauge), and
 * everything else reads as "Research" rather than inventing a status for a
 * repo-only project.
 */
export function projectStatus(product: Pick<Product, "liveUrl" | "offline" | "pypi">): ProjectStatus {
  if (product.offline) return "Offline";
  if (product.liveUrl) return "Live";
  if (product.pypi) return "PyPI";
  return "Research";
}
