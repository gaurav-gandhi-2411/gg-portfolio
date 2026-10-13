import { expect, test } from "@playwright/test";

/**
 * The production deploy must be provable to be main's HEAD from the live page alone, so every
 * route's server-rendered HTML carries <meta name="build-sha" content="<40-char git sha>">.
 * Fetched with `request` (no JS executes), so a client-injected tag cannot satisfy this.
 * In CI the build always has git, so only a real 40-hex SHA passes; the literal "dev" is the
 * no-git/no-Vercel-env fallback and is tolerated only off CI.
 */
const ROUTES = ["/", "/work/triageiq", "/research", "/open-source"];
const TAG = /<meta\s+name="build-sha"\s+content="([^"]*)"/;

for (const route of ROUTES) {
  test(`build-sha meta is in the static HTML of ${route}`, async ({ request }) => {
    const res = await request.get(route);
    expect(res.status()).toBe(200);
    const match = TAG.exec(await res.text());
    expect(match, `no build-sha meta tag in ${route}`).not.toBeNull();
    const sha = match![1];
    if (process.env.CI) expect(sha).toMatch(/^[0-9a-f]{40}$/);
    else expect(sha).toMatch(/^([0-9a-f]{40}|dev)$/);
  });
}

test("build-sha is the same on every route (one build, one SHA)", async ({ request }) => {
  const shas = await Promise.all(
    ROUTES.map(async (r) => TAG.exec(await (await request.get(r)).text())?.[1]),
  );
  expect(new Set(shas).size).toBe(1);
  expect(shas[0]).toBeTruthy();
});
