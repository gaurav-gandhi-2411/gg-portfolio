import { defineConfig, devices } from "@playwright/test";

/**
 * Wave 14 — the verification-gap fix. Wave 13's report claimed the category
 * filters were "instant, keyboard-accessible" and they were never actually
 * clicked by a human or a browser: they shipped functionally broken-feeling
 * (see reports/wave14-verification-audit-2026-07-26.md). Going forward, no
 * interactive feature is reported as working unless a test in e2e/ drove it
 * — this config is what CI's required `e2e` job runs against a real
 * production build (`next start`), never `next dev`, so timing/hydration
 * behavior matches what a visitor actually gets.
 *
 * PLAYWRIGHT_BASE_URL overrides the target (e.g. a deployed preview URL) —
 * used manually this wave to drive the actual production site; CI always
 * uses the local webServer below.
 */
export default defineConfig({
  testDir: "./e2e",
  // Runs after webServer is up and before any test. Pays the chatbot's ONNX
  // cold start once so no submit-flow test is the one that pays it inside its
  // own timeout; see e2e/global-setup.ts for the measurements.
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Four, measured rather than guessed. Playwright's default is half the
  // logical cores, which is 8 here, and 8 was slower as well as less
  // reliable: the same 386 tests took 6.9 minutes at 8 workers with 15
  // failures, and 4.3 minutes at 4 with none. The failures were 30-second
  // navigation timeouts against a server answering in 5ms, which is what
  // oversubscription looks like from inside a test and reads as flake from
  // outside one. GG runs several worktrees at once by design, so the
  // machine is rarely as free as a worker count derived from core count
  // assumes. Raise this only with a measurement attached.
  workers: 4,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run start",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
