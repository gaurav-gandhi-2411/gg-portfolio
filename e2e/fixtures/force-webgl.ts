import type { Page } from "@playwright/test";

/**
 * Opts a test page past the low-end DEVICE heuristic in
 * lib/webgl/capability.ts — and nothing else.
 *
 * GitHub Actions runners report 4 or fewer logical cores, so the capability
 * gate classifies them as low-end and declines WebGL. That is the gate
 * behaving correctly; the problem is that it would leave the entire WebGL
 * layer unexercised in CI, covered only by whatever a developer happens to
 * run locally. A control that cannot reach the surface it names is the exact
 * failure this suite's non-reduced-motion axe scan exists to prevent, so the
 * seam is the smaller evil.
 *
 * It must run before the page's own scripts, hence addInitScript rather than
 * evaluate. It does NOT override prefers-reduced-motion: the static-fallback
 * tests still assert that a reduced-motion visitor gets no GL context, and
 * they would be worthless if this flag bypassed that too.
 */
export async function forceWebGLCapability(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { __ggForceWebGLCapability?: boolean }).__ggForceWebGLCapability = true;
  });
}
