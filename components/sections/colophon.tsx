import { GithubIcon } from "@/components/icons/brand-icons";
import { products } from "@/content/products";
import { site } from "@/content/site";

/**
 * A magazine colophon: production-detail footnotes, set quietly at the very
 * end. tracegauge lives here rather than in the secondary index — it has no
 * benchmark metric, only a `pip install`, so it gets a typographic treatment
 * built for that (a code object as a designed artifact) instead of an index
 * row that would show an install command where every other row shows a
 * number.
 */
export function Colophon() {
  const tracegauge = products.find((p) => p.slug === "tracegauge");

  return (
    <footer className="mx-auto w-full max-w-4xl px-6 py-16">
      <div className="border-border flex flex-col gap-6 border-t pt-10">
        {tracegauge?.pypi ? (
          <div className="flex flex-col gap-2">
            <p className="text-muted-foreground text-xs tracking-[0.3em] uppercase">
              Also shipped
            </p>
            <p className="text-foreground text-sm">
              <span className="font-heading font-semibold">{tracegauge.name}</span> —{" "}
              {tracegauge.tagline}
            </p>
            <code className="border-border bg-card text-foreground mt-1 w-fit rounded-md border px-3 py-1.5 font-mono text-sm">
              {tracegauge.pypi.installCommand}
            </code>
            <a
              href={tracegauge.repoUrl}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-accent mt-1 inline-flex w-fit items-center gap-1.5 text-xs uppercase transition-colors"
            >
              <GithubIcon className="size-3.5" aria-hidden />
              Source
            </a>
          </div>
        ) : null}

        <p className="text-muted-foreground text-xs">
          © {new Date().getFullYear()} {site.name}. Set in Fraunces, Space Grotesk, and
          JetBrains Mono.
        </p>
      </div>
    </footer>
  );
}
