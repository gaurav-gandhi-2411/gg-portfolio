import type { Metadata } from "next";
import { Fraunces, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { BootLoader } from "@/components/boot-loader";
import { ChatLauncher } from "@/components/chatbot/chat-launcher";
import { PersonJsonLd } from "@/components/json-ld";
import { SiteNav } from "@/components/site-nav";
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

// Wave 20 — SEO/social metadata audit. Title shortened from the tagline-style
// "Senior Applied AI Scientist" to the literal role pairing search and hiring
// systems match on ("Data Scientist" + "Applied AI"), and kept under the
// ~60-char <title>/og:title budget. description trimmed under the ~155-char
// meta-description/og:description budget (was 156 — one over) by dropping the
// "(Indium/Uber AI)" parenthetical, not by cutting the sentence short.
const homeTitle = "Gaurav Gandhi — Senior Data Scientist, Applied AI";
const homeDescription =
  "Senior Data Scientist building production GenAI systems in Uber's AI org, plus independent AI products and research. Every number sourced.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: homeTitle,
  description: homeDescription,
  openGraph: {
    title: homeTitle,
    description:
      "Production GenAI systems in Uber's AI org, plus independent AI products and research.",
    url: siteUrl,
    siteName: "Gaurav Gandhi",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: homeTitle,
    description:
      "Production GenAI systems in Uber's AI org, plus independent AI products and research.",
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
        {/* Boot-loader gate — must run before first paint, hence a raw
            inline script rather than next/script. Opts INTO the entrance
            overlay (see components/boot-loader.tsx) only when JS is live
            and the visitor doesn't prefer reduced motion; no-JS and
            reduced-motion visitors never see it at all. */}
        {/* Wave 12: the entrance is scoped to the homepage — a visitor
            opening a shared /work/... link shouldn't wait through a brand
            moment before the content they were sent. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(location.pathname==='/'&&!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.dataset.boot='1'}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <BootLoader />
        <SiteNav />
        {children}
        <ChatLauncher />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
