import "server-only";

import projectionJson from "@/content/data/triageiq-retrieval-projection.json";
import type { RetrievalProjection } from "@/lib/triageiq-retrieval-view";

export type {
  RetrievalPoint,
  RetrievalProjection,
  RetrievalQuery,
  RetrievedIssue,
} from "@/lib/triageiq-retrieval-view";

/**
 * TriageIQ's real related-issue retriever, run over a sample of its own gold
 * corpus and projected to 3D offline by
 * scripts/build_triageiq_retrieval_projection.py. Same model, same text
 * construction, same query-side instruction, same cosine ranking as
 * production; see that script's header for what is faithful and what is
 * deliberately not.
 *
 * "server-only" is load-bearing, not decoration: this is the one module that
 * holds the 38 KB projection, and importing it from a client component is a
 * build failure rather than a page that quietly got 38 KB heavier. The rules
 * both sides need live in lib/triageiq-retrieval-view.ts, which holds no data.
 */
export function getRetrievalProjection(): RetrievalProjection {
  return projectionJson as RetrievalProjection;
}
