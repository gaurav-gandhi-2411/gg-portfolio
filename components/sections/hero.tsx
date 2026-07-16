import { Mail, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GithubIcon, LinkedinIcon } from "@/components/icons/brand-icons";
import { CountUpStat } from "@/components/count-up-stat";
import { AnimatedMonogram } from "@/components/animated-monogram";
import { site, heroStats } from "@/content/site";

/**
 * Wave 5 "byline" hero (option A, ratified by GG from the explore-branch
 * renders): left-aligned, name-led, capped at --text-display (40-64px vs.
 * the retired 180px). The tagline speaks in the body voice, not display
 * italic; the heat toy moved down to the Work section where Warmer gives
 * it context; stats are independent-work numbers only (employer figures
 * live in Experience).
 */
export function Hero() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col items-start gap-8 px-6 pt-28 pb-16 sm:pt-36 md:pb-24">
      <AnimatedMonogram />

      <div className="flex flex-col gap-5">
        <p className="text-muted-foreground text-xs tracking-eyebrow uppercase">
          {site.role} — {site.location}
        </p>

        <h1 className="font-heading text-display font-semibold tracking-tight text-foreground">
          {site.name}
        </h1>

        <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">{site.tagline}</p>

        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-status-open-bg px-3 py-1 text-sm font-medium text-status-open">
          <span className="size-1.5 rounded-full bg-status-open" aria-hidden />
          {site.status}
        </div>
      </div>

      {/* Recruiter-conversion: resume is one click from the hero, before any
          scrolling is required. */}
      <div className="flex flex-wrap gap-3">
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
        {heroStats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1">
            <dd className="font-mono text-lead font-semibold text-foreground">
              <CountUpStat value={stat.value} />
            </dd>
            <dt className="text-sm leading-relaxed text-muted-foreground">{stat.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}
