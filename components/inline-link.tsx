import { cn } from "@/lib/utils";

/** External text link whose underline shifts from muted to accent on hover/focus. */
export function InlineLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "text-foreground decoration-border underline decoration-1 underline-offset-4",
        "transition-colors duration-300 hover:decoration-accent focus-visible:decoration-accent",
        "motion-reduce:transition-none",
        className
      )}
    >
      {children}
    </a>
  );
}
