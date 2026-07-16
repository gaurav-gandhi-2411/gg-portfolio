import type { Metadata } from "next";
import { IBM_Plex_Mono, Instrument_Serif, Manrope } from "next/font/google";
import "./concept-c.css";

// Distinct type pairing from the real site's Inter/Fraunces/JetBrains Mono
// trio (rule: each concept gets its own identity). Instrument Serif's single
// elegant weight reads as "chapter title" for an Act-based narrative in a way
// Fraunces' warmer, rounder forms don't; Manrope is a cleaner, more neutral
// grotesk for long-form reading passages (storyLine text, bullets, abstract);
// IBM Plex Mono carries metrics/data the same way JetBrains Mono does on the
// real site, just visually distinct.
const instrumentSerif = Instrument_Serif({
  variable: "--cc-font-display",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--cc-font-body",
  weight: "variable",
  subsets: ["latin"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--cc-font-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Concept C — Spatial/Narrative | Gaurav Gandhi",
  description: "Design exploration — not part of the live site.",
  robots: { index: false, follow: false },
};

export default function ConceptCLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${instrumentSerif.variable} ${manrope.variable} ${ibmPlexMono.variable}`}>
      {children}
    </div>
  );
}
