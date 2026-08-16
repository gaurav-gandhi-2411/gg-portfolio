"use client";

import { useEffect, useState } from "react";

// Importing from the shared module rather than gsap directly is what
// registers ScrollTrigger; the plugin is used through the tween's
// scrollTrigger config below rather than by name.
import { gsap } from "@/lib/motion/gsap";

/**
 * Marks where you are in a case study.
 *
 * The sticky list of sections was already here and already sticky; what it
 * never did was say which one you were reading, so on the pages carrying
 * most of the site's reading time it was a table of contents you navigated
 * by memory.
 *
 * Sticky positioning, not a ScrollTrigger pin. A pin wraps its target in a
 * spacer div ScrollTrigger creates and owns, which is a structural change to
 * a subtree React rendered, and that class of change is what took the site
 * down in round nine. CSS does the holding; GSAP only reports scroll
 * position.
 *
 * Renders nothing itself. The rail is server-rendered markup that this
 * drives by attribute, so the list is complete and linkable before any
 * script runs and a reader without JavaScript still gets every section.
 *
 * One trigger that computes the answer, not one trigger per section. The
 * per-section version was written first and marked the wrong entry: with
 * eight triggers each calling setState from their own onToggle, whichever
 * fired last after a scroll jump won, and that order is not the document
 * order. Asking "which heading have I most recently passed" once, from a
 * single update, has no ordering to get wrong.
 */

/** Where in the viewport a section counts as the one being read. */
const READING_LINE = 0.4;

export function CaseStudyRail({ headingIds }: { headingIds: string[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const rail = document.querySelector<HTMLElement>("[data-case-rail]");
    const article = document.querySelector<HTMLElement>("[data-case-article]");
    if (!rail || !article) return;

    const headings = headingIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    const pickActive = () => {
      const line = window.innerHeight * READING_LINE;
      let current: string | null = null;
      // The last heading whose top has crossed the line is the one being
      // read. Reading top-down means no assumption about trigger order.
      for (const el of headings) {
        if (el.getBoundingClientRect().top <= line) current = el.id;
        else break;
      }
      setActiveId(current);
    };

    const ctx = gsap.context(() => {
      gsap.to(rail, {
        "--rail-progress": 1,
        ease: "none",
        scrollTrigger: {
          trigger: article,
          start: "top 60%",
          end: "bottom bottom",
          scrub: 0.3,
          onUpdate: pickActive,
          onRefresh: pickActive,
        },
      });
    });

    pickActive();
    return () => ctx.revert();
  }, [headingIds]);

  useEffect(() => {
    const rail = document.querySelector<HTMLElement>("[data-case-rail]");
    if (!rail) return;
    rail.querySelectorAll<HTMLElement>("[data-rail-item]").forEach((item) => {
      // aria-current, not only a colour: someone moving through the rail with
      // a screen reader should know which entry is the one they are inside.
      if (item.dataset.railItem === activeId) item.setAttribute("aria-current", "true");
      else item.removeAttribute("aria-current");
    });
  }, [activeId]);

  return null;
}
