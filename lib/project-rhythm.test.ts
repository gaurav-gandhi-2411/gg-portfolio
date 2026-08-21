import assert from "node:assert/strict";
import { test } from "node:test";
import type { Product } from "../content/types.ts";
import { categoryRhythmOverrides, projectRhythm } from "./project-rhythm.ts";

/** Minimal fixtures -- only the fields projectRhythm/categoryRhythmOverrides read. */
function product(slug: string, categories: string[], hasFigure: boolean): Product {
  return {
    slug,
    name: slug,
    tagline: slug,
    categories: categories as Product["categories"],
    figure: hasFigure ? { kind: "bar", pct: 50, valueText: "50%" } : undefined,
  };
}

test("categoryRhythmOverrides is empty when every view agrees with the global rhythm", () => {
  const products = [
    product("a", ["llm-agents"], true),
    product("b", ["llm-agents"], true),
  ];
  // Both spread globally (each starts an empty row) and both spread within
  // the single category they both belong to -- no disagreement possible.
  assert.equal(categoryRhythmOverrides(products), "");
});

test("categoryRhythmOverrides emits a spread override when a filtered view's parity disagrees with the global one", () => {
  // Reproduces the exact GG-launch-review shape: a non-member project (b)
  // sits between two same-category spread-eligible projects (a, c) in the
  // full list, consuming the empty-row slot the category-only view never
  // sees.
  const products = [
    product("a", ["evals-research"], true),
    product("b", ["vision"], false),
    product("c", ["evals-research"], true),
  ];

  const global = projectRhythm(products);
  assert.equal(global.get("a")?.size, "spread");
  assert.equal(global.get("b")?.size, "standard");
  // Globally, c inherits b's parity flip and is NOT spread.
  assert.equal(global.get("c")?.size, "standard");

  const overrides = categoryRhythmOverrides(products);
  assert.match(
    overrides,
    /\[data-active-category="evals-research"\] \.project-grid \[data-slug="c"\]\{grid-column:1\/-1\}/
  );
  // a already agrees with the global rhythm within the evals-research view
  // (still the first spread-eligible card, still spread) -- no override
  // needed for it.
  assert.doesNotMatch(overrides, /data-slug="a"/);
});

test("categoryRhythmOverrides emits a standard (grid-column:auto) override, not just spread ones", () => {
  // a has no figure (always standard, in either walk) and sits right before
  // b in both the global list and the tooling-only view. Globally, an
  // off-category spread-eligible project between them resets parity to 0
  // by the time b is reached, so the global rhythm spreads b. Within the
  // tooling-only view that project is absent, so b directly follows a's
  // own standard (parity-toggling) outcome and should stay standard.
  const products = [
    product("a", ["tooling"], false),
    product("x", ["vision"], true),
    product("b", ["tooling"], true),
  ];

  const global = projectRhythm(products);
  assert.equal(global.get("a")?.size, "standard");
  assert.equal(global.get("b")?.size, "spread");

  const overrides = categoryRhythmOverrides(products);
  assert.match(
    overrides,
    /\[data-active-category="tooling"\] \.project-grid \[data-slug="b"\]\{grid-column:auto\}/
  );
});

test("categoryRhythmOverrides scopes each rule to its own category, not the whole grid", () => {
  const products = [
    product("a", ["evals-research"], true),
    product("b", ["vision"], false),
    product("c", ["evals-research"], true),
  ];
  const overrides = categoryRhythmOverrides(products);
  // The override is a real CSS rule gated on the category attribute --
  // never a bare selector that would apply regardless of the active filter.
  assert.match(overrides, /^\[data-active-category="[a-z-]+"\] \.project-grid /);
});
