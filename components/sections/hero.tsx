import {
  FileTextIcon,
  GitHubIcon,
  HuggingFaceIcon,
  LinkedInIcon,
  MailIcon,
} from "@/components/icons";
import { EmbeddingCloud } from "@/components/hero/embedding-cloud";
import { EmbeddingCloudStatic } from "@/components/hero/embedding-cloud-static";
import { LinkButton } from "@/components/link-button";
import { site } from "@/content/site";
import { liveProductCount, products } from "@/content/products";
import type { Stat } from "@/content/types";
import { getEmbeddingProjection } from "@/lib/embedding-projection";
import { getCurrentlyBuilding } from "@/lib/live-data";

/**
 * Whole years since the first data-science role on the resume (TCS, Jul 2021
 * — content/experience.ts dateRange, resume p.1). Computed, not hand-typed,
 * so it can never silently go stale (same drift-proofing rationale as
 * liveProductCount — see provenance.md#derived:career-years).
 */
function careerYears(): number {
  const start = Date.UTC(2021, 6, 1); // Jul 2021
  return Math.floor((Date.now() - start) / (365.25 * 24 * 3600 * 1000));
}

/** Whole days since an ISO timestamp — matches lib/project-display.ts's freshness math. */
function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

/**
 * Wave 12 hero. The h1 is now the tagline (maninder's structural pattern:
 * the statement leads, the name sits in the byline and the nav); the
 * wave-10-approved warm voice carries over — this is that paragraph's
 * first sentence, tightened into a headline.
 *
 * Stats (wave-12 brief): "5 people I lead" is retired from the hero — it
 * contradicts the independent-builder positioning as a headline (it stays
 * in About/Experience where it's employment context). The third axis is
 * the resume-sourced Uber corpus scale, the one number of GG's that
 * honestly supports scale language (resume:indium-ds-docunderstanding).
 *
 * Background is the real embedding-space hero (components/hero/embedding-cloud-static.tsx)
 * -- replaces the wave-11 gradient .hero-halo outright rather than running
 * alongside it: two independently-animated ambient background layers read
 * as busier than either alone, and the brief for this one was explicit
 * that noticing the animation before the text is a failure.
 *
 * The background now has an ambient WebGL layer, chosen per device by
 * components/hero/embedding-cloud.tsx; the static SVG above stays as the
 * server-rendered default and the fallback for everyone else.
 *
 * The earlier attempt at this was abandoned for two reasons, both since
 * addressed rather than argued with. It used @react-three/fiber, whose
 * Canvas/BufferGeometry/PointsMaterial chunk alone measured 233.6KB gzip —
 * irreducible, r3f's own baseline rather than anything that build added — so
 * this one is hand-rolled WebGL1 (lib/webgl/point-cloud.ts) with no new
 * dependencies. And it animated continuously from load, which is what put the
 * cost inside Lighthouse's Total Blocking Time window; this one defers its
 * first frame past the load rush, caps itself to 30fps, and stops outright
 * when the tab is hidden or the hero scrolls away.
 *
 * The TEXT is still deliberately not animated: every text node renders at
 * full opacity from first paint (wave-9 axe-race lesson), the entrance
 * feeling is the boot loader's curtain reveal, and the brief for the
 * background was explicit that noticing it before the text is a failure —
 * hence a ~5-minute revolution and no alpha lift on an already-faint ramp.
 */
export async function Hero() {
  const currentlyBuilding = await getCurrentlyBuilding();
  const { points } = getEmbeddingProjection();

  const heroStats: Stat[] = [
    {
      value: String(careerYears()),
      label: "years in data science & ML",
      sourceRef: "derived:career-years",
    },
    {
      value: String(liveProductCount(products)),
      label: "AI products live today",
      sourceRef: "derived:products-live-count",
    },
    {
      value: "50M+",
      label: "documents behind the Uber doc-AI I helped build",
      sourceRef: "resume:indium-ds-docunderstanding",
    },
  ];

  return (
    <header className="relative mx-auto flex w-full max-w-3xl flex-col items-center px-[var(--space-6)] pt-20 pb-16 text-center sm:pt-28 md:pb-[var(--space-20)]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <EmbeddingCloud>
          <EmbeddingCloudStatic points={points} />
        </EmbeddingCloud>
      </div>

      {/* BL-3a: this pill already carried the availability copy (site.status);
          it now also carries the actual status signal, via --status-open
          (app/globals.css) rather than the generic accent color, so it
          reads as a live status dot and not just another link. Same
          live-pulse class the "AI products live today" dateline uses
          (globals.css .live-dot) — this is the same kind of "this is
          current, not a stale fact" signal, so it gets the same motion
          language rather than a bespoke one. */}
      <p className="text-sm">
        <a
          href="#contact"
          className="border-border/60 bg-card/60 text-muted-foreground hover:border-accent/60 hover:text-foreground inline-flex min-h-11 items-center gap-[var(--space-2)] rounded-full border px-[var(--space-4)] py-[var(--space-1-5)] transition-colors motion-reduce:transition-none"
        >
          <span aria-hidden="true" className="bg-status-open live-dot size-1.5 rounded-full" />
          {site.status}
        </a>
      </p>

      <h1 className="font-heading text-display mt-[var(--space-8)] max-w-[24ch] font-semibold tracking-tight text-foreground">
        I build <span className="stat-figure">AI products</span> and see them through — from
        first experiment to real users.
      </h1>

      {currentlyBuilding && (
        <p className="text-muted-foreground mt-[var(--space-4)] text-sm">
          Currently building:{" "}
          <span className="font-medium text-foreground">{currentlyBuilding.name}</span> · updated{" "}
          <span className="font-mono">{daysSince(currentlyBuilding.pushedAt)}d</span> ago
        </p>
      )}

      <p className="text-muted-foreground mt-[var(--space-6)] text-body-lg">
        <span className="font-medium text-foreground">{site.name}</span> · Senior Data
        Scientist — Applied AI · {site.location}
      </p>

      <p className="mt-[var(--space-8)] flex flex-wrap justify-center gap-[var(--space-3)]">
        {/* Views the PDF in a new tab — never a forced download (wave 12). */}
        <LinkButton href={site.resumeUrl} variant="primary" icon={<FileTextIcon />}>
          View Resume
        </LinkButton>
        <LinkButton href={site.githubUrl} icon={<GitHubIcon />}>
          GitHub
        </LinkButton>
        <LinkButton href={site.linkedinUrl} icon={<LinkedInIcon />}>
          LinkedIn
        </LinkButton>
        <LinkButton href={site.huggingfaceUrl} icon={<HuggingFaceIcon />}>
          Hugging Face
        </LinkButton>
        <LinkButton href={`mailto:${site.email}`} sameTab icon={<MailIcon />}>
          Email
        </LinkButton>
      </p>

      <dl className="border-border/40 mt-14 grid w-full max-w-2xl grid-cols-1 gap-x-8 gap-y-6 border-t pt-8 sm:grid-cols-3">
        {heroStats.map((stat) => (
          <div key={stat.sourceRef} className="flex flex-col items-center gap-[var(--space-1-5)]">
            <dd className="stat-figure font-mono text-heading font-medium">{stat.value}</dd>
            <dt className="text-muted-foreground max-w-[22ch] text-sm leading-snug">
              {stat.label}
            </dt>
          </div>
        ))}
      </dl>
    </header>
  );
}
