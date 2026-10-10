import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { experience } from "@/content/experience";
import { site } from "@/content/site";
import { headlineStats } from "@/content/stats";

export const alt = `${site.name}, ${site.role}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#0a0b0d";
const TEXT_HI = "#edeef0";
const TEXT_LO = "#9195a0";
const INDIGO = "#818cf8";
// Mirrors app/globals.css's --status-open token (BL-3a) — next/og's
// ImageResponse can't consume CSS custom properties, so this is a literal
// copy of that token's resolved value. Keep the two in sync by hand; this
// is the only other place the color is allowed to be hardcoded.
const STATUS_OPEN = "#34d399";

// Fraunces (display) and Space Grotesk (body) are the site's faces
// (app/layout.tsx, next/font). next/og's Satori renderer cannot read the
// woff2 that next/font emits, so these are static TTF instances subset to
// printable ASCII (+ e-acute): Fraunces wght 600 / opsz 144 / SOFT 0 / WONK 1
// (the .hero-name settings in app/hero.css), Space Grotesk 400 and 500.
// Composites are flattened because Satori mis-draws Fraunces' rotated-component
// "+". Licence texts (OFL) sit beside them in assets/fonts/.
const font = (file: string): Promise<Buffer> =>
  readFile(join(process.cwd(), "assets/fonts", file));
const [frauncesSemiBold, groteskRegular, groteskMedium] = await Promise.all([
  font("Fraunces-SemiBold-subset.ttf"),
  font("SpaceGrotesk-Regular-subset.ttf"),
  font("SpaceGrotesk-Medium-subset.ttf"),
]);

// Same sources the hero renders from (components/sections/hero.tsx): the
// first two headlineStats, the first experience entry, site.tagline. Nothing
// here is typed by hand, so the card cannot drift from the page.
const [employer] = experience;
const impactStats = headlineStats.slice(0, 2);

export default function OgImage() {
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
          fontFamily: "Space Grotesk",
          padding: "56px 64px",
        }}
      >
        <svg width="72" height="72" viewBox="0 0 64 64">
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
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "980px" }}>
          <div
            style={{
              fontFamily: "Fraunces",
              fontSize: 84,
              color: TEXT_HI,
              fontWeight: 600,
              letterSpacing: "-0.022em",
              lineHeight: 1,
            }}
          >
            {site.name}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ fontSize: 34, color: TEXT_HI, fontWeight: 500 }}>{site.role}</div>
            <div style={{ fontSize: 26, color: TEXT_LO }}>
              {`${employer.company} (${employer.companyDetail})`}
            </div>
          </div>
          <div style={{ fontSize: 26, color: TEXT_LO, lineHeight: 1.35 }}>{site.tagline}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", gap: "40px" }}>
            {impactStats.map((stat) => (
              <div
                key={stat.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  width: "300px",
                  paddingLeft: "20px",
                  borderLeft: `3px solid ${INDIGO}`,
                }}
              >
                <div
                  style={{
                    fontFamily: "Fraunces",
                    fontSize: 56,
                    color: TEXT_HI,
                    fontWeight: 600,
                    lineHeight: 1,
                  }}
                >
                  {stat.value}
                </div>
                <div style={{ fontSize: 20, color: TEXT_LO, lineHeight: 1.3 }}>{stat.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", alignItems: "flex-end" }}>
            <div
              style={{
                display: "flex",
                fontSize: 24,
                color: TEXT_HI,
                border: `2px solid ${TEXT_LO}`,
                borderRadius: 999,
                padding: "8px 22px",
              }}
            >
              Résumé
            </div>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <div style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: STATUS_OPEN }} />
              <div style={{ fontSize: 22, color: TEXT_LO }}>{site.status}</div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Fraunces", data: frauncesSemiBold, style: "normal", weight: 600 },
        { name: "Space Grotesk", data: groteskRegular, style: "normal", weight: 400 },
        { name: "Space Grotesk", data: groteskMedium, style: "normal", weight: 500 },
      ],
    }
  );
}
