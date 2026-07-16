import { MapPin } from "lucide-react";
import { GithubIcon, LinkedinIcon } from "@/components/icons/brand-icons";
import { SectionMark } from "@/components/section-mark";
import { site } from "@/content/site";

export function Contact() {
  return (
    <section id="contact" className="mx-auto w-full max-w-4xl px-6 py-16 md:py-24">
      <SectionMark index="05" label="Contact" />

      <div className="mt-10 flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <p className="text-lg text-foreground">
            Open to Senior/Principal Applied AI roles — full-time, hiring-manager or recruiter,
            let&apos;s talk.
          </p>
          <p className="text-muted-foreground text-lg">
            Also open to short-term AI/ML build or advisory projects, if the scope is a good fit.
          </p>
        </div>

        {/* The one unmissable action on the page. */}
        <a
          href={`mailto:${site.email}`}
          className="font-heading w-fit break-all text-heading font-semibold text-foreground transition-colors hover:text-accent"
        >
          {site.email}
        </a>

        <div className="border-border flex flex-wrap items-center gap-6 border-t pt-6 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-4" />
            {site.location}
          </span>
          <a
            href={site.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent inline-flex items-center gap-1.5"
          >
            <GithubIcon className="size-4" />
            GitHub
          </a>
          <a
            href={site.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-accent inline-flex items-center gap-1.5"
          >
            <LinkedinIcon className="size-4" />
            LinkedIn
          </a>
        </div>
      </div>
    </section>
  );
}
