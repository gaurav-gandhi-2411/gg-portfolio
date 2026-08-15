import { ImageResponse } from "next/og";
import { getWarmupConfig, warmupConfigs } from "@/content/warmup";

export const alt = "Gaurav Gandhi — waking a project";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#0a0b0d";
const TEXT_HI = "#edeef0";
const TEXT_LO = "#9195a0";
const INDIGO = "#818cf8";

export function generateStaticParams() {
  return Object.keys(warmupConfigs).map((service) => ({ service }));
}

/**
 * F2 — the 3 /warmup/[service] pages had title/description/type/site_name
 * but no og:image, so sharing a wake-up link fell back to no preview image
 * at all. Mirrors app/work/[slug]/opengraph-image.tsx's visual identity
 * (same tokens, monogram) rather than inventing a new one.
 */
export default async function WarmupOgImage({
  params,
}: {
  params: Promise<{ service: string }>;
}) {
  const { service } = await params;
  const config = getWarmupConfig(service);

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
          <div style={{ fontSize: 26, color: TEXT_LO }}>Gaurav Gandhi</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div
            style={{
              display: "flex",
              fontSize: 60,
              color: TEXT_HI,
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            Waking {config?.name ?? "a project"}
          </div>
          <div style={{ display: "flex", fontSize: 28, color: TEXT_LO, maxWidth: "980px" }}>
            {config
              ? `${config.name} scales to zero to keep idle cost at $0 — this page wakes it and takes you there once it's ready.`
              : "Cold-start bridge page."}
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
