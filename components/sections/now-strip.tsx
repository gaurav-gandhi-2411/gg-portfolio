import { now } from "@/content/now";

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function NowStrip() {
  return (
    <div className="mx-auto w-full max-w-4xl px-6">
      <div className="flex flex-col gap-1 border-t border-border py-4 sm:flex-row sm:items-baseline sm:gap-3">
        <span className="shrink-0 font-mono text-xs tracking-wide text-accent uppercase">
          Now — {formatDate(now.date)}
        </span>
        <p className="text-sm text-muted-foreground">{now.line}</p>
      </div>
    </div>
  );
}
