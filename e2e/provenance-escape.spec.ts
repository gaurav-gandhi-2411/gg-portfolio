import { expect, test } from "@playwright/test";

/**
 * APG disclosure popovers dismiss on Escape and hand focus back to the
 * control that opened them. Before this, Escape did nothing: the panel
 * closed only on a second Enter/Space or an outside pointerdown, so a
 * keyboard user who had tabbed into the panel's link had no way out
 * without finding the trigger again.
 */
const TRIGGER = /show source for Component classifier top-3 accuracy \(vscode\)/;
const PANEL = /Source for Component classifier top-3 accuracy \(vscode\)/;

test.describe("MetricProvenance Escape handling", () => {
  test("Escape closes an open panel and returns focus to its trigger", async ({ page }) => {
    await page.goto("/work/triageiq");
    const trigger = page.getByRole("button", { name: TRIGGER });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("group", { name: PANEL })).toHaveCSS("opacity", "0");
    await expect(trigger).toBeFocused();
  });

  test("Escape with a link inside the panel focused closes it and refocuses the trigger", async ({
    page,
  }) => {
    await page.goto("/work/triageiq");
    const trigger = page.getByRole("button", { name: TRIGGER });
    await trigger.click();
    const link = page.getByRole("group", { name: PANEL }).getByRole("link").first();
    await link.focus();
    await expect(link).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toBeFocused();
  });

  test("Escape while closed does nothing (focus stays where it was)", async ({ page }) => {
    await page.goto("/work/triageiq");
    const trigger = page.getByRole("button", { name: TRIGGER });
    const other = page.getByRole("button", { name: /show source for LLM fabrication rate/ });
    await other.focus();
    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(other).toBeFocused();
  });

  test("after an outside click closes the panel, a later Escape does not steal focus", async ({
    page,
  }) => {
    await page.goto("/work/triageiq");
    const trigger = page.getByRole("button", { name: TRIGGER });
    await trigger.click();
    await page.mouse.click(2, 2);
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    const other = page.getByRole("button", { name: /show source for LLM fabrication rate/ });
    await other.focus();
    await page.keyboard.press("Escape");
    await expect(other).toBeFocused();
  });
});
