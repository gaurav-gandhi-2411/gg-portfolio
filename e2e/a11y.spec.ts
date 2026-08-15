import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { caseStudySlugs } from "./fixtures/case-study-slugs";
import { categoryIds } from "./fixtures/category-ids";
import { forceWebGLCapability } from "./fixtures/force-webgl";

const ROUTES = [
  "/",
  "/projects",
  "/ask",
  ...categoryIds.map((id) => `/projects/${id}`),
  ...caseStudySlugs.map((slug) => `/work/${slug}`),
];

/**
 * components/reveal-group.tsx fades each section's children in via
 * Element.animate() — for `mode="onview"` (the default; used by the
 * project grid), the stagger doesn't start at page load, it starts
 * whenever an IntersectionObserver callback fires (threshold 0.15), and
 * is SKIPPED ENTIRELY under `prefers-reduced-motion: reduce` (reveal-group
 * checks `matchMedia` itself before ever calling `.animate()` — real
 * reduced-motion visitors get the final, fully-visible state immediately,
 * by construction, since the component "never sets an initial hidden
 * state via CSS class or style").
 *
 * This wave's original fixed-wait approach (`page.waitForTimeout(1300)`,
 * wave 9/14) raced that observer: on a slower run (CI load, browser
 * parallelism) the observer fires late enough that the last card in the
 * stagger is still mid-fade at the 1300ms mark. A `document.getAnimations()`
 * poll was tried next and was STILL insufficient — proven by running the
 * full suite under real parallel load (`--repeat-each=3`), not just in
 * isolation: a "zero running" check can be vacuously true before the
 * observer has fired at all (nothing has started, so nothing reports as
 * "running"), and under real CPU contention the observer — and axe's own,
 * non-instantaneous DOM scan — can both land inside that same window,
 * sampling a genuinely mid-fade frame. Confirmed via real failing
 * captures across two different fix attempts: scattered contrast ratios
 * (4.07 / 3.48 / 1.96 / 1.98, different cards, same scan) that track
 * stagger index, not the uniform-opacity hover-recede rule below.
 *
 * The actually-robust fix: don't race the animation at all. Emulate
 * `prefers-reduced-motion: reduce` for every axe scan in this file, the
 * same code path real reduced-motion visitors already get — this makes
 * the "settled" state deterministic (no animation ever starts, so there
 * is nothing to race), and it's the SAME rest state standard-motion
 * visitors eventually reach too (the animation's own final keyframe is
 * `{opacity:1, transform:'translateY(0)'}` — identical to the element's
 * un-animated CSS state). A contrast audit cares about the page's real,
 * static, readable content — not about sampling an in-flight decorative
 * transition, which was never the intent of a WCAG contrast check.
 */
async function gotoSettled(page: Page, route: string) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(route);
}

/**
 * Wave 16 — the project card hover-recede effect (`.project-grid:has(article:hover)
 * article:not(:hover) { opacity: 0.9 }`, app/globals.css) is a CSSTransition
 * (project-card.tsx's `transition-[...,opacity] duration-300`) that stays
 * ON under reduced motion by design (its own comment: "Opacity-only (no
 * motion), so it stays on under prefers-reduced-motion") — reduced-motion
 * emulation above removes the entrance-fade race without touching this.
 * Started synchronously the instant `:hover` state changes (no
 * IntersectionObserver async-start uncertainty here, unlike the entrance
 * fade), so waiting past its known 300ms duration is safe; polls the
 * actual computed opacity rather than a bare timeout so a slow run still
 * gets a correct read instead of a lucky/unlucky race.
 */
async function waitForHoverTransition(page: Page, selector: string, expectedOpacity: string) {
  await page.waitForFunction(
    ({ selector, expectedOpacity }) => {
      const el = document.querySelector(selector);
      return el ? getComputedStyle(el).opacity === expectedOpacity : false;
    },
    { selector, expectedOpacity },
    { timeout: 2000 }
  );
}

for (const route of ROUTES) {
  test(`axe: zero violations on ${route}`, async ({ page }) => {
    await gotoSettled(page, route);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });
}

test("axe: zero violations on a filtered /projects view", async ({ page }) => {
  await gotoSettled(page, "/projects");
  const filterGroup = page.getByRole("group", { name: "Filter projects by category" });
  await filterGroup.getByRole("button").nth(1).click();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

/**
 * BL-9 — /projects' search box scanned OPEN, with a real ranked-results
 * listbox showing (a combobox's expanded state, per CHECKS.md's own rule,
 * is exactly where a missing accessible name or a bad focus-order bug
 * would surface — the closed default state is already covered by the
 * route-level scan above via ROUTES, which would never reach this markup).
 * Round 5 removed this feature's client-side model tier entirely (see
 * components/project-search.tsx's header) — keyword ranking is the only
 * tier there is now, so there is no model network left to block.
 */
test("axe: zero violations on /projects with search results open", async ({ page }) => {
  await gotoSettled(page, "/projects");
  const input = page.getByRole("combobox", { name: /search projects/i });
  await input.fill("reduces on-call issue triage time");
  await expect(page.getByRole("listbox")).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

/**
 * BL-9 round 5 — the "How this search was built" methodology disclosure
 * (components/search-methodology.tsx) is new markup on /projects that the
 * route-level closed-state scan above (ROUTES) never expands past its own
 * trigger button. Its expanded content nests several MetricProvenance
 * disclosures (the same component the case-study provenance tests below
 * already cover open) — scanned here specifically to catch a bad
 * accessible name or focus-order bug in the combination that only exists
 * on this route: a plain disclosure containing several nested disclosures.
 */
test("axe: zero violations on /projects with the search-methodology panel open", async ({ page }) => {
  await gotoSettled(page, "/projects");
  const trigger = page.getByRole("button", { name: /how this search was built/i });
  await trigger.click();
  await expect(page.getByText(/every tier's 95% wilson confidence interval/i)).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

/**
 * Wave 16 — deliberately drives the actual bug this wave fixed: a real
 * mouse hover on one card recedes every sibling (app/globals.css,
 * `.project-grid:has(article:hover) article:not(:hover)`). 0.55 passed
 * this settled-state contrast at 3.28:1 (measured) against the required
 * 4.5:1 — a real WCAG AA failure for any real mouse user, independent of
 * the timing-race findings above. Fixed to 0.9 (worked via relative-
 * luminance math against the card's true local background — bg-card/50
 * composited over the page background, then receded again as a group —
 * not guessed; see the CSS comment for the numbers). This test only runs
 * where `(hover: hover)` actually applies — the mobile Playwright project
 * emulates a touch device, confirmed via `matchMedia("(hover: hover)")`
 * returning false there, so the rule (and this test) is a no-op on mobile
 * by design, not an oversight.
 */
test("axe: zero violations while a project card is genuinely hovered (desktop only)", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "hover: hover doesn't apply on touch — nothing to hover-recede");
  await gotoSettled(page, "/projects");
  const cards = page.locator(".project-grid article");
  await cards.first().hover();
  await waitForHoverTransition(page, ".project-grid article:nth-of-type(2)", "0.9");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

/** Wave 16 — the filter-active state doesn't introduce a new interaction with
 * hover-recede: filtered-OUT cards are `display: none` (removed from layout
 * entirely, not merely dimmed), so they never factor into a hover-recede
 * contrast calculation. This test exercises the combination explicitly
 * anyway, rather than assuming it from the CSS alone. */
test("axe: zero violations while a filtered view AND hover are both active", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "hover: hover doesn't apply on touch");
  await gotoSettled(page, "/projects");
  const filterGroup = page.getByRole("group", { name: "Filter projects by category" });
  await filterGroup.getByRole("button").nth(1).click();
  const visibleCards = page.locator(".project-grid article:visible");
  const count = await visibleCards.count();
  test.skip(count < 2, "need at least 2 visible cards after filtering to exercise the sibling-recede rule");
  await visibleCards.first().hover();
  await page.waitForFunction(
    () => {
      const els = Array.from(document.querySelectorAll(".project-grid article")).filter(
        (el) => getComputedStyle(el).display !== "none" && !el.matches(":hover")
      );
      return els.length > 0 && els.every((el) => getComputedStyle(el).opacity === "0.9");
    },
    { timeout: 2000 }
  );
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

/**
 * UI/UX wave (2026-07-30) — the /ask route's own axe test above only ever
 * scans the empty pre-question state; the answered state has new markup
 * this wave added (the aria-hidden animated paragraph + its sr-only
 * full-text twin, see components/chatbot/ask-panel.tsx's TurnAnswer, and
 * the "Or ask about:" follow-up chip row). gotoSettled's reduced-motion
 * emulation also makes useAnswerReveal skip the animation entirely
 * (shouldReallyAnimate reads matchMedia directly), so the answer renders
 * complete on the same tick — nothing to race here either.
 */
test("axe: zero violations on /ask after a turn completes (answer + follow-ups visible)", async ({
  page,
}) => {
  await gotoSettled(page, "/ask");
  const input = page.getByLabel("Ask a question about Gaurav's work");
  await input.fill("What is Gaurav's current role and background?");
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(page.getByText("Thinking…")).toHaveCount(0, { timeout: 20_000 });
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

/**
 * components/metric-provenance.tsx's source-reveal disclosure (see
 * e2e/case-study-provenance.spec.ts for its functional coverage) opens a
 * `role="group"` panel with a link inside — scanned open, not just closed,
 * since a disclosure's expanded state is exactly where a missing accessible
 * name or a focus-order bug would surface.
 */
test("axe: zero violations with a metric's source-provenance panel open (structured tier)", async ({
  page,
}) => {
  await gotoSettled(page, "/work/triageiq");
  await page
    .getByRole("button", { name: /show source for Component classifier top-3 accuracy \(vscode\)/ })
    .click();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

/** Prose tier renders different markup (verbatim row text + a single
 * provenance.md link, no per-citation list) — scanned separately since a
 * structured-tier pass doesn't exercise it. */
test("axe: zero violations with a metric's source-provenance panel open (prose tier)", async ({ page }) => {
  await gotoSettled(page, "/work/triageiq");
  await page
    .getByRole("button", { name: /show source for Resolution-time CQR interval coverage \(kubernetes\)/ })
    .click();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

/**
 * Every scan above goes through gotoSettled(), which emulates
 * `prefers-reduced-motion: reduce`. That is correct for those scans, but it
 * means none of them can ever reach the Warmer WebGL viewer: reduced motion
 * is one of the conditions under which lib/webgl/capability.ts declines to
 * mount the GL layer at all, so those runs only ever see the static SVG
 * fallback — including the /work/warmer entry in ROUTES above.
 *
 * So this scan deliberately does NOT use gotoSettled. It is the only place
 * the interactive layer's controls (the Base model / Fine-tuned toggle and
 * its live region) are actually audited; without it the suite would report
 * green over a surface it never visited.
 */
/**
 * Same blind spot as the Warmer scan below, on the homepage: gotoSettled()'s
 * reduced-motion emulation is one of the conditions under which the hero's
 * capability gate declines WebGL, so the "/" entry in ROUTES only ever audits
 * the static scatter. This scan is the only one that sees the canvas layer.
 */
test("axe: zero violations on the homepage with the hero's WebGL layer active", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await forceWebGLCapability(page);
  await page.goto("/");
  await expect(page.locator("header canvas")).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

test("axe: zero violations on the Warmer WebGL embedding viewer", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await forceWebGLCapability(page);
  await page.goto("/work/warmer");

  // Scroll the SSR'd section, not the GL testid — the latter does not exist
  // until the section intersects.
  await page.getByRole("region", { name: "The fix, made visible" }).scrollIntoViewIfNeeded();
  // The GL layer is dynamically imported once the section intersects — wait
  // on the canvas itself rather than a fixed timeout.
  await expect(page.getByTestId("warmer-embedding-gl").locator("canvas")).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

/**
 * perf/lcp-final Task 4 — same blind spot as the two scans above: every
 * ROUTES entry goes through gotoSettled()'s reduced-motion emulation, which
 * is one of the conditions under which mayUseWebGL() declines to offer the
 * "Explore in 3D" toggle at all. The closed/static state on /work/triageiq is
 * already covered by the ROUTES sweep; this is the only scan that reaches the
 * toggle button and the mounted GL canvas behind it.
 */
test("axe: zero violations on the TriageIQ case study with the 3D embedding view open", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await forceWebGLCapability(page);
  await page.goto("/work/triageiq");

  const toggle = page.getByRole("button", { name: "Explore in 3D" });
  await toggle.scrollIntoViewIfNeeded();
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(page.getByTestId("project-embedding-gl").locator("canvas")).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});

/**
 * Same reasoning again for the /projects ambient layer: reduced-motion
 * emulation keeps mayUseWebGL() false for every ROUTES-sweep scan of
 * /projects, so that entry only ever audits the plain grid. This scan forces
 * capability on and scrolls the grid into view so the ambient
 * IntersectionObserver actually mounts the GL canvas before the audit runs.
 */
test("axe: zero violations on /projects with the ambient WebGL layer mounted", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await forceWebGLCapability(page);
  await page.goto("/projects");
  await page.locator(".project-grid").scrollIntoViewIfNeeded();
  await expect(page.locator("canvas").first()).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
});
