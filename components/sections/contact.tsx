import { Mail, MapPin } from "lucide-react";
import { GithubIcon, LinkedinIcon } from "@/components/icons/brand-icons";
import { site } from "@/content/site";

export function Contact() {
  return (
    <footer id="contact" className="mx-auto w-full max-w-4xl px-6 py-16">
      <div className="flex flex-col gap-6 border-t border-border pt-10">
        <div>
          <h2 className="font-heading text-2xl font-semibold text-foreground">
            Let&apos;s talk
          </h2>
          <p className="mt-2 max-w-lg text-muted-foreground">
            Open to Senior/Principal Applied AI roles. The fastest way to reach me is email.
          </p>
        </div>

        <a
          href={`mailto:${site.email}`}
          className="w-fit text-lg font-medium text-accent hover:underline"
        >
          {site.email}
        </a>

        <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="size-4" />
            {site.location}
          </span>
          <a
            href={site.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-accent"
          >
            <GithubIcon className="size-4" />
            GitHub
          </a>
          <a
            href={site.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-accent"
          >
            <LinkedinIcon className="size-4" />
            LinkedIn
          </a>
          <a
            href={`mailto:${site.email}`}
            className="inline-flex items-center gap-1.5 hover:text-accent"
          >
            <Mail className="size-4" />
            Email
          </a>
        </div>

        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} {site.name}
        </p>
      </div>
    </footer>
  );
}
