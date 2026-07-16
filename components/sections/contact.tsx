import { InlineLink } from "@/components/inline-link";
import { Section } from "@/components/section";
import { site } from "@/content/site";

/**
 * Wave 6: Contact absorbs the colophon (tracegauge moved up into the Work
 * index where products belong). The big serif email link stays — it earned
 * its place as the page's one unmissable action.
 */
export function Contact() {
  return (
    <Section id="contact" label="Contact">
      <div className="flex flex-col gap-6">
        <div className="flex max-w-[62ch] flex-col gap-2">
          <p className="text-base leading-relaxed text-foreground">
            Open to Senior/Principal Applied AI roles — full-time, hiring-manager or recruiter,
            let&apos;s talk.
          </p>
          <p className="text-muted-foreground text-base leading-relaxed">
            Also open to short-term AI/ML build or advisory projects, if the scope is a good
            fit.
          </p>
        </div>

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
      </div>
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
