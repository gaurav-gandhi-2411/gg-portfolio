import { FileDown, Mail } from "lucide-react";
import { GithubIcon, LinkedinIcon } from "@/components/icons/brand-icons";
import { site } from "@/content/site";

const NAV_ITEMS = [
  { href: "#status", label: "status" },
  { href: "#about", label: "about" },
  { href: "#products", label: "products" },
  { href: "#log", label: "log" },
  { href: "#research", label: "research" },
  { href: "#experience", label: "experience" },
  { href: "#repl", label: "repl" },
  { href: "#contact", label: "contact" },
] as const;

export function HeaderBar() {
  return (
    <header className="flex flex-col gap-4 border-b border-border pb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
            gaurav@portfolio:~$ whoami
          </p>
          <h1 className="font-mono text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {site.name}
          </h1>
          <p className="max-w-xl font-mono text-sm text-muted-foreground">{site.tagline}</p>
        </div>
        <div className="inline-flex w-fit shrink-0 items-center gap-2 rounded-md border border-status-open/30 bg-status-open-bg px-3 py-1.5 font-mono text-xs font-medium text-status-open">
          <span
            className="size-1.5 rounded-full bg-status-open animate-pulse motion-reduce:animate-none"
            aria-hidden
          />
          {site.status}
        </div>
      </div>

      <nav aria-label="Console sections" className="flex flex-wrap gap-1.5 font-mono text-xs">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="rounded-md border border-border px-2.5 py-1 text-muted-foreground transition-colors hover:border-accent/50 hover:text-accent focus-visible:border-ring focus-visible:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            ~/{item.label}
          </a>
        ))}
      </nav>

      <div className="flex flex-wrap gap-4 font-mono text-xs">
        <a
          href={site.resumeUrl}
          download
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-accent"
        >
          <FileDown className="size-3.5" /> resume.pdf
        </a>
        <a
          href={site.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-accent"
        >
          <GithubIcon className="size-3.5" /> github
        </a>
        <a
          href={site.linkedinUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-accent"
        >
          <LinkedinIcon className="size-3.5" /> linkedin
        </a>
        <a
          href={`mailto:${site.email}`}
          className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-accent"
        >
          <Mail className="size-3.5" /> {site.email}
        </a>
      </div>
    </header>
  );
}
