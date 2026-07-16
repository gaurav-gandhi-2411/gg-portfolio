import { cn } from "@/lib/utils";
import type { TracegaugeDownloads, WarmerPuzzleInfo } from "@/lib/live-data";
import { formatFreshness, formatIsoDate, shortRepo } from "./format";

interface FreshnessFeedItem {
  repo: string;
  lastCommitDate: string;
}

interface StatusPanelProps {
  productsCount: number;
  docsStat: string;
  savingsStat: string;
  warmerPuzzle: WarmerPuzzleInfo | null;
  tracegaugeDownloads: TracegaugeDownloads | null;
  freshnessFeed: FreshnessFeedItem[];
  nowLine: string;
  nowDate: string;
}

function Readout({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
          {label}
        </span>
        <span
          className={cn("size-1.5 shrink-0 rounded-full", ok ? "bg-status-open" : "bg-destructive/70")}
          aria-hidden="true"
        />
      </div>
      <span
        className={cn(
          "font-mono text-base font-bold sm:text-lg",
          ok ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * The console's dashboard/star panel: live telemetry (Warmer puzzle number,
 * tracegauge PyPI downloads, per-repo freshness) surfaced above the fold,
 * more prominently than on the real homepage. Every live figure fails soft
 * to an explicit "offline" readout rather than a stale or fabricated number
 * — `lib/live-data.ts` never throws, so `null`/`[]` here always means the
 * upstream fetch didn't come back in time, not "zero".
 */
export function StatusPanel({
  productsCount,
  docsStat,
  savingsStat,
  warmerPuzzle,
  tracegaugeDownloads,
  freshnessFeed,
  nowLine,
  nowDate,
}: StatusPanelProps) {
  return (
    <div className="flex flex-col gap-5">
      <p className="border-l-2 border-accent/50 pl-3 font-mono text-sm leading-relaxed text-foreground">
        <span className="text-accent">MOTD</span>{" "}
        <span className="text-muted-foreground">[{formatIsoDate(nowDate)}]</span> — {nowLine}
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Readout label="products live" value={String(productsCount)} ok />
        <Readout label="docs processed" value={docsStat} ok />
        <Readout label="cost savings" value={savingsStat} ok />
        <Readout
          label="warmer puzzle"
          value={warmerPuzzle ? `#${warmerPuzzle.number}` : "offline"}
          ok={warmerPuzzle !== null}
        />
        <Readout
          label="tracegauge / wk"
          value={tracegaugeDownloads ? tracegaugeDownloads.lastWeek.toLocaleString() : "offline"}
          ok={tracegaugeDownloads !== null}
        />
        <Readout
          label="tracegauge / mo"
          value={tracegaugeDownloads ? tracegaugeDownloads.lastMonth.toLocaleString() : "offline"}
          ok={tracegaugeDownloads !== null}
        />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-mono text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
          recent ships — per-repo freshness
        </h3>
        {freshnessFeed.length === 0 ? (
          <p className="font-mono text-xs text-muted-foreground">
            freshness feed offline — GitHub API unreachable.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {freshnessFeed.map((item) => (
              <li
                key={item.repo}
                className="flex items-center justify-between gap-3 font-mono text-xs"
              >
                <span className="truncate text-muted-foreground">{shortRepo(item.repo)}</span>
                <span className="shrink-0 text-accent">{formatFreshness(item.lastCommitDate)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
