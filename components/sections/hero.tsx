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
import { MetricProvenance } from "@/components/metric-provenance";
import { experience } from "@/content/experience";
import { site } from "@/content/site";
import { headlineStats } from "@/content/stats";
import { getEmbeddingProjection } from "@/lib/embedding-projection";
import { getProvenance } from "@/lib/provenance";

/**
 * Direction B ("Product showcase") — last checked against
 * content/provenance.md's "Hero stats" table, same as headline-stats.tsx.
 */
const VERIFIED_AT = "2026-08-21";

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
 *
 * refresh-2026-09, Direction B exploration (proposal, not merged) — the copy
 * column splits into two: identity on the left (name as the LCP headline,
 * role + employer, the supporting tagline, the résumé CTA) and a bordered
 * impact panel on the right carrying two of HeadlineStats' three numbers
 * with the same MetricProvenance disclosure that component uses. The panel
 * removes those two figures from About's HeadlineStats row rather than
 * repeating them — see components/sections/about.tsx's own note — for the
 * exact reason the comment above already gives for the old stat row: two
 * places stating the same number is the mistake, not a stylistic choice.
 * Sourced from content/experience.ts (the Uber entry) and content/stats.ts,
 * never hand-typed, so this exploration can't drift from the numbers the
 * rest of the site already carries.
 */
export function Hero() {
  const { points } = getEmbeddingProjection();
  // Uber Technologies, Uber AI · via Indium Software — experience.ts's own
  // header comment: "the client first and the vendor second."
  const [employer] = experience;
  const impactStats = headlineStats.slice(0, 2);

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
        <div className="hero-split">
          {/* Identity — left. The name is the LCP element, unanimated for
              the same reason the old sentence headline was: it paints on
              the first frame regardless of what the field is doing. */}
          <div className="hero-copy">
            <p className="hero-mask" style={{ animationDelay: "0.05s" }}>
              <a href="#contact" className="hero-status">
                <span aria-hidden="true" className="bg-status-open live-dot size-1.5 rounded-full" />
                {site.status}
              </a>
            </p>

            <h1 className="hero-name">{site.name}</h1>

            <p className="hero-mask hero-role-line" style={{ animationDelay: "0.16s" }}>
              <span className="hero-role-title">{site.role}</span>
              <span className="hero-role-company">
                {employer.company}{" "}
                <span className="hero-role-detail">({employer.companyDetail})</span>
              </span>
            </p>

            <p className="hero-mask hero-tagline" style={{ animationDelay: "0.2s" }}>
              {site.tagline}
            </p>

            <div className="hero-actions" style={{ animationDelay: "0.26s" }}>
              <LinkButton href={site.resumeUrl} variant="primary" icon={<FileTextIcon />}>
                Résumé
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
                      <span aria-hidden="true" className="hero-social-tip">
                        {social.label}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Impact — right. Two of HeadlineStats' three numbers, same
              MetricProvenance disclosure component, same sourceRef-checked
              data — see this file's own header note on why About's row
              carries only the third number now. */}
          <div className="hero-mask hero-impact" style={{ animationDelay: "0.3s" }}>
            <p className="hero-impact-eyebrow">Impact</p>
            <dl className="hero-impact-stats">
              {impactStats.map((stat) => {
                const provenance = getProvenance(stat.sourceRef, undefined, VERIFIED_AT);
                return (
                  // relative: the positioning root for MetricProvenance's
                  // panel (selfAnchor={false}) — same contract as
                  // components/headline-stats.tsx's identical wrapper.
                  <div key={stat.label} className="hero-impact-stat relative">
                    <dt className="sr-only">{stat.label}</dt>
                    <dd>
                      <span className="stat-figure hero-impact-value">
                        <MetricProvenance info={provenance} label={stat.label} selfAnchor={false}>
                          {stat.value}
                        </MetricProvenance>
                      </span>
                      <span className="hero-impact-label">{stat.label}</span>
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        </div>
      </div>

      <HeroMotion />
    </header>
  );
}
