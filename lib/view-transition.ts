"use client";

/**
 * Wave 13 — View Transitions API for client-side route changes, as a
 * progressive enhancement over the wave-12 240ms .page-enter fallback.
 *
 * The API needs the DOM update wrapped in document.startViewTransition's
 * callback, but Next's router.push resolves before the new route commits —
 * so TransitionLink parks a resolver here and app/template.tsx (which
 * mounts exactly once per route change) settles it after the new page has
 * committed. A safety timeout guarantees a slow or failed navigation can
 * never freeze the page mid-transition (the browser holds a screenshot of
 * the old page until the promise settles).
 *
 * Browsers without the API, reduced-motion visitors, and modified-key
 * clicks all take the plain Link path — TransitionLink never preventDefaults
 * for them (see components/transition-link.tsx).
 */

let settleNavigation: (() => void) | null = null;
let viaViewTransition = false;

export function beginViewTransition(navigate: () => void) {
  viaViewTransition = true;
  document.startViewTransition(() => {
    navigate();
    return new Promise<void>((resolve) => {
      settleNavigation = resolve;
      window.setTimeout(resolve, 1200);
    });
  });
}

/** Called by app/template.tsx after the new route's DOM has committed. */
export function settleViewTransition() {
  settleNavigation?.();
  settleNavigation = null;
}

/**
 * True exactly once per view-transition navigation — template.tsx uses it
 * to skip the .page-enter fallback so the two animations never stack.
 */
export function consumeViewTransitionFlag(): boolean {
  const was = viaViewTransition;
  viaViewTransition = false;
  return was;
}
