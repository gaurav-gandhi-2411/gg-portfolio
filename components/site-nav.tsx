"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Monogram } from "@/components/monogram";
import { site } from "@/content/site";
import { gsap, ScrollTrigger } from "@/lib/motion/gsap";
import { cn } from "@/lib/utils";

/**
 * The header, rebuilt as an object on the page rather than a strip of text
 * across the top of it.
 *
 * It was a full-bleed bordered band: a hairline, a blur, and a row of links,
 * which is the default shape every framework starter ships with. It is now a
 * pill that floats clear of the edges with the page visible around it,
 * contracts as you scroll, and carries an indicator that slides between
 * sections rather than snapping an underline on and off.
 *
 * Still sticky rather than fixed, deliberately. Fixed positioning would take
 * the header out of flow and slide the top of all fourteen routes underneath
 * it, which is a layout change on every page to buy a visual effect that
 * sticky already gives: the wrapper is transparent and carries no background
 * of its own, so content scrolls behind the pill and the pill reads as
 * floating. The band still reserves its own height, so nothing else on the
 * site has to know the header changed.
 *
 * How the motion is wired, given the standing rules:
 *
 *   The contraction is a scrubbed custom property, not a toggled class. A
 *   class or a data attribute set from outside React survives a re-render
 *   only by luck, and this component re-renders on every route change
 *   because it reads usePathname; the moment React reconciles, its own
 *   className wins and the toggled state is silently gone. An inline custom
 *   property is not something React manages here, so it survives, and CSS
 *   interpolating from one number is simpler than two class states anyway.
 *
 *   The indicator is one element this component owns by ref, animated on
 *   transform alone: x for position, scaleX against a 1px base for width.
 *   Nothing is inserted, removed or reparented, which is the rule that came
 *   out of the round-nine crash. It is an underline rather than a filled
 *   chip because a rounded rectangle scaled on one axis distorts its own
 *   corner radius, and the fix for that is animating width, which is a
 *   layout property.
 *
 * Reduced motion gets the whole design and none of the movement: the pill
 * sits at its contracted size from the start, and the indicator is placed
 * rather than slid.
 */

interface NavLink {
  href: string;
  label: string;
  /** Homepage section this item tracks, if any. */
  sectionId?: string;
}

const LINKS: NavLink[] = [
  { href: "/#about", label: "About", sectionId: "about" },
  { href: "/#experience", label: "Experience", sectionId: "experience" },
  { href: "/projects", label: "Projects" },
  { href: "/#contact", label: "Contact", sectionId: "contact" },
];

/** How far you scroll before the pill is fully contracted. */
const SHRINK_DISTANCE_PX = 180;

export function SiteNav() {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const indicatorRef = useRef<HTMLSpanElement | null>(null);

  const onProjects = pathname.startsWith("/projects") || pathname.startsWith("/work/");
  const onHome = pathname === "/";

  /**
   * Which item the indicator sits under, and -1 for none, which is the top of
   * the homepage where no section is in view yet.
   *
   * Only the scroll position is state. The route half is derived during
   * render rather than pushed into state by an effect: an effect that reads
   * the route and immediately calls setState is a second render every
   * navigation for a value that was already known during the first one, and
   * it is the shape lint rightly flags as cascading renders. Deriving it is
   * both correct and shorter.
   */
  const routeIndex = onProjects ? LINKS.findIndex((l) => l.label === "Projects") : -1;
  const [readingIndex, setReadingIndex] = useState(-1);
  const activeIndex = onHome ? readingIndex : routeIndex;

  // Scroll spy, homepage only. One trigger per section, reporting which one
  // currently owns the middle of the viewport.
  useEffect(() => {
    if (!onHome) return;

    const ctx = gsap.context(() => {
      LINKS.forEach((link, index) => {
        if (!link.sectionId) return;
        const section = document.getElementById(link.sectionId);
        if (!section) return;

        ScrollTrigger.create({
          trigger: section,
          start: "top 55%",
          end: "bottom 55%",
          onToggle: (self) => {
            if (self.isActive) setReadingIndex(index);
          },
          // Leaving the last section upward should clear the indicator
          // rather than leave it stranded on whatever was last lit.
          onLeaveBack: () => {
            if (index === 0) setReadingIndex(-1);
          },
        });
      });
    });

    return () => ctx.revert();
  }, [onHome]);

  // The pill's contraction, scrubbed against the first stretch of scroll.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Composed, not flattened: reduced-motion visitors get the contracted
      // pill as their resting state rather than the expanded one frozen.
      nav.style.setProperty("--nav-shrink", "1");
      return;
    }

    const ctx = gsap.context(() => {
      gsap.to(nav, {
        "--nav-shrink": 1,
        ease: "none",
        scrollTrigger: { start: 0, end: SHRINK_DISTANCE_PX, scrub: 0.4 },
      });
    }, nav);

    return () => ctx.revert();
  }, []);

  // Slide the indicator to the active item.
  useEffect(() => {
    const list = listRef.current;
    const indicator = indicatorRef.current;
    if (!list || !indicator) return;

    const place = (animate: boolean) => {
      const active = activeIndex >= 0 ? list.querySelector<HTMLElement>(`[data-nav-item="${activeIndex}"]`) : null;
      if (!active) {
        gsap.to(indicator, { autoAlpha: 0, duration: animate ? 0.2 : 0 });
        return;
      }
      const listBox = list.getBoundingClientRect();
      const box = active.getBoundingClientRect();
      const x = box.left - listBox.left;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      gsap.to(indicator, {
        x,
        scaleX: box.width,
        autoAlpha: 1,
        duration: animate && !reduce ? 0.42 : 0,
        ease: "power3.out",
      });
    };

    place(true);

    /*
     * Re-place, without animating, when the row's own geometry changes. A
     * viewport resize or a font swap both change how wide each item is, and
     * an indicator easing toward a stale width reads as lag.
     *
     * Note what is deliberately not here. The pill contracting on scroll
     * changes its padding and moves this whole row, and an earlier version
     * observed the pill for exactly that reason, with a confident comment
     * about the bug it fixed. There was no bug. The indicator is absolutely
     * positioned inside this row and every coordinate below is measured
     * relative to the row, so when the row moves the indicator moves with it
     * and the numbers stay correct for free. The evidence for the imaginary
     * bug was a screenshot that caught the indicator mid-slide.
     */
    const observer = new ResizeObserver(() => place(false));
    observer.observe(list);
    if (document.fonts?.ready) void document.fonts.ready.then(() => place(false));

    return () => observer.disconnect();
  }, [activeIndex]);

  return (
    <nav aria-label="Site" className="site-nav" ref={navRef}>
      {/* WCAG 2.4.1: a keyboard user shouldn't tab the whole nav on all 14
          routes to reach content. */}
      <a href="#main" className="site-nav-skip">
        Skip to content
      </a>

      <div className="site-nav-pill">
        <Link href="/" className="site-nav-brand" aria-label={`${site.name}, home`}>
          <Monogram className="site-nav-mark" />
          <span className="site-nav-name">{site.name}</span>
        </Link>

        <div className="site-nav-links" ref={listRef}>
          {/* Purely decorative: the active item already says so with
              aria-current, so this must never be announced twice. */}
          <span className="site-nav-indicator" ref={indicatorRef} aria-hidden="true" />
          {LINKS.map((link, index) => {
            const isActive = index === activeIndex;
            return (
              <Link
                key={link.href}
                href={link.href}
                data-nav-item={index}
                aria-current={isActive ? "page" : undefined}
                className={cn("site-nav-link", isActive && "site-nav-link-active")}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
