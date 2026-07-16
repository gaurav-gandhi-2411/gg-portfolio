import { Mail, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GithubIcon, LinkedinIcon } from "@/components/icons/brand-icons";
import { HeroHeatToyShell } from "@/components/hero-heat-toy-shell";
import { CountUpStat } from "@/components/count-up-stat";
import { AnimatedMonogram } from "@/components/animated-monogram";
import { site, heroStats } from "@/content/site";

export function Hero() {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col items-start gap-8 px-6 pt-24 pb-16 sm:pt-32">
      <AnimatedMonogram />

      <p className="text-muted-foreground text-xs tracking-[0.35em] uppercase">
        {site.role} — {site.location}
      </p>

      <div className="flex flex-col gap-4">
        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-status-open-bg px-3 py-1 text-sm font-medium text-status-open">
          <span className="size-1.5 rounded-full bg-status-open" aria-hidden />
          {site.status}
        </div>

        <h1 className="font-heading text-[clamp(3.25rem,13vw,9.5rem)] leading-[0.85] font-black tracking-tight text-foreground">
          {site.name}
        </h1>
        <p className="font-heading max-w-2xl text-[clamp(1.25rem,2.5vw,1.75rem)] text-muted-foreground italic">
          {site.tagline}
        </p>
      </div>

      {/* Recruiter-conversion: resume is one click from the hero, before any
          scrolling is required. */}
      <div className="flex flex-wrap gap-3">
        <Button render={<a href={site.resumeUrl} download />} nativeButton={false} size="lg">
          <FileDown className="size-4" />
          Resume
        </Button>
        <Button
          render={<a href={site.githubUrl} target="_blank" rel="noopener noreferrer" />}
          nativeButton={false}
          variant="outline"
          size="lg"
        >
          <GithubIcon className="size-4" />
          GitHub
        </Button>
        <Button
          render={<a href={site.linkedinUrl} target="_blank" rel="noopener noreferrer" />}
          nativeButton={false}
          variant="outline"
          size="lg"
        >
          <LinkedinIcon className="size-4" />
          LinkedIn
        </Button>
        <Button
          render={<a href={`mailto:${site.email}`} />}
          nativeButton={false}
          variant="outline"
          size="lg"
        >
          <Mail className="size-4" />
          Email
        </Button>
      </div>

      <dl className="mt-4 grid w-full grid-cols-1 gap-6 border-t border-border pt-8 sm:grid-cols-3">
        {heroStats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1">
            <dd className="font-mono text-3xl font-semibold text-foreground">
              <CountUpStat value={stat.value} />
            </dd>
            <dt className="text-sm text-muted-foreground">{stat.label}</dt>
          </div>
        ))}
      </dl>

      <div className="w-full max-w-md border-t border-border pt-6">
        <HeroHeatToyShell />
      </div>
    </section>
  );
}
