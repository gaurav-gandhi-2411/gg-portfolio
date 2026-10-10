import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * The OG card once hand-typed the hero tagline and got it wrong ("...own name." / "and the
 * production systems..." instead of "...own name, and the production systems..."). Both
 * surfaces must read the one constant, content/site.ts's `site.tagline`. Reads sources as
 * text because content/*.ts use the "@/" alias, which node's strip-types runner cannot resolve.
 */
const read = (p: string): string => readFileSync(new URL(p, import.meta.url), "utf8");
const site = read("../content/site.ts");
const hero = read("../components/sections/hero.tsx");
const og = read("../app/opengraph-image.tsx");

const tagline = /tagline:\s*"([^"]+)"/.exec(site)?.[1];

test("site.tagline is a single sentence with a comma, not two fragments", () => {
  assert.ok(tagline, "tagline constant found");
  assert.match(tagline, /own name, and the production systems/);
});

test("hero and OG card both render site.tagline", () => {
  assert.match(hero, /\{site\.tagline\}/);
  assert.match(og, /\{site\.tagline\}/);
});

test("OG card carries no hand-typed copy that exists as a constant", () => {
  assert.doesNotMatch(og, /I build and ship/);
  assert.doesNotMatch(og, /Open to Lead/);
  assert.match(og, /site\.role/);
  assert.match(og, /headlineStats/);
  assert.match(og, /employer\.company/);
});
