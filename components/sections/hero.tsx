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
import { getEmbeddingProjection } from "@/lib/embedding-projection";

/**
 * The hero, rebuilt around the field instead of on top of it.
 *
 * What changed and why, since the surface looks nothing like the version
 * before it:
 *
 * The field is the page now, not a texture behind a boxed column. It was
 * previously clipped to the same max-w-3xl the copy sat in, which made it a
 * decorative panel roughly 488px wide; it is now full bleed and the copy
 * sits inside it at a different depth, over a scrim that gives the words a
 * quiet ground without taking the field away from them.
 *
 * An earlier version also had the field open around the headline from inside
 * the shader, measuring the copy's bounding box and pushing points out of a
 * zone around it. That is gone. Tested against the scrim alone it earned
 * almost nothing: the headline's worst-case contrast moved from 4.31:1 to
 * 4.70:1 against a 3:1 requirement, and the two compositions were near
 * indistinguishable side by side, because the scrim had already quietened
 * exactly the region the parting was quietening again. It was costing shader
 * work and, worse, coupling a decorative layer to the copy's measured
 * geometry, which is the kind of link that silently goes wrong the next time
 * the layout moves. The scrim has no such coupling.
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
 * The stat row that used to sit at the bottom edge of the hero — years in
 * data science, live product count, and a duplicate of the 50M+ doc-AI
 * figure — is gone as of GG's launch review. It was meant to be replaced by
 * HeadlineStats' $10M+/~70%/50M+ row (components/headline-stats.tsx,
 * rendered above the About prose), not to sit alongside it; having both live
 * put two stat rows on the same page, one of them repeating "50M+" under a
 * different label, which reads as a mistake because it is one. See
 * provenance.md's "Hero stats" table for both retirement notes.
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

          <h1 className="hero-headline">
            I build <span className="hero-headline-accent">AI products</span> and see them
            through, from the first experiment to real users.
          </h1>

          {/* The rules between these are drawn by CSS, not by markup. At
              390px the byline stacks and the separators disappear with it;
              hand-placed ones left dashes dangling off the end of two of the
              three lines. */}
          <p className="hero-mask hero-byline" style={{ animationDelay: "0.16s" }}>
            <span className="hero-byline-name">{site.name}</span>
            <span>Lead Data Scientist, Applied AI</span>
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
      </div>

      <HeroMotion />
    </header>
  );
}
