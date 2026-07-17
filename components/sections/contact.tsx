import { InlineLink } from "@/components/inline-link";
import { RevealGroup } from "@/components/reveal-group";
import { Section } from "@/components/section";
import { site } from "@/content/site";

/**
 * Wave 6: Contact absorbs the colophon (tracegauge moved up into the Work
 * index where products belong). The big serif email link stays — it earned
 * its place as the page's one unmissable action.
 *
 * Wave 9: RevealGroup (mode="onview") replaces the plain wrapper — the
 * site's new default reveal pattern (GG's integration map, item 2).
 */
export function Contact() {
  return (
    <Section id="contact" label="Contact">
      <RevealGroup mode="onview" className="flex flex-col gap-6">
        <div className="flex max-w-measure flex-col gap-2">
          <p className="text-base leading-relaxed text-foreground">
            Open to Senior/Principal Applied AI roles — full-time, hiring-manager or recruiter,
            let&apos;s talk.
          </p>
          <p className="text-muted-foreground text-base leading-relaxed">
            Also open to short-term AI/ML build or advisory projects, if the scope is a good
            fit.
          </p>
        </div>

        {/* Deliberate exception to the InlineLink underline convention: at
            display size an underline reads as clutter, and this is the one
            link whose size/placement already announces it as the page's
            primary action. */}
        <a
          href={`mailto:${site.email}`}
          className="font-heading w-fit text-lead font-semibold break-all text-foreground transition-colors hover:text-accent motion-reduce:transition-none sm:text-title lg:text-heading"
        >
          {site.email}
        </a>

        <p className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <span>{site.location}</span>
          <InlineLink href={site.githubUrl} className="text-muted-foreground">
            GitHub
          </InlineLink>
          <InlineLink href={site.linkedinUrl} className="text-muted-foreground">
            LinkedIn
          </InlineLink>
        </p>
      </RevealGroup>
    </Section>
  );
}

export function Footer() {
  return (
    <footer className="mx-auto w-full max-w-5xl px-6 pt-4 pb-10">
      <p className="text-muted-foreground text-xs leading-relaxed">
        © {new Date().getFullYear()} {site.name}. Set in Fraunces, Space Grotesk, and JetBrains
        Mono. Every number on this page is derived from live data or a sourced record.
      </p>
    </footer>
  );
}
