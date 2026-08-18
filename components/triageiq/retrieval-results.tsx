import type { RetrievalQuery } from "@/lib/triageiq-retrieval-view";

/**
 * One query's actual retrieval result: the five issues the retriever returned,
 * in its order, with the gold answer marked wherever it landed.
 *
 * Rendered by the server for visitors with no JavaScript and by the client
 * island for everyone else, from the same data, so the two cannot say
 * different things. This list, not the point cloud, is the content: the cloud
 * is a view of it, and a visitor who never gets a canvas still gets every
 * number.
 */
export function RetrievalResults({ query, topK }: { query: RetrievalQuery; topK: number }) {
  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      <p className="text-sm leading-relaxed text-foreground">
        <span className="text-muted-foreground font-mono text-caption">#{query.n}</span>{" "}
        {query.title}
      </p>

      <ol className="flex flex-col gap-[var(--space-2)]">
        {query.retrieved.map((hit) => (
          <li
            key={hit.n}
            data-gold={hit.gold ? "true" : undefined}
            className={`border-border/40 grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-baseline gap-x-[var(--space-3)] gap-y-[var(--space-1)] rounded-md border px-[var(--space-3)] py-[var(--space-2)] ${
              hit.gold ? "border-accent/50 bg-accent/10" : ""
            }`}
          >
            <span className="text-muted-foreground font-mono text-caption">{hit.rank}</span>
            {/*
              Issue titles carry paths and identifiers that no browser will
              break on its own, and this column is half a case study wide.
              Without break-words a single token like a Go import path shoves
              the rest of the row into a one-word-per-line column, which is
              what the first version of this shipped.
            */}
            <span className="min-w-0 break-words text-sm text-foreground">
              <span className="text-muted-foreground font-mono text-caption">#{hit.n}</span>{" "}
              {hit.title}
            </span>
            <span className="text-muted-foreground shrink-0 font-mono text-caption">
              {hit.score.toFixed(3)}
            </span>
            {hit.gold ? (
              <span className="text-accent col-start-2 col-end-4 font-mono text-caption">
                the one the gold set calls related
              </span>
            ) : null}
          </li>
        ))}
      </ol>

      {/*
        The one line that decides whether this whole section is honest. A
        picture of a retriever is easy to make flattering by only ever showing
        queries it got right, so where the answer actually landed is stated
        for every query, including the one where it landed outside the five
        above and the reader would otherwise never know it was missed.
      */}
      <p className="text-muted-foreground text-sm leading-relaxed">
        {query.gold_in_top_k ? (
          <>
            The issue the gold set marks as related, #{query.gold}, came back at rank{" "}
            {query.gold_rank}.
          </>
        ) : (
          <>
            Missed. The issue the gold set marks as related is #{query.gold},{" "}
            {query.gold_title.toLowerCase()}, and it came back at rank {query.gold_rank}, outside
            the {topK} shown.
          </>
        )}
      </p>
    </div>
  );
}
