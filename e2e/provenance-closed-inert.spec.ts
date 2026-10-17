import { expect, test, type Page } from "@playwright/test";

/**
 * A closed provenance panel must not be exposed to assistive technology.
 *
 * The panel stays in the DOM at all times (only opacity / width / pointer-events
 * change), so before this fix a screen reader in browse mode could still read
 * every closed panel's text and reach their links: nothing removed them from the
 * accessibility tree (aria-hidden unset, inert false). #325 only set tabIndex=-1,
 * which stops the Tab key and nothing else.
 *
 * The browser's own accessibility tree is read over CDP rather than through
 * Playwright's role locators, because those apply Playwright's own hidden-element
 * heuristics and so can disagree with what a screen reader is actually given.
 */
const TRIGGER = /show source for Component classifier top-3 accuracy \(vscode\)/;
const PANEL_NAME = /^Source for Component classifier top-3 accuracy \(vscode\)/;

/** Non-ignored AX nodes of the given role whose accessible name matches. */
async function exposedNodes(page: Page, role: string, name: RegExp): Promise<number> {
  const cdp = await page.context().newCDPSession(page);
  try {
    const { nodes } = await cdp.send("Accessibility.getFullAXTree");
    return nodes.filter(
      (n) => !n.ignored && n.role?.value === role && name.test(String(n.name?.value ?? ""))
    ).length;
  } finally {
    await cdp.detach();
  }
}

test.describe("MetricProvenance closed panel is hidden from assistive tech", () => {
  test("closed: panel is inert and absent from the accessibility tree", async ({ page }) => {
    await page.goto("/work/triageiq");
    const trigger = page.getByRole("button", { name: TRIGGER });
    await expect(trigger).toHaveAttribute("aria-expanded", "false");

    const panel = page.locator(`[id="${await trigger.getAttribute("aria-controls")}"]`);
    await expect(panel).toHaveJSProperty("inert", true);
    expect(await exposedNodes(page, "group", PANEL_NAME)).toBe(0);
    // No closed panel anywhere on the page is exposed (not just the one under test).
    expect(await exposedNodes(page, "group", /^Source for /)).toBe(0);
  });

  test("open: the panel is exposed and reachable; closing hides it again", async ({ page }) => {
    await page.goto("/work/triageiq");
    const trigger = page.getByRole("button", { name: TRIGGER });
    const panel = page.locator(`[id="${await trigger.getAttribute("aria-controls")}"]`);

    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(panel).toHaveJSProperty("inert", false);
    expect(await exposedNodes(page, "group", PANEL_NAME)).toBe(1);
    await expect(page.getByRole("group", { name: PANEL_NAME })).toBeVisible();
    // Only the open panel is exposed; the page's other closed panels stay hidden.
    expect(await exposedNodes(page, "group", /^Source for /)).toBe(1);

    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(panel).toHaveJSProperty("inert", true);
    expect(await exposedNodes(page, "group", PANEL_NAME)).toBe(0);
  });

  for (const key of ["Enter", "Space"] as const) {
    test(`keyboard ${key} on the trigger opens it and exposes the panel`, async ({ page }) => {
      await page.goto("/work/triageiq");
      const trigger = page.getByRole("button", { name: TRIGGER });
      await trigger.focus();
      await page.keyboard.press(key);
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      expect(await exposedNodes(page, "group", PANEL_NAME)).toBe(1);
      // aria-controls still resolves to the (now exposed) panel.
      const controls = await trigger.getAttribute("aria-controls");
      await expect(page.locator(`[id="${controls}"]`)).toHaveAttribute("role", "group");
    });
  }
});
