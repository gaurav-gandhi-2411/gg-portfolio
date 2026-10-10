import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import sitemap from "../app/sitemap";
import { site } from "../content/site";

/**
 * app/fonts/*.woff2 are subset to app/fonts/core-chars.txt (see
 * scripts/subset-fonts.py for why). The failure mode that introduces is
 * silent: copy with a character outside the subset renders in the fallback
 * face, and nothing errors. This spec states the invariant instead: every
 * character a page renders in one of the three self-hosted families is in
 * the subset, unless Google's "latin" file (the one served before the
 * subset) never covered it either, in which case it fell back before too and
 * nothing regressed.
 */

const CORE = new Set([...readFileSync("app/fonts/core-chars.txt", "utf8")]);

// unicode-range of the "latin" block the fonts were previously served from.
const OLD_LATIN_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x00, 0xff],
  [0x131, 0x131],
  [0x152, 0x153],
  [0x2bb, 0x2bc],
  [0x2c6, 0x2c6],
  [0x2da, 0x2da],
  [0x2dc, 0x2dc],
  [0x304, 0x304],
  [0x308, 0x308],
  [0x329, 0x329],
  [0x2000, 0x206f],
  [0x20ac, 0x20ac],
  [0x2122, 0x2122],
  [0x2191, 0x2191],
  [0x2193, 0x2193],
  [0x2212, 0x2212],
  [0x2215, 0x2215],
  [0xfeff, 0xfeff],
  [0xfffd, 0xfffd],
];

const inOldLatin = (ch: string): boolean => {
  const cp = ch.codePointAt(0) ?? 0;
  return OLD_LATIN_RANGES.some(([lo, hi]) => cp >= lo && cp <= hi);
};

const ROUTES = [
  ...new Set([
    ...sitemap().map((entry) => {
      const url = String(entry.url);
      const path = url.startsWith(site.url) ? url.slice(site.url.length) : url;
      return path === "" ? "/" : path;
    }),
    "/ask",
  ]),
].filter((path) => !path.startsWith("/warmup/"));

test.describe("self-hosted font subset covers every rendered character", () => {
  // Characters are viewport-independent; the desktop project is enough.
  test.skip(({ isMobile }) => isMobile, "viewport-independent");

  for (const path of ROUTES) {
    test(path, async ({ page }) => {
      await page.goto(path);
      const rendered = await page.evaluate(() => {
        const out: Record<string, string> = {};
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const el = node.parentElement;
          if (!el || ["SCRIPT", "STYLE", "NOSCRIPT"].includes(el.tagName)) continue;
          const family = getComputedStyle(el).fontFamily.split(",")[0].replace(/["']/g, "").trim();
          out[family] = (out[family] ?? "") + (node.textContent ?? "");
        }
        return out;
      });

      const missing: string[] = [];
      let sawSelfHosted = false;
      for (const [family, text] of Object.entries(rendered)) {
        // next/font/local registers the families under camelCase generated names.
        if (!/^(spaceGrotesk|fraunces|jetbrainsMono)/.test(family)) continue;
        sawSelfHosted = true;
        for (const ch of new Set([...text])) {
          if (/\s/.test(ch)) continue;
          if (!CORE.has(ch) && inOldLatin(ch)) missing.push(`${family}: U+${ch.codePointAt(0)?.toString(16).padStart(4, "0")} "${ch}"`);
        }
      }
      // Guards against the family-name match above silently matching nothing.
      expect(sawSelfHosted, `no text rendered in a self-hosted family: ${Object.keys(rendered)}`).toBe(true);
      expect(missing, "add these characters to app/fonts/core-chars.txt and re-run scripts/subset-fonts.py").toEqual([]);
    });
  }
});
