import Image from "next/image";
import { Mail, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GithubIcon, LinkedinIcon } from "@/components/icons/brand-icons";
import { site, heroStats } from "@/content/site";

export function Hero() {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col items-start gap-8 px-6 pt-24 pb-16 sm:pt-32">
      <Image src="/logo-mark.svg" alt="" width={48} height={48} priority />

      <div className="flex flex-col gap-4">
        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-status-open-bg px-3 py-1 text-sm font-medium text-status-open">
          <span className="size-1.5 rounded-full bg-status-open" aria-hidden />
          {site.status}
        </div>

        <h1 className="font-heading text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">
          {site.name}
        </h1>
        <p className="max-w-2xl text-xl text-muted-foreground">{site.tagline}</p>
      </div>

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
            <dt className="sr-only">{stat.label}</dt>
            <dd className="font-mono text-3xl font-semibold text-foreground">{stat.value}</dd>
            <dd className="text-sm text-muted-foreground">{stat.label}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
