import { cn } from "@/lib/utils";

/**
 * Wave 12 — the social/CTA button row (GG: "modern, proper buttons — not
 * text links"). Two voices: `primary` (filled accent — exactly one per
 * surface, the resume) and the default quiet bordered card. Tactile via a
 * small hover lift + border shift; no gradients, one accent (the site's
 * standing one-accent discipline).
 *
 * The resume button VIEWS the PDF in a new tab (target=_blank, no
 * `download` attribute) — GG's explicit wave-12 requirement. `sameTab`
 * covers mailto/anchor targets.
 */
export function LinkButton({
  href,
  children,
  icon,
  variant = "secondary",
  sameTab = false,
  className,
}: {
  href: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  variant?: "primary" | "secondary";
  sameTab?: boolean;
  className?: string;
}) {
  return (
    <a
      href={href}
      {...(sameTab ? {} : { target: "_blank", rel: "noreferrer" })}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium",
        "transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out",
        "hover:-translate-y-0.5 active:translate-y-0",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        variant === "primary"
          ? "bg-accent text-accent-foreground hover:shadow-card-hover"
          : "border-border/60 bg-card/60 text-foreground border hover:border-accent/60 hover:bg-card",
        className
      )}
    >
      {icon}
      {children}
    </a>
  );
}
