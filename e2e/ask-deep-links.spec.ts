import { expect, test } from "@playwright/test";

import index from "../content/chatbot/index.json";

/**
 * Every deep link an /ask citation can produce actually lands somewhere.
 *
 * Written from the sentence the feature exists to make true, before reading
 * either implementation: **a citation should put the reader on the paragraph
 * the assistant quoted, not at the top of a seven-minute page.**
 *
 * The second set comes from the rendered DOM rather than from the source:
 * load each page, ask the browser whether the element exists. What that
 * catches is an anchor the indexer emits and the page does not render, which
 * is the real failure mode here, because the two sides are produced by
 * different code from a shared list and only one of them is conditional.
 * Measured: making the indexer emit a story anchor the page never renders
 * fails 26 of the 34 tests in this file.
 *
 * WHAT IT DOES NOT CATCH, stated because the first version of this comment
 * claimed otherwise and the claim was checked and found false. Renaming a
 * section title in lib/case-study-anchors.ts changes the heading and the
 * emitted anchor together, and every test here still passes. That is not a
 * gap: for this property, both sides agreeing IS correctness, since the link
 * works and lands on the right heading whatever it is called. The wrong
 * sentence was "a wrong anchor in the shared module fails here even though
 * every producer agrees" -- it does not, and a test comment that overstates
 * its own reach is the same defect as a check that does, one layer out.
 *
 * The failure it does guard is quiet in the worst way. A fragment that
 * resolves to nothing does not error, does not warn, and does not look
 * broken: the browser lands at the top of the page, which is exactly where
 * the link used to go. Nobody reports it, because nothing appears to have
 * gone wrong.
 */

interface Chunk {
  sourceRef: string;
  sourceLabel: string;
  url?: string;
}

const chunks = (index as { chunks: Chunk[] }).chunks;

/** Every distinct page-plus-fragment a citation could hand a reader. */
const deepLinks = [
  ...new Set(
    chunks
      .map((c) => c.url)
      .filter((u): u is string => typeof u === "string" && u.includes("#"))
  ),
].sort();

/** Grouped by page, so each route is loaded once rather than once per anchor. */
const byPage = new Map<string, string[]>();
for (const link of deepLinks) {
  const [path, fragment] = link.split("#");
  byPage.set(path, [...(byPage.get(path) ?? []), fragment]);
}

test("nearly every case-study citation is a deep link, not a page link", () => {
  // A denominator this test would notice moving. Without it, deleting every
  // fragment from the indexer would leave the loop below iterating over an
  // empty set and reporting success, which is the failure this whole file is
  // about, committed by the file itself.
  //
  // Stated as a ratio rather than a count, because a count is satisfied by
  // one page's worth of anchors and says nothing about the other thirteen.
  // The floor is 0.9 against a measured 0.944: the gap is the product
  // taglines, which belong to no case-study section and correctly link to
  // the page. Anything that stops a whole section kind from carrying its
  // anchor drops this below the floor.
  const caseStudyChunks = chunks.filter((c) => c.url?.startsWith("/work/"));
  const deep = caseStudyChunks.filter((c) => c.url?.includes("#"));
  expect(caseStudyChunks.length).toBeGreaterThan(200);
  expect(deep.length / caseStudyChunks.length).toBeGreaterThan(0.9);
  // And every case study is represented, not just the ones with long pages.
  expect(byPage.size).toBeGreaterThan(10);
});

for (const [path, fragments] of byPage) {
  test(`every citation anchor on ${path} resolves to a real heading`, async ({ page }) => {
    await page.goto(path);
    const unresolved: string[] = [];
    for (const fragment of new Set(fragments)) {
      const found = await page.evaluate((id) => Boolean(document.getElementById(id)), fragment);
      if (!found) unresolved.push(fragment);
    }
    expect(unresolved, `anchors with nothing to scroll to on ${path}`).toEqual([]);
  });
}

test("a citation with no section still points at a real page", async ({ page }) => {
  // Product taglines are not part of any case-study section, so they link to
  // the page rather than into it. That degradation is deliberate: the top of
  // the right page beats a fragment that scrolls nowhere. Assert it is a
  // real page rather than assuming.
  const plain = [
    ...new Set(
      chunks
        .map((c) => c.url)
        .filter((u): u is string => typeof u === "string" && u.startsWith("/work/") && !u.includes("#"))
    ),
  ];
  expect(plain.length).toBeGreaterThan(0);
  for (const url of plain.slice(0, 3)) {
    const response = await page.goto(url);
    expect(response?.status(), url).toBe(200);
  }
});
