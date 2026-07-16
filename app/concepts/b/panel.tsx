import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PanelProps {
  id?: string;
  /** Window-title-style path, e.g. "~/products". Rendered as the panel's h2. */
  path: string;
  /** Small right-aligned readout badge in the title bar, e.g. "9 indexed". */
  badge?: string;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

function labelFromPath(path: string): string {
  return path.replace(/^~\//, "") || path;
}

/**
 * Terminal-multiplexer-style panel chrome: a title bar styled like a window
 * path (e.g. "~/products") that doubles as the section's heading, plus a
 * bordered body. Pure presentational — no client-only behavior — so it
 * composes inside both server sections and the client-rendered REPL panel.
 */
export function Panel({ id, path, badge, children, className, bodyClassName }: PanelProps) {
  return (
    <section
      id={id}
      aria-label={labelFromPath(path)}
      className={cn("rounded-lg border border-border bg-card", className)}
    >
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="size-2 rounded-full border border-border" />
          <span className="size-2 rounded-full border border-border" />
          <span className="size-2 rounded-full border border-border" />
        </span>
        <h2 className="font-mono text-xs font-semibold tracking-wide text-muted-foreground">
          {path}
        </h2>
        {badge && (
          <span className="ml-auto rounded-sm border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {badge}
          </span>
        )}
      </div>
      <div className={cn("p-5 sm:p-6", bodyClassName)}>{children}</div>
    </section>
  );
}
