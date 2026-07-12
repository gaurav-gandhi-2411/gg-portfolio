import Image from "next/image";
import { ExternalLink } from "lucide-react";
import { GithubIcon } from "@/components/icons/brand-icons";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { products } from "@/content/products";
import type { Product } from "@/content/types";

function ProductCard({ product, flagship }: { product: Product; flagship: boolean }) {
  return (
    <Card
      className={`flex flex-col gap-3 p-6 ${flagship ? "gap-4 p-8" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3
          className={
            flagship
              ? "font-heading text-2xl font-semibold text-foreground"
              : "font-heading text-lg font-semibold text-foreground"
          }
        >
          {product.name}
        </h3>
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

      <p className={`text-muted-foreground ${flagship ? "text-base" : "text-sm"}`}>
        {product.tagline}
      </p>

      {product.storyLine && (
        <p className="border-l-2 border-accent/40 pl-3 text-sm leading-relaxed text-foreground">
          {product.storyLine.text}
        </p>
      )}

      {product.metric && (
        <div className="mt-auto flex flex-col gap-0.5 border-t border-border pt-3">
          <span className="font-mono text-sm font-semibold text-accent">
            {product.metric.value}
          </span>
          <span className="text-xs text-muted-foreground">{product.metric.label}</span>
        </div>
      )}

      {product.secondaryMetric && (
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-sm font-medium text-foreground">
            {product.secondaryMetric.value}
          </span>
          <span className="text-xs text-muted-foreground">{product.secondaryMetric.label}</span>
        </div>
      )}

      {product.pypi && (
        <div className="mt-auto flex flex-col gap-2 border-t border-border pt-3">
          <Image
            src={product.pypi.badgeUrl}
            alt={`${product.pypi.packageName} PyPI version`}
            width={100}
            height={20}
            unoptimized
          />
          <code className="rounded-md bg-secondary px-2 py-1 font-mono text-xs text-secondary-foreground">
            {product.pypi.installCommand}
          </code>
        </div>
      )}

      {product.techChips && (
        <div className="flex flex-wrap gap-1.5">
          {product.techChips.map((chip) => (
            <Badge key={chip} variant="outline" className="font-mono text-[10px]">
              {chip}
            </Badge>
          ))}
        </div>
      )}
    </Card>
  );
}

export function Products() {
  const flagship = products.filter((p) => p.tier === "flagship");
  const secondary = products.filter((p) => p.tier === "secondary");

  return (
    <section id="products" className="mx-auto w-full max-w-4xl px-6 py-16">
      <h2 className="font-heading text-sm font-semibold tracking-widest text-accent uppercase">
        Products
      </h2>

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
        {flagship.map((product) => (
          <ProductCard key={product.slug} product={product} flagship />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {secondary.map((product) => (
          <ProductCard key={product.slug} product={product} flagship={false} />
        ))}
      </div>
    </section>
  );
}
