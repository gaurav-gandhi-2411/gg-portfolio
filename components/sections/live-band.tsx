import { SectionMark } from "@/components/section-mark";
import { now } from "@/content/now";
import {
  getShippingLog,
  getTracegaugeDownloads,
  getWarmerPuzzleNumber,
  type ShippingLogEntry,
} from "@/lib/live-data";

const CONVENTIONAL_PREFIXES: Record<string, string> = {
  feat: "Added",
  fix: "Fixed",
  chore: "Maintained",
  docs: "Documented",
  refactor: "Refactored",
  perf: "Improved",
  test: "Tested",
  style: "Polished",
};

function formatNowDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatRelative(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function shortRepo(fullName: string): string {
  return fullName.split("/")[1] ?? fullName;
}

/** ShippingLogEntry.detail is "merged fix/hero-stat-provenance" (or
 *  "merged PR #123" when a PR has no head ref) — turn the branch half into a
 *  plain-language sentence a non-technical visitor can read, e.g. "Fixed
 *  hero stat provenance", not a raw git ref. */
function humanizeBranch(detail: string): string {
  const branch = detail.replace(/^merged\s+/, "");
  if (branch.startsWith("PR #")) return "Shipped an update";

  const [prefix, ...rest] = branch.split("/");
  const verb = CONVENTIONAL_PREFIXES[prefix.toLowerCase()];
  const words = (verb ? rest.join("/") : branch).replace(/[-_]/g, " ").trim();
  const sentence = words.charAt(0).toUpperCase() + words.slice(1);
  return verb ? `${verb} ${sentence.toLowerCase()}` : sentence;
}

/**
 * Curated for a recruiter/founder reading this, not a raw activity dump:
 * drops automated bot/CI-maintenance branches entirely (they're real commits
 * but not narratively meaningful to a portfolio visitor), caps how many
 * entries any single repo contributes so one noisy side-project can't crowd
 * out everything else, and renders a human sentence instead of a git ref.
 */
function curateLog(entries: ShippingLogEntry[], limit: number): ShippingLogEntry[] {
  const perRepoCount = new Map<string, number>();
  const curated: ShippingLogEntry[] = [];

  for (const entry of entries) {
    if (/bot/i.test(entry.detail)) continue;
    const count = perRepoCount.get(entry.repo) ?? 0;
    if (count >= 2) continue;
    perRepoCount.set(entry.repo, count + 1);
    curated.push(entry);
    if (curated.length >= limit) break;
  }

  return curated;
}

/**
 * "00 — Live": the proof layer, typeset as a magazine data band rather than
 * a dashboard — no bordered panels, no monospace-terminal chrome. Every
 * figure here is a real build-time fetch (lib/live-data.ts, 6h ISR,
 * fail-soft); each stat/row renders only if its fetch succeeded (rule 65b —
 * absent, never faked). Replaces the wave-3 NowStrip + ShippingLog sections,
 * consolidated into one editorial unit per the wave-4 brief.
 */
export async function LiveBand() {
  const [puzzle, downloads, rawLog] = await Promise.all([
    getWarmerPuzzleNumber(),
    getTracegaugeDownloads(),
    getShippingLog(20),
  ]);
  const log = curateLog(rawLog, 5);

  const stats = [
    puzzle ? { label: "Today's Warmer puzzle", value: `#${puzzle.number}` } : null,
    downloads
      ? { label: "tracegauge downloads this week", value: downloads.lastWeek.toLocaleString() }
      : null,
  ].filter((s): s is { label: string; value: string } => s !== null);

  if (stats.length === 0 && log.length === 0) return null;

  return (
    <section id="live" className="mx-auto w-full max-w-4xl px-6 py-16">
      <SectionMark index="00" label="Live" />

      <p className="font-heading text-muted-foreground mt-6 max-w-[52ch] text-[clamp(1.125rem,2vw,1.5rem)] italic">
        {now.line}{" "}
        <span className="font-mono text-sm not-italic">— {formatNowDate(now.date)}</span>
      </p>

      {stats.length > 0 ? (
        <dl className="mt-10 grid grid-cols-1 gap-8 border-t border-border pt-8 sm:grid-cols-2">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt className="text-muted-foreground text-xs tracking-[0.3em] uppercase">
                {stat.label}
              </dt>
              <dd className="font-mono mt-2 text-3xl font-semibold text-foreground tabular-nums">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {log.length > 0 ? (
        <div className="mt-10 border-t border-border pt-8">
          <p className="text-muted-foreground text-xs tracking-[0.3em] uppercase">
            Recently shipped
          </p>
          <ul className="mt-4 flex flex-col gap-3">
            {log.map((entry) => (
              <li
                key={`${entry.repo}-${entry.date}-${entry.detail}`}
                className="flex flex-wrap items-baseline gap-x-2 text-sm"
              >
                <span className="font-heading font-semibold text-foreground">
                  {shortRepo(entry.repo)}
                </span>
                <span className="text-muted-foreground">{humanizeBranch(entry.detail)}</span>
                <span className="font-mono text-muted-foreground ml-auto text-xs">
                  {formatRelative(entry.date)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
