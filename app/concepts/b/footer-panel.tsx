import { Mail, MapPin } from "lucide-react";
import { GithubIcon, LinkedinIcon } from "@/components/icons/brand-icons";
import { site } from "@/content/site";

export function FooterPanel() {
  return (
    <div className="flex flex-col gap-4">
      <p className="font-mono text-sm text-foreground">
        <span className="text-accent">$</span> open to Senior/Principal Applied AI roles — fastest
        path is email.
      </p>
      <a
        href={`mailto:${site.email}`}
        className="w-fit font-mono text-base font-semibold text-accent hover:underline"
      >
        {site.email}
      </a>
      <div className="flex flex-wrap items-center gap-5 font-mono text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="size-3.5" />
          {site.location}
        </span>
        <a
          href={site.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 hover:text-accent"
        >
          <GithubIcon className="size-3.5" />
          github
        </a>
        <a
          href={site.linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 hover:text-accent"
        >
          <LinkedinIcon className="size-3.5" />
          linkedin
        </a>
        <a
          href={`mailto:${site.email}`}
          className="inline-flex items-center gap-1.5 hover:text-accent"
        >
          <Mail className="size-3.5" />
          email
        </a>
      </div>
      <p className="font-mono text-[11px] text-muted-foreground">
        © {new Date().getFullYear()} {site.name} — design exploration: concept B (terminal/systems)
      </p>
    </div>
  );
}
