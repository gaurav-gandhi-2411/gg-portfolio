import type { Metadata } from "next";
import { Fraunces, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { CommandPaletteShell } from "@/components/command-palette-shell";
import { PersonJsonLd } from "@/components/json-ld";
import "./globals.css";

// Wave 4: editorial system. Space Grotesk replaces Inter as the body/UI
// voice — pairs with Fraunces' warmth without competing with its display
// role. Fraunces stays for display type (font-heading); JetBrains Mono
// stays for tabular data figures (font-mono) — the "by the numbers" band
// and per-spread metrics.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl = "https://gaurav-gandhi.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Gaurav Gandhi — Senior Applied AI Scientist",
  description:
    "Senior Data Scientist building production GenAI systems at Uber scale (Indium/Uber AI) and shipping independent AI products and research under his own name.",
  openGraph: {
    title: "Gaurav Gandhi — Senior Applied AI Scientist",
    description:
      "Production GenAI systems at Uber scale, plus independent AI products and research.",
    url: siteUrl,
    siteName: "Gaurav Gandhi",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Gaurav Gandhi — Senior Applied AI Scientist",
    description:
      "Production GenAI systems at Uber scale, plus independent AI products and research.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${fraunces.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <head>
        <PersonJsonLd />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <CommandPaletteShell />
        <Analytics />
      </body>
    </html>
  );
}
