import {
  FileTextIcon,
  GitHubIcon,
  HuggingFaceIcon,
  LinkedInIcon,
  MailIcon,
} from "@/components/icons";
import { LinkButton } from "@/components/link-button";
import { site } from "@/content/site";
import { liveProductCount, products } from "@/content/products";
import type { Stat } from "@/content/types";

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
 * Still deliberately NOT animated: every text node renders at full
 * opacity from first paint (wave-9 axe-race lesson); the entrance feeling
 * is the boot loader's curtain reveal.
 */
export function Hero() {
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
    <header className="relative mx-auto flex w-full max-w-3xl flex-col items-center px-6 pt-20 pb-16 text-center sm:pt-28 md:pb-20">
      <div aria-hidden="true" className="hero-halo" />

      <p className="text-sm">
        <a
          href="#contact"
          className="border-border/60 bg-card/60 text-muted-foreground hover:border-accent/60 hover:text-foreground inline-flex items-center gap-2 rounded-full border px-4 py-1.5 transition-colors motion-reduce:transition-none"
        >
          <span aria-hidden="true" className="bg-accent size-1.5 rounded-full" />
          {site.status}
        </a>
      </p>

      <h1 className="font-heading text-display mt-8 max-w-[24ch] font-semibold tracking-tight text-foreground">
        I build <span className="stat-figure">AI products</span> and see them through — from
        first experiment to real users.
      </h1>

      <p className="text-muted-foreground mt-6 text-lg">
        <span className="font-medium text-foreground">{site.name}</span> · Senior Data
        Scientist — Applied AI · {site.location}
      </p>

      <p className="mt-8 flex flex-wrap justify-center gap-3">
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
          <div key={stat.sourceRef} className="flex flex-col items-center gap-1.5">
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
