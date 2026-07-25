"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { beginViewTransition } from "@/lib/view-transition";

/**
 * Wave 13 — a next/link that routes through the View Transitions API when
 * the browser supports it (see lib/view-transition.ts). Everything else —
 * no support, reduced motion, modified-key/middle clicks, same-path
 * anchors — falls through to the untouched Link behavior, so this is
 * strictly an enhancement layer.
 */
export function TransitionLink(props: React.ComponentProps<typeof Link>) {
  const router = useRouter();

  return (
    <Link
      {...props}
      onClick={(e) => {
        props.onClick?.(e);
        if (e.defaultPrevented) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        if (typeof props.href !== "string") return;
        if (!("startViewTransition" in document)) return;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const target = new URL(props.href, window.location.href);
        // Same-path navigations (hash/anchor/query) don't remount the route —
        // template.tsx would never settle the transition. And any hash target
        // ends in a post-commit scroll, which would fight the transition's
        // snapshot pair. Let Link handle both.
        if (target.pathname === window.location.pathname || target.hash) return;
        e.preventDefault();
        beginViewTransition(() => router.push(props.href as string));
      }}
    >
      {props.children}
    </Link>
  );
}
