import type { Metadata } from "next";
import { Mail, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GithubIcon, LinkedinIcon } from "@/components/icons/brand-icons";
import { AnimatedMonogram } from "@/components/animated-monogram";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: "Wave 5 hero option B — statement",
  robots: { index: false, follow: false },
};

// Wave 5 exploration — throwaway route, never merged to production.
// Option B: "Statement." Centered, work-led — the headline is what GG
// does (the existing tagline, split at its em-dash), the name demotes
// to the eyebrow. Same restrained cap (clamp(2.5rem, 5vw, 4rem)) —
// the serif goes to the statement instead of the name. Stats are
// placeholder scaffolding — GG supplies the three independent numbers
// (TODO), Uber-derived stats removed per wave-5 positioning.
const placeholderStats = [
  { value: "9", label: "live AI products shipped under my own name" },
  { value: "—", label: "TODO: independent-work stat (GG to supply)" },
  { value: "—", label: "TODO: independent-work stat (GG to supply)" },
];

const [statementLead, statementRest] = site.tagline.split(" — ");

export default function HeroOptionB() {
  return (
    <main className="flex min-h-screen flex-col">
      <section className="mx-auto flex w-full max-w-3xl flex-col items-center gap-8 px-6 pt-28 pb-24 text-center sm:pt-36">
        <AnimatedMonogram />

        <div className="flex flex-col items-center gap-5">
          <p className="text-muted-foreground text-xs tracking-[0.3em] uppercase">
            {site.name} · {site.role} · {site.location}
          </p>

          <h1 className="font-heading text-[clamp(2.5rem,5vw,4rem)] leading-[1.12] font-semibold tracking-tight text-foreground">
            {statementLead}.
          </h1>

          <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
            {statementRest.charAt(0).toUpperCase() + statementRest.slice(1)}
          </p>

          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-status-open-bg px-3 py-1 text-sm font-medium text-status-open">
            <span className="size-1.5 rounded-full bg-status-open" aria-hidden />
            {site.status}
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <Button render={<a href={site.resumeUrl} download />} nativeButton={false}>
            <FileDown className="size-4" />
            Resume
          </Button>
          <Button
            render={<a href={site.githubUrl} target="_blank" rel="noopener noreferrer" />}
            nativeButton={false}
            variant="outline"
          >
            <GithubIcon className="size-4" />
            GitHub
          </Button>
          <Button
            render={<a href={site.linkedinUrl} target="_blank" rel="noopener noreferrer" />}
            nativeButton={false}
            variant="outline"
          >
            <LinkedinIcon className="size-4" />
            LinkedIn
          </Button>
          <Button render={<a href={`mailto:${site.email}`} />} nativeButton={false} variant="outline">
            <Mail className="size-4" />
            Email
          </Button>
        </div>

        <dl className="mt-6 grid w-full grid-cols-1 gap-6 border-t border-border pt-8 sm:grid-cols-3">
          {placeholderStats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center gap-1">
              <dd className="font-mono text-2xl font-semibold text-foreground">{stat.value}</dd>
              <dt className="text-sm leading-relaxed text-muted-foreground">{stat.label}</dt>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
