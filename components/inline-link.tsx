import { cn } from "@/lib/utils";

/**
 * The site's one link treatment (wave 6): underlined text, muted underline
 * shifting to accent on hover/focus. External links open in a new tab by
 * default; pass `sameTab` for mailto/anchors and `download` for the resume.
 *
 * Round 3 (GG): "scroll and transition feel dated" — every inline link on
 * the site (prose, citations, arXiv/repo links) was fading its underline on
 * Tailwind's bare default curve; now the site's own --ease-out-soft, same
 * as every other hover treatment.
 */
export function InlineLink({
  href,
  children,
  className,
  sameTab = false,
  download = false,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
  sameTab?: boolean;
  download?: boolean;
}) {
  return (
    <a
      href={href}
      {...(sameTab || download ? {} : { target: "_blank", rel: "noreferrer" })}
      {...(download ? { download: true } : {})}
      className={cn(
        "text-foreground decoration-border underline decoration-1 underline-offset-4",
        "transition-colors duration-[var(--dur-base)] ease-[var(--ease-out-soft)] hover:decoration-accent focus-visible:decoration-accent",
        "motion-reduce:transition-none",
        className
      )}
    >
      {children}
    </a>
  );
}
