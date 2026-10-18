import { expect, test } from "@playwright/test";
import { CATEGORIES } from "../content/types";
import { products } from "../content/products";

/**
 * The category pills are real <a href> links in the server HTML, so a tap
 * before hydration (slow phone, blocked JS, crawler, an early tap) navigates
 * to the server-rendered destination instead of doing nothing. Every
 * assertion here runs with JavaScript OFF, or against the raw HTTP body, so
 * none can be satisfied by hydrated behaviour.
 */

test.use({ javaScriptEnabled: false });

const GROUP = "Filter projects by category";

test("the raw HTML of /projects has every pill as an <a> with an href", async ({ request }) => {
  const res = await request.get("/projects");
  expect(res.ok()).toBe(true);
  const html = await res.text();
  const group = html.match(/<div[^>]*aria-label="Filter projects by category"[^>]*>([\s\S]*?)<\/div>/);
  expect(group, "pill group is in the server HTML").not.toBeNull();
  const inner = group![1];
  expect(inner, "no pill is a <button> in the server HTML").not.toContain("<button");
  const anchors = [...inner.matchAll(/<a\s[^>]*href="([^"]*)"/g)].map((m) => m[1]);
  expect(anchors).toEqual(["/projects", ...CATEGORIES.map((c) => `/projects/${c.id}`)]);
});

test("every pill is an anchor with a non-empty href in the rendered page", async ({ page }) => {
  await page.goto("/projects");
  const group = page.getByRole("group", { name: GROUP });
  await expect(group.getByRole("button")).toHaveCount(0);
  const links = group.getByRole("link");
  await expect(links).toHaveCount(CATEGORIES.length + 1);
  const hrefs = await links.evaluateAll((els) =>
    els.map((el) => ({ tag: el.tagName, href: el.getAttribute("href") })),
  );
  for (const h of hrefs) {
    expect(h.tag).toBe("A");
    expect(h.href ?? "").not.toBe("");
  }
});

test("the active pill (All, on /projects) carries aria-current", async ({ page }) => {
  await page.goto("/projects");
  const group = page.getByRole("group", { name: GROUP });
  await expect(group.getByRole("link", { name: /^All \d+$/ })).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(group.locator('[aria-current="true"]')).toHaveCount(1);
});

for (const cat of CATEGORIES) {
  test(`clicking "${cat.label}" with JS off lands on /projects/${cat.id} with its real list`, async ({
    page,
  }) => {
    await page.goto("/projects");
    const expected = products.filter((p) => (p.categories as readonly string[]).includes(cat.id));
    expect(expected.length).toBeGreaterThan(0);
    await page
      .getByRole("group", { name: GROUP })
      .getByRole("link", { name: `${cat.label} ${expected.length}`, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/projects/${cat.id}$`));
    await expect(
      page.getByRole("heading", { level: 1, name: cat.label, exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText(`${expected.length} ${expected.length === 1 ? "project" : "projects"}`, {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator(".project-grid article")).toHaveCount(expected.length);
    await expect(page.getByRole("heading", { name: expected[0].name, exact: true })).toBeVisible();
  });
}

test("the 'All' pill links to /projects", async ({ page }) => {
  await page.goto(`/projects/${CATEGORIES[0].id}`);
  await page.goto("/projects");
  const all = page.getByRole("group", { name: GROUP }).getByRole("link", { name: /^All \d+$/ });
  await expect(all).toHaveAttribute("href", "/projects");
  await all.click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole("heading", { level: 1, name: "All projects" })).toBeVisible();
});

test("on the home page the pills are links too, and a tap navigates", async ({ page }) => {
  await page.goto("/");
  const group = page.getByRole("group", { name: GROUP });
  await expect(group.getByRole("link")).toHaveCount(CATEGORIES.length + 1);
  const first = CATEGORIES[0];
  await group.getByRole("link", { name: new RegExp(`^${first.label} \\d+$`) }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${first.id}$`));
});
