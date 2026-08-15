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
let currentTransition: ViewTransition | null = null;

export function beginViewTransition(navigate: () => void) {
  viaViewTransition = true;
  const transition = document.startViewTransition(() => {
    navigate();
    return new Promise<void>((resolve) => {
      settleNavigation = resolve;
      window.setTimeout(resolve, 1200);
    });
  });
  currentTransition = transition;
  transition.finished.finally(() => {
    if (currentTransition === transition) currentTransition = null;
  });
}

/**
 * perf/lcp-final Task 4 — resolves once any in-flight View Transition (see
 * beginViewTransition above) has fully FINISHED, including its animation —
 * not just its DOM-update callback, which settleNavigation resolves earlier.
 *
 * Exists because a component that does an async, DOM-mutating mount effect
 * on the destination page of a transition (a capability check that flips
 * visible state, an IntersectionObserver's first callback firing on an
 * already-intersecting target) can land inside the exact window where the
 * browser is still mid-capture of the transition's "new" DOM snapshot —
 * reproduced as a real, unrecoverable crash: Chromium throws "Failed to
 * execute 'insertBefore'/'removeChild' on 'Node': ... is not a child of this
 * node" when React commits a DOM mutation in that window, which the app's
 * error boundary then shows as "This page couldn't load". A guessed fixed
 * delay (requestAnimationFrame, even a macrotask) narrows the race but does
 * not close it under real timing variance (still reproduced under
 * `npx playwright test`'s full parallel load after a macrotask-only fix) —
 * awaiting the transition's own `finished` promise is the actual signal,
 * not a guess. Resolves immediately if no transition is in flight (every
 * other navigation path: hard reload, reduced-motion, unsupported browser).
 */
export function waitForViewTransition(): Promise<void> {
  return currentTransition ? currentTransition.finished.catch(() => undefined) : Promise.resolve();
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
