import { GitMerge } from "lucide-react";
import { getShippingLog } from "@/lib/live-data";

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

export async function ShippingLog() {
  const entries = await getShippingLog(6);
  if (entries.length === 0) return null;

  return (
    <section aria-label="Recent shipping activity" className="mx-auto w-full max-w-4xl px-6 py-10">
      <h2 className="font-heading text-sm font-semibold tracking-widest text-accent uppercase">
        Shipping log
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Live from GitHub — recent activity across public repos.
      </p>
      <ul className="mt-4 flex flex-col gap-2.5">
        {entries.map((entry) => (
          <li
            key={`${entry.repo}-${entry.date}-${entry.detail}`}
            className="flex items-start gap-2.5 text-sm"
          >
            <GitMerge className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />
            <span className="text-foreground">
              <span className="font-mono text-xs text-muted-foreground">
                {shortRepo(entry.repo)}
              </span>{" "}
              — {entry.detail}
            </span>
            <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground">
              {formatRelative(entry.date)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
