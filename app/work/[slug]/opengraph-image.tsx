import { ImageResponse } from "next/og";
import { caseStudies } from "@/content/case-studies";
import { products } from "@/content/products";

export const alt = "Gaurav Gandhi · case study";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#0a0b0d";
const TEXT_HI = "#edeef0";
const TEXT_LO = "#9195a0";
const INDIGO = "#818cf8";

export function generateStaticParams() {
  return Object.keys(caseStudies).map((slug) => ({ slug }));
}

/**
 * Wave 15 — per-project OG image so sharing a case-study link (e.g. on
 * LinkedIn) previews with that project's own title + headline metric,
 * instead of the generic site card every /work/[slug] page fell back to
 * before this. Mirrors the site-wide app/opengraph-image.tsx's visual
 * identity (same tokens, monogram) so the two read as one family.
 */
export default async function CaseStudyOgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const study = caseStudies[slug];
  const product = products.find((p) => p.slug === slug);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: BG,
          padding: "72px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <svg width="56" height="56" viewBox="0 0 64 64">
            <path
              d="M 35.37 41.96 A 15.50 15.50 0 1 1 35.37 22.04"
              fill="none"
              stroke={TEXT_HI}
              strokeWidth="4.6"
              strokeLinecap="round"
            />
            <path
              d="M 39.00 32.00 L 30.48 32.00"
              fill="none"
              stroke={TEXT_HI}
              strokeWidth="4.6"
              strokeLinecap="round"
            />
            <path
              d="M 28.63 22.04 A 15.50 15.50 0 1 1 28.63 41.96"
              fill="none"
              stroke={INDIGO}
              strokeWidth="4.6"
              strokeLinecap="round"
            />
            <path
              d="M 25.00 32.00 L 33.52 32.00"
              fill="none"
              stroke={INDIGO}
              strokeWidth="4.6"
              strokeLinecap="round"
            />
          </svg>
          <div style={{ fontSize: 26, color: TEXT_LO }}>Gaurav Gandhi · case study</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ fontSize: 68, color: TEXT_HI, fontWeight: 600, letterSpacing: "-0.02em" }}>
            {study?.title ?? "Case study"}
          </div>
          {study?.dek && (
            <div style={{ display: "flex", fontSize: 28, color: TEXT_LO, maxWidth: "980px" }}>
              {study.dek.length > 140 ? `${study.dek.slice(0, 140)}…` : study.dek}
            </div>
          )}
        </div>

        {product?.metric && (
          <div style={{ display: "flex", alignItems: "baseline", gap: "16px" }}>
            <div style={{ fontSize: 44, color: INDIGO, fontWeight: 600, fontFamily: "monospace" }}>
              {product.metric.value}
            </div>
            <div style={{ fontSize: 24, color: TEXT_LO }}>{product.metric.label}</div>
          </div>
        )}
      </div>
    ),
    { ...size }
  );
}
