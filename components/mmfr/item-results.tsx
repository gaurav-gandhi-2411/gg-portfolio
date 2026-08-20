import type { ItemAnchor } from "@/lib/mmfr-projection-view";

/**
 * One anchor item's actual result: the five items the fused embedding space
 * actually returned for it, in its own rank order, with whether each shares
 * the anchor's real catalogue category.
 *
 * Rendered by the server for visitors with no JavaScript and by the client
 * island for everyone else, from the same data, so the two cannot say
 * different things. This list, not the point cloud, is the content: the
 * cloud is a view of it, and a visitor who never gets a canvas still gets
 * every number.
 */
export function ItemResults({ anchor }: { anchor: ItemAnchor }) {
  const sameCategoryCount = anchor.neighbors.filter((n) => n.same_category).length;
  return (
    <div className="flex flex-col gap-[var(--space-3)]" data-anchor-id={anchor.id}>
      <p className="text-sm leading-relaxed text-foreground">
        <span className="text-muted-foreground font-mono text-caption">{anchor.category}</span>{" "}
        {anchor.title}
      </p>

      <ol className="flex flex-col gap-[var(--space-2)]">
        {anchor.neighbors.map((hit) => (
          <li
            key={hit.id}
            data-same-category={hit.same_category ? "true" : undefined}
            className={`border-border/40 grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-baseline gap-x-[var(--space-3)] gap-y-[var(--space-1)] rounded-md border px-[var(--space-3)] py-[var(--space-2)] ${
              hit.same_category ? "border-accent/50 bg-accent/10" : ""
            }`}
          >
            <span className="text-muted-foreground font-mono text-caption">{hit.rank}</span>
            <span className="min-w-0 break-words text-sm text-foreground">{hit.title}</span>
            <span className="text-muted-foreground shrink-0 font-mono text-caption">
              {hit.score.toFixed(3)}
            </span>
            <span className="text-muted-foreground col-start-2 col-end-4 font-mono text-caption">
              {hit.category}
            </span>
          </li>
        ))}
      </ol>

      {/*
        The one line that decides whether this whole section is honest. A
        picture of an item tower is easy to make flattering by only ever
        showing anchors that stayed inside their own category; how many of
        the five actually did is stated for every anchor, never left for a
        reader to count.
      */}
      <p className="text-muted-foreground text-sm leading-relaxed">
        {sameCategoryCount} of {anchor.neighbors.length} neighbors share this item&apos;s own
        catalogue category.
      </p>
    </div>
  );
}
