import type { Metadata } from "next";
import { aboutParagraphs, skillChips } from "@/content/about";
import { experience } from "@/content/experience";
import { now } from "@/content/now";
import { products } from "@/content/products";
import { researchPapers } from "@/content/research";
import { heroStats, site } from "@/content/site";
import {
  getRepoFreshness,
  getShippingLog,
  getTracegaugeDownloads,
  getWarmerPuzzleNumber,
  type RepoFreshness,
} from "@/lib/live-data";
import { AboutPanel } from "./about-panel";
import { BootSequence } from "./boot-sequence";
import { ExperiencePanel } from "./experience-panel";
import { FooterPanel } from "./footer-panel";
import { repoSlug } from "./format";
import { HeaderBar } from "./header-bar";
import { ReplPanel } from "./heat-toy-repl";
import { LogPanel } from "./log-panel";
import { Panel } from "./panel";
import { ProductsPanel } from "./products-panel";
import { ResearchPanel } from "./research-panel";
import { StatusPanel } from "./status-panel";

// Design exploration only — never linked from the live site nav, so keep it
// out of search indexes rather than presenting it as a real page.
export const metadata: Metadata = {
  title: "Concept B — Terminal/Systems | Gaurav Gandhi",
  description:
    "Design exploration: the portfolio reskinned as a living engineering console.",
  robots: { index: false, follow: false },
};

/** Top N most-recently-shipped repos, for the status panel's freshness feed. */
function topFreshness(
  freshness: Record<string, RepoFreshness>,
  limit: number
): { repo: string; lastCommitDate: string }[] {
  return Object.entries(freshness)
    .map(([repo, data]) => ({ repo, lastCommitDate: data.lastCommitDate }))
    .sort((a, b) => new Date(b.lastCommitDate).getTime() - new Date(a.lastCommitDate).getTime())
    .slice(0, limit);
}

export default async function ConceptBPage() {
  const repoSlugs = products
    .map((p) => repoSlug(p.repoUrl))
    .filter((s): s is string => s !== null);

  const [freshness, tracegaugeDownloads, warmerPuzzle, shippingLog] = await Promise.all([
    getRepoFreshness(repoSlugs),
    getTracegaugeDownloads(),
    getWarmerPuzzleNumber(),
    getShippingLog(6),
  ]);

  // heroStats is [products live, docs processed, cost savings]; the first is
  // superseded here by the real products.length count in the status panel.
  const [, docsProcessed, costSavings] = heroStats;

  const githubHandle = site.githubUrl.replace(/^https?:\/\/github\.com\//, "");
  const bootLines = [
    "> establishing connection...",
    "> authenticating session...",
    `> loading profile [${githubHandle}]...`,
    `> indexing ${products.length} products, ${researchPapers.length} paper${researchPapers.length === 1 ? "" : "s"}, ${experience.length} roles...`,
    "> syncing live telemetry (pypi, github, warmer)...",
    "> connection established. welcome.",
  ] as const;

  return (
    <main className="min-h-screen bg-background font-mono text-foreground">
      <BootSequence lines={bootLines}>
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6 sm:py-14">
          <HeaderBar />

          <Panel id="status" path="~/status" badge="live telemetry">
            <StatusPanel
              productsCount={products.length}
              docsStat={docsProcessed.value}
              savingsStat={costSavings.value}
              warmerPuzzle={warmerPuzzle}
              tracegaugeDownloads={tracegaugeDownloads}
              freshnessFeed={topFreshness(freshness, 5)}
              nowLine={now.line}
              nowDate={now.date}
            />
          </Panel>

          <Panel id="about" path="~/about">
            <AboutPanel paragraphs={aboutParagraphs} skills={skillChips} />
          </Panel>

          <Panel id="products" path="~/products" badge={`${products.length} indexed`}>
            <ProductsPanel
              products={products}
              freshness={freshness}
              warmerPuzzle={warmerPuzzle}
              tracegaugeDownloads={tracegaugeDownloads}
            />
          </Panel>

          <Panel id="log" path="~/log" badge="github activity">
            <LogPanel entries={shippingLog} />
          </Panel>

          <Panel id="research" path="~/research">
            <ResearchPanel papers={researchPapers} />
          </Panel>

          <Panel id="experience" path="~/experience">
            <ExperiencePanel entries={experience} />
          </Panel>

          <Panel id="repl" path="~/repl" badge="interactive">
            <ReplPanel />
          </Panel>

          <Panel id="contact" path="~/contact">
            <FooterPanel />
          </Panel>
        </div>
      </BootSequence>
    </main>
  );
}
