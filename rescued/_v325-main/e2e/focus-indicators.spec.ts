import { expect, test } from "@playwright/test";

/**
 * Focus-ring audit regressions (WCAG 2.4.7 / 1.4.11). Found by tabbing every
 * route in light and dark and checking each stop for a visible, >= 3:1,
 * unclipped indicator.
 */
test.describe("Focus indicators", () => {
  test("citation links inside a closed provenance panel are not in the tab order", async ({
    page,
  }) => {
    await page.goto("/work/triageiq");
    const trigger = page.getByRole("button", {
      name: /show source for Component classifier top-3 accuracy \(vscode\)/,
    });
    const link = page
      .getByRole("group", {
        name: /Source for Component classifier top-3 accuracy \(vscode\)/,
      })
      .getByRole("link")
      .first();
    // Closed: the link sits in a zero-width overflow-hidden box, so a focus
    // stop there was an invisible, clipped ring.
    await expect(link).toHaveAttribute("tabindex", "-1");
    await trigger.click();
    await expect(link).not.toHaveAttribute("tabindex", "-1");
  });

  for (const scheme of ["light", "dark"] as const) {
    for (const [route, locator] of [
      ["/projects", "input[role=combobox]"],
      ["/ask", "form input"],
    ] as const) {
      test(`text input focus ring on ${route} is >= 3:1 against the page (${scheme})`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(route);
        const input = page.locator(locator).first();
        // Text inputs always match :focus-visible, however focus arrives.
        await input.focus();
        await expect(input).toBeFocused();
        // Polled: the ring may still be mid-transition on the first frame.
        const measure = (): Promise<number> =>
          input.evaluate((el) => {
            const cv = document.createElement("canvas");
            cv.width = cv.height = 1;
            const ctx = cv.getContext("2d", { willReadFrequently: true })!;
            const rgba = (c: string): number[] => {
              ctx.clearRect(0, 0, 1, 1);
              ctx.fillStyle = c;
              ctx.fillRect(0, 0, 1, 1);
              const d = ctx.getImageData(0, 0, 1, 1).data;
              return [d[0], d[1], d[2], d[3] / 255];
            };
            const lum = ([r, g, b]: number[]): number => {
              const f = (v: number): number => {
                const s = v / 255;
                return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
              };
              return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
            };
            const shadow = getComputedStyle(el).boxShadow;
            // The ring is the shadow with a positive spread; Tailwind stacks
            // several transparent zero-size shadows around it.
            const parts = shadow.split(/,(?![^(]*\))/);
            const ringPart = parts.find((p) => /\s[1-9][\d.]*px\s*$/.test(p)) ?? "";
            const colour =
              ringPart.match(/(rgba?\([^)]*\)|oklab\([^)]*\)|color\([^)]*\))/)?.[0] ?? "";
            const ring = rgba(colour);
            const page = rgba(getComputedStyle(document.body).backgroundColor);
            // Composite the ring over the page the way it is painted.
            const eff = [0, 1, 2].map((i) => ring[i] * ring[3] + page[i] * (1 - ring[3]));
            const [a, b] = [lum(eff), lum(page)];
            return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          });
        await expect.poll(measure).toBeGreaterThanOrEqual(3);
      });
    }
  }
});
