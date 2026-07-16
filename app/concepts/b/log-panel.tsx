import { GitMerge } from "lucide-react";
import type { ShippingLogEntry } from "@/lib/live-data";
import { formatLogDate, shortRepo } from "./format";

/**
 * Shipping log styled as a `git log --oneline` / journal tail rather than
 * the real homepage's simple list. `getShippingLog` fails soft to `[]` on
 * fetch failure or when there's genuinely nothing to show — the two aren't
 * distinguishable from its return type, so the empty state is phrased
 * neutrally rather than asserting "offline".
 */
export function LogPanel({ entries }: { entries: ShippingLogEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="font-mono text-xs text-muted-foreground">
        <span className="text-accent">$</span> git log --oneline --merges -6 --all-repos
        <br />
        no recent merge events in the public activity feed.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="mb-2 font-mono text-xs text-muted-foreground">
        <span className="text-accent">$</span> git log --oneline --merges -6 --all-repos
      </p>
      <ul className="flex flex-col gap-1.5 font-mono text-xs">
        {entries.map((entry) => (
          <li
            key={`${entry.repo}-${entry.date}-${entry.detail}`}
            className="flex items-center gap-2.5 rounded-sm px-2 py-1.5 odd:bg-background/60"
          >
            <GitMerge className="size-3.5 shrink-0 text-accent" aria-hidden />
            <span className="shrink-0 text-muted-foreground">{shortRepo(entry.repo)}</span>
            <span className="truncate text-foreground">{entry.detail}</span>
            <span className="ml-auto shrink-0 text-muted-foreground">
              {formatLogDate(entry.date)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
