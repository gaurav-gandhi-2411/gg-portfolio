import { Space_Grotesk } from "next/font/google";
import { aboutParagraphs, skillChips } from "@/content/about";
import { experience } from "@/content/experience";
import { now } from "@/content/now";
import { products } from "@/content/products";
import { researchPapers } from "@/content/research";
import { heroStats, site } from "@/content/site";
import { ExperienceBlock, FlagshipFeature, InlineLink, SecondaryIndex, SectionMark } from "./components";

/**
 * Concept A — Editorial/Magazine. Reuses Fraunces (already loaded globally
 * in app/layout.tsx as `font-heading`) for display type, and pairs it with a
 * freshly-loaded Space Grotesk as the single "everything else" voice —
 * dropping the site-wide Inter/JetBrains Mono duo so this concept reads as
 * its own masthead rather than a reskinned homepage.
 */
const grotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const flagshipProducts = products.filter((product) => product.tier === "flagship");
const secondaryProducts = products.filter((product) => product.tier === "secondary");
const paper = researchPapers[0];

export default function ConceptAPage() {
  return (
    <main className={`${grotesk.className} bg-background text-foreground`}>
      {/* Masthead */}
      <header className="mx-auto w-full max-w-[1700px] px-6 pt-16 pb-20 md:px-12 md:pt-24 lg:px-20">
        <div className="grid grid-cols-12 gap-x-6 gap-y-8">
          <div className="col-span-12 flex flex-wrap items-center gap-3 text-xs tracking-[0.3em] uppercase lg:col-span-3">
            <span className="border-status-open text-status-open bg-status-open-bg rounded-full border px-3 py-1 tracking-normal normal-case">
              {site.status}
            </span>
            <span className="text-muted-foreground">Vol. 01 — {site.location}</span>
          </div>
          <div className="col-span-12 lg:col-span-9">
            <p className="font-heading text-[clamp(1.5rem,3.4vw,2.5rem)] leading-none font-light italic">
              {site.role}
            </p>
            <h1 className="font-heading mt-4 text-[clamp(3.25rem,13vw,11.25rem)] leading-[0.85] font-black tracking-tight">
              {site.name}
            </h1>
          </div>
        </div>

        <div className="mt-14 grid grid-cols-12 gap-x-6 gap-y-10">
          <p className="font-heading col-span-12 max-w-[38ch] text-[clamp(1.5rem,3vw,2rem)] leading-snug lg:col-span-7 lg:col-start-4">
            {site.tagline}
          </p>
          <dl className="col-span-12 space-y-6 lg:col-span-3 lg:col-start-10">
            {heroStats.map((stat) => (
              <div key={stat.label} className="border-border border-t pt-3">
                <dt className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
                  {stat.label}
                </dt>
                <dd className="font-heading mt-1 text-3xl font-black tabular-nums">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="border-border mt-16 flex flex-wrap gap-x-8 gap-y-3 border-t pt-6 text-sm">
          <InlineLink href={`mailto:${site.email}`}>{site.email}</InlineLink>
          <InlineLink href={site.githubUrl}>GitHub</InlineLink>
          <InlineLink href={site.linkedinUrl}>LinkedIn</InlineLink>
          <InlineLink href={site.resumeUrl}>Resume</InlineLink>
        </div>
      </header>

      {/* Now strip — dispatch banner */}
      <div className="border-border border-y">
        <p className="mx-auto flex w-full max-w-[1700px] flex-wrap items-baseline gap-x-4 gap-y-1 px-6 py-4 text-sm md:px-12 lg:px-20">
          <span className="text-accent tracking-[0.2em] uppercase">Now — {now.date}</span>
          <span className="text-muted-foreground">{now.line}</span>
        </p>
      </div>

      {/* 01 — About */}
      <section className="mx-auto w-full max-w-[1700px] px-6 py-24 md:px-12 md:py-32 lg:px-20">
        <SectionMark index="01" label="About" />
        <div className="mt-14 grid grid-cols-12 gap-x-6 gap-y-10">
          <div className="col-span-12 space-y-8 lg:col-span-7 lg:col-start-4">
            {aboutParagraphs.map((paragraph, i) => (
              <p
                key={paragraph.slice(0, 24)}
                className={
                  i === 0
                    ? "font-heading text-[clamp(1.5rem,2.6vw,2.25rem)] leading-snug italic"
                    : "text-muted-foreground max-w-[68ch] text-lg leading-relaxed"
                }
              >
                {paragraph}
              </p>
            ))}
          </div>
        </div>
        <p className="text-muted-foreground border-border mt-16 flex flex-wrap gap-x-3 gap-y-2 border-t pt-8 text-xs tracking-wider uppercase">
          {skillChips.map((chip, i) => (
            <span key={chip}>
              {i > 0 ? <span aria-hidden="true"> / </span> : null}
              {chip}
            </span>
          ))}
        </p>
      </section>

      {/* 02 — Work */}
      <section className="border-border mx-auto w-full max-w-[1700px] border-t px-6 py-24 md:px-12 md:py-32 lg:px-20">
        <SectionMark index="02" label="Work" />
        <div className="mt-16 space-y-16 md:space-y-24">
          {flagshipProducts.map((product, i) => (
            <FlagshipFeature key={product.slug} product={product} order={i + 1} />
          ))}
        </div>

        <div className="mt-24">
          <p className="text-muted-foreground text-xs tracking-[0.3em] uppercase">Also shipped</p>
          <SecondaryIndex products={secondaryProducts} />
        </div>
      </section>

      {/* 03 — Research */}
      <section className="border-border mx-auto w-full max-w-[1700px] border-t px-6 py-24 md:px-12 md:py-32 lg:px-20">
        <SectionMark index="03" label="Research" />
        <div className="mt-14 grid grid-cols-12 gap-x-6 gap-y-8">
          <div className="col-span-12 lg:col-span-8 lg:col-start-3">
            <p className="text-muted-foreground text-xs tracking-[0.3em] uppercase">
              {paper.status === "preprint-pending" ? "Preprint pending" : "Published"}
            </p>
            <h3 className="font-heading mt-4 text-[clamp(2rem,4.5vw,3.75rem)] leading-[1.02] font-black">
              {paper.title}
            </h3>
            <p className="text-muted-foreground mt-8 max-w-[72ch] text-lg leading-relaxed">
              {paper.abstract}
            </p>
            <div className="mt-8 text-sm">
              <InlineLink href={paper.repoUrl}>Repository →</InlineLink>
            </div>
          </div>
        </div>
      </section>

      {/* 04 — Experience */}
      <section className="border-border mx-auto w-full max-w-[1700px] border-t px-6 py-24 md:px-12 md:py-32 lg:px-20">
        <SectionMark index="04" label="Experience" />
        <div className="mt-14">
          {experience.map((entry) => (
            <ExperienceBlock key={entry.company} entry={entry} />
          ))}
        </div>
      </section>

      {/* 05 — Contact */}
      <section className="border-border mx-auto w-full max-w-[1700px] border-t px-6 py-24 md:px-12 md:py-32 lg:px-20">
        <SectionMark index="05" label="Contact" />
        <div className="mt-14 grid grid-cols-12 gap-x-6 gap-y-10">
          <p className="font-heading col-span-12 max-w-[24ch] text-[clamp(2.5rem,6vw,5rem)] leading-[0.95] font-black lg:col-span-7">
            Let&rsquo;s build the next one.
          </p>
          <div className="col-span-12 flex flex-col gap-4 text-lg lg:col-span-4 lg:col-start-9">
            <InlineLink href={`mailto:${site.email}`}>{site.email}</InlineLink>
            <InlineLink href={site.githubUrl}>GitHub</InlineLink>
            <InlineLink href={site.linkedinUrl}>LinkedIn</InlineLink>
            <InlineLink href={site.resumeUrl}>Resume</InlineLink>
          </div>
        </div>
        <p className="text-muted-foreground border-border mt-20 border-t pt-6 text-xs tracking-[0.2em] uppercase">
          {site.name} — {site.status} — updated {now.date}
        </p>
      </section>
    </main>
  );
}
