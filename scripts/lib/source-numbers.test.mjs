// Unit tests for scripts/lib/source-numbers.mjs. Run: node --test scripts/lib/source-numbers.test.mjs
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { extractCitedLineNumbers, extractSourceNumbers } from "./source-numbers.mjs";

/**
 * Intent, written before the fix: a metric entry's cited line is evidence for
 * the CURRENT side of a changelog transition on that line, never the old side.
 * "61,883 -> 52,494" on the cited line supports a value of 52,494 and not one
 * of 61,883.
 *
 * Incident (found 2026-10-31, fixed 2026-11-01): style-maitri:catalogue-size
 * cites reports/soldout_filter_fix_2026-07-12.txt:28, which reads "Catalogue
 * size: 61,883 -> 52,494 items". The line check reported LINE MISMATCH for a
 * correct citation, because the transition filter written for whole-file
 * scans drops BOTH sides of every arrow. Thousands separators were a first
 * suspect and are not the cause: "52,494" already parses as 52494.
 */
describe("extractCitedLineNumbers (one cited line)", () => {
  test("the incident line: keeps the new side of the arrow, drops the old side", () => {
    const n = extractCitedLineNumbers(
      "Catalogue size: 61,883 -> 52,494 items (-9,389 net; the gross Shopify drop of 10,194"
    );
    assert.ok(n.includes(52494));
    assert.ok(!n.includes(61883));
    assert.ok(n.includes(9389));
    assert.ok(n.includes(10194));
  });

  test("unicode arrow and percentages", () => {
    const n = extractCitedLineNumbers("k8s R@5 18.0%→24.67%");
    assert.ok(n.includes(24.67));
    assert.ok(!n.includes(18));
  });

  test('"was X, now Y" keeps Y only', () => {
    const n = extractCitedLineNumbers("recall was 18.0%, now 24.67% after the fix");
    assert.ok(n.includes(24.67));
    assert.ok(!n.includes(18));
  });

  test('"from X to Y" keeps Y only', () => {
    const n = extractCitedLineNumbers("p95 went from 340 to 120 ms");
    assert.ok(n.includes(120));
    assert.ok(!n.includes(340));
  });

  test("a line with no transition keeps every number, comma-grouped ones whole", () => {
    assert.deepEqual(extractCitedLineNumbers("2,300 rows, 14 columns, 0.239 MAE"), [2300, 14, 0.239]);
  });
});

describe("extractSourceNumbers (whole file) is unchanged", () => {
  test("still drops both sides of a transition", () => {
    const n = extractSourceNumbers("Catalogue size: 61,883 -> 52,494 items");
    assert.ok(!n.includes(52494));
    assert.ok(!n.includes(61883));
  });
});
