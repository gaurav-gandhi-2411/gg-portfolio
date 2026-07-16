import { ChevronDown, ExternalLink, FileDown, Mail, MapPin } from "lucide-react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { GithubIcon, LinkedinIcon } from "@/components/icons/brand-icons";
import { aboutParagraphs, skillChips } from "@/content/about";
import { experience } from "@/content/experience";
import { now } from "@/content/now";
import { products } from "@/content/products";
import { researchPapers } from "@/content/research";
import { heroStats, site } from "@/content/site";
import type { ExperienceEntry, Product } from "@/content/types";
import { ActScrollTracker } from "./act-scroll-tracker";

/**
 * Concept C — Spatial/Narrative. One continuous scroll-driven story told in
 * five acts, all real content from content/*, never invented. The only
 * client-side logic on the page is ActScrollTracker (an IntersectionObserver
 * toggling which act is "current" so the persistent monogram can react to
 * it) — everything else, including every sticky-chapter and scroll-linked
 * effect, is plain CSS. See concept-c.css for the mechanics and
 * evolving-monogram.tsx for the signature element itself.
 */

const flagshipProducts = products.filter((product) => product.tier === "flagship");
const secondaryProducts = products.filter((product) => product.tier === "secondary");

function ActHeading({ roman, title }: { roman: string; title: string }) {
  return (
    <div className="mb-10 md:mb-16">
      <p className="cc-mono text-xs font-medium tracking-[0.3em] text-muted-foreground uppercase">
        Act {roman}
      </p>
      <h2 className="cc-display mt-2 text-4xl text-foreground italic sm:text-5xl">{title}</h2>
    </div>
  );
}

function ContactActions() {
  return (
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
  );
}

function FlagshipChapter({ index, product }: { index: number; product: Product }) {
  const num = String(index + 1).padStart(2, "0");
  return (
    <div className="grid gap-10 border-t border-border py-14 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] md:gap-16 md:border-t-0 md:py-0">
      <div className="flex flex-col gap-4 md:sticky md:top-0 md:h-screen md:justify-center motion-reduce:md:static motion-reduce:md:h-auto motion-reduce:md:py-16">
        <p className="cc-mono text-xs tracking-[0.3em] text-muted-foreground uppercase">
          Chapter {num}
        </p>
        <h3 className="cc-display text-4xl text-foreground italic sm:text-5xl">{product.name}</h3>
        {product.metric && (
          <div className="flex flex-col gap-0.5 border-t border-border pt-3">
            <span className="cc-mono text-lg font-semibold text-accent">
              {product.metric.value}
            </span>
            <span className="text-sm text-muted-foreground">{product.metric.label}</span>
          </div>
        )}
        {product.secondaryMetric && (
          <div className="flex flex-col gap-0.5">
            <span className="cc-mono text-sm font-medium text-foreground">
              {product.secondaryMetric.value}
            </span>
            <span className="text-xs text-muted-foreground">{product.secondaryMetric.label}</span>
          </div>
        )}
        <div className="flex flex-wrap gap-3 pt-2">
          {product.liveUrl && (
            <Button
              render={<a href={product.liveUrl} target="_blank" rel="noopener noreferrer" />}
              nativeButton={false}
              variant="outline"
              size="sm"
            >
              <ExternalLink className="size-3.5" />
              Live
            </Button>
          )}
          {product.repoUrl && (
            <Button
              render={<a href={product.repoUrl} target="_blank" rel="noopener noreferrer" />}
              nativeButton={false}
              variant="outline"
              size="sm"
            >
              <GithubIcon className="size-3.5" />
              Repo
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-12 py-14 motion-reduce:md:min-h-0 motion-reduce:md:justify-start motion-reduce:md:gap-12 motion-reduce:md:py-14 md:min-h-[150vh] md:justify-between md:gap-0 md:py-[14vh]">
        <p className="text-xl leading-relaxed text-foreground sm:text-2xl">{product.tagline}</p>
        {product.storyLine && (
          <blockquote className="border-l-2 border-accent/50 pl-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
            {product.storyLine.text}
          </blockquote>
        )}
        {product.techChips && (
          <div className="flex flex-wrap gap-2">
            {product.techChips.map((chip) => (
              <Badge key={chip} variant="outline" className="cc-mono text-[10px]">
                {chip}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SecondaryCard({ product }: { product: Product }) {
  return (
    <Card className="flex h-full flex-col gap-3 p-5">
      <CardHeader className="gap-1 p-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className="cc-display text-lg text-foreground not-italic">{product.name}</h4>
          <div className="flex shrink-0 gap-2">
            {product.liveUrl && (
              <a
                href={product.liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${product.name} live demo`}
                className="text-muted-foreground transition-colors hover:text-accent"
              >
                <ExternalLink className="size-4" />
              </a>
            )}
            {product.repoUrl && (
              <a
                href={product.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${product.name} GitHub repo`}
                className="text-muted-foreground transition-colors hover:text-accent"
              >
                <GithubIcon className="size-4" />
              </a>
            )}
          </div>
        </div>
        <CardDescription className="text-sm">{product.tagline}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto flex flex-col gap-3 p-0">
        {product.metric && (
          <div className="flex flex-col gap-0.5 border-t border-border pt-3">
            <span className="cc-mono text-sm font-semibold text-accent">
              {product.metric.value}
            </span>
            <span className="text-xs text-muted-foreground">{product.metric.label}</span>
          </div>
        )}
        {product.pypi && (
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <Image
              src={product.pypi.badgeUrl}
              alt={`${product.pypi.packageName} PyPI version`}
              width={100}
              height={20}
              unoptimized
            />
            <code className="cc-mono rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground">
              {product.pypi.installCommand}
            </code>
          </div>
        )}
        {product.techChips && (
          <div className="flex flex-wrap gap-1.5">
            {product.techChips.map((chip) => (
              <Badge key={chip} variant="outline" className="cc-mono text-[10px]">
                {chip}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ExperienceBlock({ entry }: { entry: ExperienceEntry }) {
  return (
    <div className="flex flex-col gap-4 border-t border-border pt-10 first:border-t-0 first:pt-0">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h3 className="cc-display text-2xl text-foreground italic">
            {entry.company}
            {entry.companyDetail && (
              <span className="ml-2 text-base text-muted-foreground not-italic">
                ({entry.companyDetail})
              </span>
            )}
          </h3>
          <p className="text-sm text-muted-foreground">{entry.location}</p>
        </div>
        <p className="cc-mono text-sm text-muted-foreground">{entry.dateRange}</p>
      </div>

      {entry.subRoles?.map((role) => (
        <div key={role.title} className="flex flex-col gap-2 border-l-2 border-border pl-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h4 className="font-medium text-foreground">{role.title}</h4>
            <p className="cc-mono text-xs text-muted-foreground">{role.dateRange}</p>
          </div>
          <ul className="flex flex-col gap-2">
            {role.bullets.map((bullet) => (
              <li key={bullet.sourceRef} className="text-sm leading-relaxed text-foreground">
                {bullet.text}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {entry.bullets && (
        <ul className="flex flex-col gap-2 border-l-2 border-border pl-5">
          {entry.bullets.map((bullet) => (
            <li key={bullet.sourceRef} className="text-sm leading-relaxed text-foreground">
              {bullet.text}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        {entry.techChips.map((chip) => (
          <Badge key={chip} variant="outline" className="cc-mono text-xs">
            {chip}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export default function ConceptCPage() {
  return (
    <ActScrollTracker>
      <main className="flex flex-1 flex-col">
        {/* Act I — Opening */}
        <section
          data-act="hero"
          className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center gap-8 px-6 py-24 md:px-12"
        >
          <div>
            <p className="cc-mono text-xs font-medium tracking-[0.3em] text-accent uppercase">
              Act I
            </p>
            <h1 className="sr-only">
              {site.name} — {site.role}. {site.tagline}
            </h1>
            <p className="cc-display mt-4 text-4xl leading-[1.05] text-foreground italic sm:text-6xl md:text-7xl">
              {site.tagline}
            </p>
          </div>

          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-status-open/40 bg-status-open-bg px-3 py-1 text-status-open">
            <span className="size-1.5 rounded-full bg-status-open" aria-hidden />
            <span className="cc-mono text-xs tracking-wide">{site.status}</span>
          </div>

          <dl className="flex w-full flex-col gap-6 border-t border-border pt-8 sm:flex-row sm:gap-10">
            {heroStats.map((stat, index) => (
              <div
                key={stat.label}
                className={
                  index > 0 ? "flex flex-col gap-1 sm:border-l sm:border-border sm:pl-10" : "flex flex-col gap-1"
                }
              >
                <dt className="sr-only">{stat.label}</dt>
                <dd className="cc-mono text-3xl font-semibold text-foreground sm:text-4xl">
                  {stat.value}
                </dd>
                <dd className="mt-1 max-w-[16rem] text-sm text-muted-foreground">{stat.label}</dd>
              </div>
            ))}
          </dl>

          <ContactActions />

          <div className="mt-4 flex items-center gap-2 text-muted-foreground">
            <ChevronDown className="size-4 animate-bounce motion-reduce:animate-none" aria-hidden />
            <p className="cc-mono text-xs tracking-[0.2em] uppercase">Scroll — five acts follow</p>
          </div>
        </section>

        {/* Act II — The Products */}
        <section
          data-act="products"
          className="mx-auto w-full max-w-6xl px-6 py-24 md:px-12 md:py-32 lg:px-20"
        >
          <ActHeading roman="II" title="The Products" />
          <p className="mb-14 max-w-2xl text-lg leading-relaxed text-muted-foreground md:mb-20">
            Three get the full chapter — the hard problem each one solved, not just the pitch.
            The rest move at a faster clip below.
          </p>

          <div className="flex flex-col gap-0">
            {flagshipProducts.map((product, index) => (
              <FlagshipChapter key={product.slug} index={index} product={product} />
            ))}
          </div>

          <div className="mt-20 border-t border-border pt-14 md:mt-28 md:pt-20">
            <h3 className="cc-mono text-xs font-medium tracking-[0.3em] text-muted-foreground uppercase">
              More Work
            </h3>
            <p className="cc-display mt-3 mb-10 text-2xl text-foreground italic sm:text-3xl">
              The rest, in brief.
            </p>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {secondaryProducts.map((product) => (
                <SecondaryCard key={product.slug} product={product} />
              ))}
            </div>
          </div>
        </section>

        {/* Act III — How I Think */}
        <section
          data-act="think"
          className="mx-auto w-full max-w-6xl px-6 py-24 md:px-12 md:py-32 lg:px-20"
        >
          <ActHeading roman="III" title="How I Think" />
          <div className="grid gap-12 md:grid-cols-[0.8fr_1.2fr] md:gap-16">
            <div className="flex flex-col gap-4 motion-reduce:md:static md:sticky md:top-24 md:self-start">
              <p className="text-lg leading-relaxed text-muted-foreground">
                Research on agent tool-use, and the same rigor carried into the day job.
              </p>
            </div>

            <div className="flex flex-col gap-16">
              <div className="flex flex-col gap-4">
                <h3 className="cc-mono text-xs font-medium tracking-[0.3em] text-muted-foreground uppercase">
                  The Research
                </h3>
                {researchPapers.map((paper) => (
                  <div key={paper.title} className="flex flex-col gap-4 border-t border-border pt-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <p className="cc-display max-w-2xl text-2xl text-foreground italic sm:text-3xl">
                        {paper.title}
                      </p>
                      <Badge variant="secondary" className="shrink-0">
                        {paper.status === "preprint-pending" ? "Preprint — pending arXiv" : "Live"}
                      </Badge>
                    </div>
                    <p className="max-w-3xl text-base leading-relaxed text-muted-foreground">
                      {paper.abstract}
                    </p>
                    <a
                      href={paper.repoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-accent hover:underline"
                    >
                      <GithubIcon className="size-3.5" />
                      Repo
                    </a>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-4">
                <h3 className="cc-mono text-xs font-medium tracking-[0.3em] text-muted-foreground uppercase">
                  About
                </h3>
                <div className="flex flex-col gap-4 border-t border-border pt-6">
                  {aboutParagraphs.map((paragraph) => (
                    <p
                      key={paragraph}
                      className="max-w-3xl text-base leading-relaxed text-foreground"
                    >
                      {paragraph}
                    </p>
                  ))}
                  <div className="flex flex-wrap gap-2 pt-2">
                    {skillChips.map((chip) => (
                      <Badge key={chip} variant="outline" className="cc-mono text-[10px]">
                        {chip}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Act IV — Track Record */}
        <section
          data-act="track"
          className="mx-auto w-full max-w-6xl px-6 py-24 md:px-12 md:py-32 lg:px-20"
        >
          <ActHeading roman="IV" title="Track Record" />
          <div className="grid gap-12 md:grid-cols-[0.8fr_1.2fr] md:gap-16">
            <div className="flex flex-col gap-4 motion-reduce:md:static md:sticky md:top-24 md:self-start">
              <p className="text-lg leading-relaxed text-muted-foreground">
                Three roles, one thread: ship rigor into production, then mentor it forward.
              </p>
            </div>
            <div className="flex flex-col gap-10">
              {experience.map((entry) => (
                <ExperienceBlock key={entry.company} entry={entry} />
              ))}
            </div>
          </div>
        </section>

        {/* Act V — Close */}
        <section
          data-act="close"
          className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-24 md:px-12 md:py-32"
        >
          <ActHeading roman="V" title="Let's Talk" />

          <div className="flex flex-col gap-2 border-t border-border pt-8">
            <p className="cc-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
              {now.date}
            </p>
            <p className="text-lg leading-relaxed text-foreground">{now.line}</p>
          </div>

          <p className="max-w-xl text-xl leading-relaxed text-muted-foreground">
            Open to Senior/Principal Applied AI roles. The fastest way to reach me is email.
          </p>

          <ContactActions />

          <div className="flex flex-wrap items-center gap-6 border-t border-border pt-8 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" />
              {site.location}
            </span>
            <a href={`mailto:${site.email}`} className="inline-flex items-center gap-1.5 hover:text-accent">
              {site.email}
            </a>
          </div>

          <p className="cc-mono text-xs text-muted-foreground">
            © {new Date().getFullYear()} {site.name} — Concept C, spatial/narrative exploration.
          </p>
        </section>
      </main>
    </ActScrollTracker>
  );
}
