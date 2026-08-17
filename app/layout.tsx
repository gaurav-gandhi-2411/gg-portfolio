import type { Metadata } from "next";
import { Fraunces, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { BootLoader } from "@/components/boot-loader";
import { ChatLauncher } from "@/components/chatbot/chat-launcher";
import { PersonJsonLd } from "@/components/json-ld";
import { ScrollDriver } from "@/components/motion/scroll-driver";
import { PointerField } from "@/components/pointer-field";
import { SiteNav } from "@/components/site-nav";
import { site } from "@/content/site";
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

const siteUrl = site.url;

// Wave 20 — SEO/social metadata audit. Title shortened from the tagline-style
// "Senior Applied AI Scientist" to the literal role pairing search and hiring
// systems match on ("Data Scientist" + "Applied AI"), and kept under the
// ~60-char <title>/og:title budget. description trimmed under the ~155-char
// meta-description/og:description budget (was 156 — one over) by dropping the
// "(Indium/Uber AI)" parenthetical, not by cutting the sentence short.
const homeTitle = "Gaurav Gandhi, Lead Data Scientist, Applied AI";
const homeDescription =
  "Lead Data Scientist heading a five-person team in Uber's AI org, plus independent AI products and research. Every number sourced.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: homeTitle,
  description: homeDescription,
  // F3 — SEO audit: every route emits its own canonical tag so search
  // engines don't fold the homepage and its query-string/trailing-slash
  // variants into ambiguous duplicates. Relative path resolves against
  // metadataBase above (rule: Next's metadata docs, generate-metadata.md).
  alternates: { canonical: "/" },
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
        {/* fix/remove-view-transitions — P0, root cause found and fixed here.
            This script used to also own #boot-loader's DOM removal (a
            fix/perf change: previously a React useEffect+setTimeout in
            components/boot-loader.tsx, moved here when that component
            became a Server Component and could no longer run client-side
            code). That `el.remove()` is what caused the sitewide crash a
            prior session misdiagnosed as View Transitions racing an async
            mount effect (components/transition-link.tsx, removed
            elsewhere in this change) — the actual mechanism is unrelated
            to View Transitions entirely:

            <BootLoader/> stays mounted in React's fiber tree for the
            lifetime of the SPA session (it's unconditional in this root
            layout, on every route). Calling the DOM's native
            `#boot-loader.remove()` from outside React deletes the node
            from the live DOM without telling React's reconciler, which
            keeps its own internal fiber-to-DOM mapping for that node
            regardless. Any *later* commit that needs to insert or remove
            a sibling within <body> (a client-side route change is exactly
            that) can then use the now-detached node as its insertBefore
            anchor, and the browser throws `NotFoundError` —
            "insertBefore ... is not a child of this node" /
            "removeChild ... is not a child of this node". This is not a
            timing race that a longer delay narrows: reproduced via
            monkey-patched Node.prototype.insertBefore/removeChild
            confirming <body> as the parent and the (already-detached)
            #boot-loader node as the stale reference, on the FIRST
            client-side navigation after ANY delay past the removal,
            fresh page load or not. The fix is to never call .remove() on
            a node React still owns: #boot-loader is `display:none` by
            default (see globals.css) and only becomes visible via the
            `html[data-boot="1"]` rule below, so simply deleting that
            data attribute after the entrance animation's fixed schedule
            is enough to hide the node forever — no DOM removal needed,
            no React-ownership conflict possible. The unused node costs a
            few hundred bytes of inert, aria-hidden, pointer-events:none
            markup for the life of the tab; that's the entire trade. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var b=location.pathname==='/'&&!matchMedia('(prefers-reduced-motion: reduce)').matches;if(b){document.documentElement.dataset.boot='1';document.addEventListener('DOMContentLoaded',function(){setTimeout(function(){delete document.documentElement.dataset.boot;},1150)})}}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <BootLoader />
        {/* Both render nothing and both no-op for reduced-motion visitors.
            One writes the shared pointer position that every layer which
            acknowledges the cursor reads; the other owns smooth scrolling
            and the single clock that scroll-linked motion runs on. They sit
            in the root layout rather than on the homepage because the header
            and the case study pages will read from the same two sources, and
            a second listener or a second clock added later is how a site
            ends up fighting itself. */}
        <PointerField />
        <ScrollDriver />
        <SiteNav />
        {children}
        <ChatLauncher />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
