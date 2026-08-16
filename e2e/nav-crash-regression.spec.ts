import { expect, test, type Page } from "@playwright/test";
import { productSlugs } from "./fixtures/product-slugs";

/**
 * fix/remove-view-transitions — P0 regression coverage.
 *
 * This is the test that was missing. The site crashed with uncaught
 * `insertBefore`/`removeChild` DOMExceptions (Chromium's own native "This
 * page couldn't load" interstitial, not a Next.js error boundary) on a
 * large fraction of real navigations, and nothing in the existing suite
 * would have failed on it — every other nav/route-transitions spec asserts
 * on URL and visible content, never on whether an uncaught exception fired
 * during the transition. Two independent mechanisms produced this crash
 * class in this repo's history (see PLAN.md's P0 entry and app/layout.tsx /
 * components/boot-loader.tsx for the one that actually caused it): this
 * spec is deliberately mechanism-agnostic — it asserts the OBSERVABLE
 * symptom (uncaught page error, or a rendered crash page) on every route
 * pair a real visitor could click, not a specific known cause, so it stays
 * useful against a *different* future regression of the same symptom.
 *
 * Known, expected, environment-only noise this deliberately does NOT fail
 * on: `next start` locally has no Vercel edge, so
 * @vercel/analytics'/@vercel/speed-insights' scripts 404 in every test run
 * regardless of app correctness (KNOWN_NOISE below). Blanket-failing on
 * every console "error" message would make this check fail 100% of the
 * time in local/CI runs for a reason unrelated to the bug it exists to
 * catch — exactly the "alarm that fires on everything gets ignored"
 * failure CHECKS.md warns about. Real uncaught exceptions (`pageerror`)
 * are never filtered.
 */

const KNOWN_NOISE = [
  // @vercel/analytics + @vercel/speed-insights 404 locally (no Vercel edge
  // outside a real deployment) regardless of app correctness. Chrome's
  // console text for a failed resource load never includes the URL, so this
  // has to match the generic message rather than the specific script path.
  /Failed to load resource: the server responded with a status of 404/,
  /Vercel (Web Analytics|Speed Insights)/,
];

const CRASH_PAGE_MARKERS = [
  /this page couldn.?t load/i,
  /application error/i,
  /something went wrong/i,
];

interface CrashWatcher {
  pageErrors: string[];
  consoleErrors: string[];
}

function watchForCrashes(page: Page): CrashWatcher {
  const watcher: CrashWatcher = { pageErrors: [], consoleErrors: [] };
  page.on("pageerror", (err) => watcher.pageErrors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (KNOWN_NOISE.some((re) => re.test(text))) return;
    watcher.consoleErrors.push(text);
  });
  return watcher;
}

async function assertNoCrash(page: Page, watcher: CrashWatcher): Promise<void> {
  const bodyText = (await page.textContent("body").catch(() => "")) ?? "";
  const crashMarker = CRASH_PAGE_MARKERS.find((re) => re.test(bodyText));
  expect(
    watcher.pageErrors,
    `uncaught page error(s) during navigation: ${watcher.pageErrors.join(" | ")}`
  ).toEqual([]);
  expect(
    crashMarker,
    `rendered crash-page content matched ${crashMarker}: ${bodyText.slice(0, 200)}`
  ).toBeUndefined();
  expect(
    watcher.consoleErrors,
    `console error(s) during navigation: ${watcher.consoleErrors.join(" | ")}`
  ).toEqual([]);
}

test.describe("nav crash regression", () => {
  // Direct full-page loads: catches a hydration-time DOM-ownership conflict
  // even with zero client-side navigation involved, which is exactly how
  // this repo's real bug (app/layout.tsx removing a React-owned node) was
  // first proven unrelated to client-side transitions.
  test.describe("direct full-page load, every top-level route", () => {
    for (const route of ["/", "/projects", "/ask"]) {
      test(`${route} loads with no uncaught error`, async ({ page }) => {
        const watcher = watchForCrashes(page);
        await page.goto(route, { waitUntil: "networkidle" });
        await page.waitForTimeout(300);
        await assertNoCrash(page, watcher);
      });
    }

    for (const slug of productSlugs) {
      test(`/work/${slug} loads with no uncaught error`, async ({ page }) => {
        const watcher = watchForCrashes(page);
        await page.goto(`/work/${slug}`, { waitUntil: "networkidle" });
        await page.waitForTimeout(300);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await assertNoCrash(page, watcher);
      });
    }
  });

  // Header-nav-reachable route pairs, every case study: home -> /projects
  // (header nav) -> case study (project card) -> home (header logo). Each
  // hop is a real client-side transition a visitor would actually trigger.
  test.describe("home -> /projects -> case study -> home, every case study", () => {
    for (const slug of productSlugs) {
      test(`round trip through /work/${slug}`, async ({ page }) => {
        const watcher = watchForCrashes(page);

        await page.goto("/", { waitUntil: "networkidle" });
        await page.getByRole("navigation", { name: "Site" }).getByRole("link", {
          name: "Projects",
          exact: true,
        }).click();
        await expect(page).toHaveURL(/\/projects$/);

        const caseStudyLink = page.locator(`a[href="/work/${slug}"]`).first();
        await caseStudyLink.waitFor({ state: "visible" });
        await caseStudyLink.click();
        await expect(page).toHaveURL(new RegExp(`/work/${slug}$`));
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

        await page.getByRole("navigation", { name: "Site" }).getByRole("link", {
          name: `, home`,
        }).click();
        await expect(page).toHaveURL(/\/$/);

        await assertNoCrash(page, watcher);
      });
    }
  });

  // The remaining header-nav pairs not covered by the per-case-study loop
  // above: same-page anchor links and the /projects <-> home header logo.
  test("header nav anchors (About/Experience/Contact) never crash", async ({ page }) => {
    const watcher = watchForCrashes(page);
    await page.goto("/", { waitUntil: "networkidle" });
    for (const name of ["About", "Experience", "Contact"] as const) {
      await page.getByRole("navigation", { name: "Site" }).getByRole("link", {
        name,
        exact: true,
      }).click();
      await page.waitForTimeout(150);
    }
    await assertNoCrash(page, watcher);
  });

  test("/projects -> home (header logo) never crashes", async ({ page }) => {
    const watcher = watchForCrashes(page);
    await page.goto("/projects", { waitUntil: "networkidle" });
    await page.getByRole("navigation", { name: "Site" }).getByRole("link", {
      name: `, home`,
    }).click();
    await expect(page).toHaveURL(/\/$/);
    await assertNoCrash(page, watcher);
  });

  // Multi-hop, single persistent session — the specific shape that caught
  // the real bug (a corruption that survives past the navigation where it
  // was introduced and only crashes a LATER, unrelated commit).
  test("multi-hop single session: 8 consecutive navigations never crash", async ({ page }) => {
    test.setTimeout(60_000);
    const watcher = watchForCrashes(page);
    const hops = ["/", "/projects", "/", "/projects", "/", "/projects", "/", "/projects"];
    for (const route of hops) {
      await page.goto(route, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(150);
    }
    // End on a case study reached via a real click, then back to home, to
    // exercise the exact insertBefore-anchor path the real bug corrupted.
    await page.getByRole("navigation", { name: "Site" }).getByRole("link", {
      name: "Projects",
      exact: true,
    }).click();
    const firstCard = page.locator(".project-grid article a[href^='/work/']").first();
    await firstCard.click();
    await expect(page).toHaveURL(/\/work\//);
    await page.getByRole("navigation", { name: "Site" }).getByRole("link", {
      name: `, home`,
    }).click();
    await expect(page).toHaveURL(/\/$/);
    await assertNoCrash(page, watcher);
  });
});
