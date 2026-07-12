import { ImageResponse } from "next/og";

export const alt = "Gaurav Gandhi — Senior Applied AI Scientist";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#0a0b0d";
const TEXT_HI = "#edeef0";
const TEXT_LO = "#9195a0";
const INDIGO = "#818cf8";
const STATUS_OPEN = "#34d399";

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
          padding: "72px",
        }}
      >
        <svg width="88" height="88" viewBox="0 0 64 64">
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
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div style={{ fontSize: 64, color: TEXT_HI, fontWeight: 600, letterSpacing: "-0.02em" }}>
            Gaurav Gandhi
          </div>
          <div style={{ fontSize: 32, color: TEXT_LO, fontWeight: 400 }}>
            I build and ship AI products under my own name —
          </div>
          <div style={{ fontSize: 32, color: TEXT_LO, fontWeight: 400 }}>
            and the production systems and research behind them.
          </div>
        </div>
        <div style={{ display: "flex", gap: "14px", alignItems: "center" }}>
          <div style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: STATUS_OPEN }} />
          <div style={{ fontSize: 24, color: TEXT_LO }}>Open to Senior AI/ML roles</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
