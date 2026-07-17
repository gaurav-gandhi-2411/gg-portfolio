"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Monogram } from "@/components/monogram";
import { site } from "@/content/site";
import { cn } from "@/lib/utils";

/**
 * Wave 12 — the site is multi-page now, so it gets its first persistent
 * top nav: monogram home link + four destinations. Sticky with a blur so
 * long case-study pages keep their way back; quiet enough not to compete
 * with the calm base (hairline only, no fill until scrolled content is
 * behind it — the blur handles that).
 *
 * Section links are `/#anchor` (not `#anchor`) so they work from any
 * route. Client component only for usePathname's active state; the cost
 * is a few hundred bytes against the wave-11 budget.
 */
export function SiteNav() {
  const pathname = usePathname();

  const links = [
    { href: "/#about", label: "About" },
    { href: "/#experience", label: "Experience" },
    { href: "/projects", label: "Projects", active: pathname.startsWith("/projects") },
    { href: "/#contact", label: "Contact" },
  ];

  const onCaseStudy = pathname.startsWith("/work/");

  return (
    <nav
      aria-label="Site"
      className="border-border/30 bg-background/80 sticky top-0 z-50 border-b backdrop-blur-md"
    >
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-3">
        <Link
          href="/"
          className="focus-visible:outline-ring flex items-center gap-2.5 focus-visible:outline-2 focus-visible:outline-offset-2"
          aria-label={`${site.name} — home`}
        >
          <Monogram className="size-7" />
          <span className="hidden text-sm font-medium text-foreground sm:inline">
            {site.name}
          </span>
        </Link>

        <div className="flex items-center gap-4 sm:gap-6">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={link.active || (onCaseStudy && link.label === "Projects") ? "page" : undefined}
              className={cn(
                "focus-visible:outline-ring text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none",
                link.active || (onCaseStudy && link.label === "Projects")
                  ? "text-foreground underline decoration-accent decoration-2 underline-offset-8"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
