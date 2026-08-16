import {
  FileTextIcon,
  GitHubIcon,
  HuggingFaceIcon,
  LinkedInIcon,
  MailIcon,
} from "@/components/icons";
import { EmbeddingCloud } from "@/components/hero/embedding-cloud";
import { EmbeddingCloudStatic } from "@/components/hero/embedding-cloud-static";
import { HeroMotion } from "@/components/hero/hero-motion";
import { LinkButton } from "@/components/link-button";
import { site } from "@/content/site";
import { liveProductCount, products } from "@/content/products";
import type { Stat } from "@/content/types";
import { getEmbeddingProjection } from "@/lib/embedding-projection";

/**
 * Whole years since the first data-science role on the resume (TCS, Jul 2021,
 * per content/experience.ts dateRange and resume p.1). Computed, not
 * hand-typed, so it can never silently go stale (same drift-proofing
 * rationale as liveProductCount, see provenance.md#derived:career-years).
 */
function careerYears(): number {
  const start = Date.UTC(2021, 6, 1); // Jul 2021
  return Math.floor((Date.now() - start) / (365.25 * 24 * 3600 * 1000));
}

/**
 * The hero, rebuilt around the field instead of on top of it.
 *
 * What changed and why, since the surface looks nothing like the version
 * before it:
 *
 * The field is the page now, not a texture behind a boxed column. It was
 * previously clipped to the same max-w-3xl the copy sat in, which made it a
 * decorative panel roughly 488px wide; it is now full bleed and the copy
 * sits inside it at a different depth. The field opens around the headline
 * rather than running under it, which is both the composition and the
 * contrast guard.
 *
 * The column is left aligned. Centred copy at a 24ch measure over a centred
 * background, with five equally weighted pills underneath, is the single
 * most template-shaped arrangement on the web, and it was most of why a site
 * with real work on it read as a starter kit.
 *
 * Five buttons of identical weight became one real button and a quiet icon
 * row. If everything is emphasized then nothing is, and the resume is the
 * thing a visitor is actually here to open.
 *
 * The stats moved to the bottom edge of the first screen, so the opening
 * frame is field and headline and the numbers are what the first scroll
 * buys. They are also no longer a bordered strip, which read as a table row.
 *
 * The "Currently building: X, updated Nd ago" line is gone at GG's request.
 * lib/live-data.ts still exports getCurrentlyBuilding and is still covered
 * by its own tests; it is left in place rather than deleted with the caller,
 * since the freshness signal is likely to come back somewhere on the Work
 * grid where it has more to say.
 *
 * The headline is still not animated in any way, and this is deliberate on
 * two counts. It is the LCP element, so it paints immediately regardless of
 * what the field is doing. And it is text, which never gets held below full
 * opacity here after an axe pass once landed mid-fade and read the contrast
 * of a half-transparent heading. Everything that does animate on entrance
 * moves on transform alone.
 */
export function Hero() {
  const { points } = getEmbeddingProjection();

  const heroStats: Stat[] = [
    {
      value: String(careerYears()),
      label: "years in data science and ML",
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

  const socials = [
    { href: site.githubUrl, label: "GitHub", icon: <GitHubIcon /> },
    { href: site.linkedinUrl, label: "LinkedIn", icon: <LinkedInIcon /> },
    { href: site.huggingfaceUrl, label: "Hugging Face", icon: <HuggingFaceIcon /> },
    { href: `mailto:${site.email}`, label: "Email", icon: <MailIcon />, sameTab: true },
  ];

  return (
    <header data-hero className="hero-stage">
      {/* Far plane. Full bleed, aria-hidden, never takes the pointer. */}
      <div data-hero-plane="field" className="hero-field" aria-hidden="true">
        <div className="hero-field-fit">
          <EmbeddingCloud>
            <EmbeddingCloudStatic points={points} />
          </EmbeddingCloud>
        </div>
      </div>

      {/* Light that follows the cursor, and a vignette that keeps the field
          off the page edges so the hero reads as a volume with an inside
          rather than a texture that got cropped. Both read --mx/--my and
          cost one paint each. */}
      <div className="hero-spotlight" aria-hidden="true" />
      <div className="hero-vignette" aria-hidden="true" />
      {/* Quiet ground under the copy, on both field layers. See .hero-scrim. */}
      <div className="hero-scrim" aria-hidden="true" />

      <div data-hero-plane="content" className="hero-inner">
        <div className="hero-copy">
          <p className="hero-mask" style={{ animationDelay: "0.05s" }}>
            <a href="#contact" className="hero-status">
              <span aria-hidden="true" className="bg-status-open live-dot size-1.5 rounded-full" />
              {site.status}
            </a>
          </p>

          <h1 data-hero-headline data-hero-quiet className="hero-headline">
            I build <span className="hero-headline-accent">AI products</span> and see them
            through, from the first experiment to real users.
          </h1>

          {/* The rules between these are drawn by CSS, not by markup. At
              390px the byline stacks and the separators disappear with it;
              hand-placed ones left dashes dangling off the end of two of the
              three lines. */}
          <p data-hero-quiet className="hero-mask hero-byline" style={{ animationDelay: "0.16s" }}>
            <span className="hero-byline-name">{site.name}</span>
            <span>Senior Data Scientist, Applied AI</span>
            <span>{site.location}</span>
          </p>

          <div className="hero-actions" style={{ animationDelay: "0.24s" }}>
            <LinkButton href={site.resumeUrl} variant="primary" icon={<FileTextIcon />}>
              View Resume
            </LinkButton>
            <ul className="hero-socials">
              {socials.map((social) => (
                <li key={social.label}>
                  <a
                    href={social.href}
                    aria-label={social.label}
                    {...(social.sameTab ? {} : { target: "_blank", rel: "noreferrer" })}
                    className="hero-social"
                  >
                    {social.icon}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <dl data-hero-plane="stats" className="hero-stats">
          {heroStats.map((stat) => (
            <div key={stat.sourceRef} className="hero-stat">
              <dd className="hero-stat-figure">{stat.value}</dd>
              <dt className="hero-stat-label">{stat.label}</dt>
            </div>
          ))}
        </dl>
      </div>

      <HeroMotion />
    </header>
  );
}
