import { ImageResponse } from "next/og";

export const alt = "Gaurav Gandhi — Senior Applied AI Scientist";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#f7f5f0";
const INK = "#14151a";
const TERRACOTTA = "#c2703a";
const INK_MUTED = "#5b5d66";

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
          backgroundColor: PAPER,
          padding: "72px",
        }}
      >
        <svg width="88" height="88" viewBox="0 0 64 64">
          <path
            d="M 35.37 41.96 A 15.50 15.50 0 1 1 35.37 22.04"
            fill="none"
            stroke={INK}
            strokeWidth="4.6"
            strokeLinecap="round"
          />
          <path
            d="M 39.00 32.00 L 30.48 32.00"
            fill="none"
            stroke={INK}
            strokeWidth="4.6"
            strokeLinecap="round"
          />
          <path
            d="M 28.63 22.04 A 15.50 15.50 0 1 1 28.63 41.96"
            fill="none"
            stroke={TERRACOTTA}
            strokeWidth="4.6"
            strokeLinecap="round"
          />
          <path
            d="M 25.00 32.00 L 33.52 32.00"
            fill="none"
            stroke={TERRACOTTA}
            strokeWidth="4.6"
            strokeLinecap="round"
          />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div style={{ fontSize: 64, color: INK, fontWeight: 600, letterSpacing: "-0.02em" }}>
            Gaurav Gandhi
          </div>
          <div style={{ fontSize: 32, color: INK_MUTED, fontWeight: 400 }}>
            Senior Applied AI Scientist — production GenAI at Uber scale,
          </div>
          <div style={{ fontSize: 32, color: INK_MUTED, fontWeight: 400 }}>
            independent AI products &amp; research.
          </div>
        </div>
        <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
          <div style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: "#3f5c46" }} />
          <div style={{ fontSize: 24, color: INK_MUTED }}>Open to Senior AI/ML roles</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
