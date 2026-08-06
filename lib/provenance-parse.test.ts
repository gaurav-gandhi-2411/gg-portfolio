import assert from "node:assert/strict";
import { test } from "node:test";

import {
  extractCitations,
  extractMeasuredDate,
  parseProvenanceText,
  stripRepoPrefix,
} from "./provenance-parse.ts";

// One fixture per row shape actually observed in content/provenance.md as
// of 2026-08-06 (see lib/provenance-parse.ts's doc comment for how shape 7
// was found — a real silent-mis-citation bug, not a hypothetical). A
// future change to provenance.md's table conventions should break one of
// these, not silently mis-cite a number on a live case-study page.

test("parses a clean single-citation row", () => {
  const text = "| `triageiq:resolution` | Resolution MAE: k8s 104.05d | `README.md:91-98` |";
  const { rows, rejected } = parseProvenanceText(text);
  assert.deepEqual(rejected, []);
  assert.deepEqual(rows.get("triageiq:resolution"), {
    claim: "Resolution MAE: k8s 104.05d",
    source: "`README.md:91-98`",
  });
});

test("extracts every citation in a multi-file Source cell, not just the first", () => {
  const source =
    "`docs/adr/019-direction-baseline.md:16-35,62-72`, `docs/DIRECTION_SIGNAL_STATUS.md:15-20`";
  const citations = extractCitations(source, undefined);
  assert.equal(citations.length, 2);
  assert.equal(citations[0].file, "docs/adr/019-direction-baseline.md");
  assert.equal(citations[0].line, 16);
  assert.equal(citations[1].file, "docs/DIRECTION_SIGNAL_STATUS.md");
  assert.equal(citations[1].line, 15);
});

test("attaches a prose 'commit `sha`' mention to citations that have no inline @sha pin", () => {
  const source = "landed 2026-07-24 — `README.md:78-82`, commit `1ad094f097efd0d9eec5cdb38de14c634cb1a0a8`";
  const citations = extractCitations(source, undefined);
  assert.equal(citations.length, 1);
  assert.equal(citations[0].commitSha, "1ad094f097efd0d9eec5cdb38de14c634cb1a0a8");
});

test("an inline @sha pin on the citation itself wins over a separate prose commit mention", () => {
  const source = "`data/backtest.json@d41372a` — commit `deadbeef1234567890deadbeef1234567890dead` elsewhere";
  const citations = extractCitations(source, undefined);
  assert.equal(citations.length, 1);
  assert.equal(citations[0].file, "data/backtest.json");
  assert.equal(citations[0].commitSha, "d41372a");
});

test("strips a repo-qualified path prefix that matches the case study's own repo slug", () => {
  assert.equal(
    stripRepoPrefix("triage-iq/docs/architecture/adr/0018-x.md", "triage-iq"),
    "docs/architecture/adr/0018-x.md"
  );
  // a different repo's own name is left alone, not stripped
  assert.equal(stripRepoPrefix("gold-rate-tracker/data/backtest.json", "triage-iq"), "gold-rate-tracker/data/backtest.json");
});

test("a Source cell with no backtick file citation yields zero citations, not a guess", () => {
  assert.deepEqual(extractCitations("declined to fabricate an inflation-magnitude estimate", undefined), []);
});

test("extractMeasuredDate prefers a date in the source cell over one in the claim", () => {
  assert.equal(
    extractMeasuredDate("corrected 2026-07-31 in the write-up", "measured 2026-08-05, see report"),
    "2026-08-05"
  );
  assert.equal(extractMeasuredDate("corrected 2026-07-31 in the write-up", "no date here"), "2026-07-31");
  assert.equal(extractMeasuredDate("no date here either", "still none"), undefined);
});

test("a line that never matches the row shape at all is silently skipped, not rejected", () => {
  const text = [
    "Some unrelated prose paragraph.",
    "| not a real row |",
    "| `bare-id-no-second-pipe` incomplete",
  ].join("\n");
  const { rows, rejected } = parseProvenanceText(text);
  assert.equal(rows.size, 0);
  assert.deepEqual(rejected, []);
});

// Real bug found authoring this parser (2026-08-06): content/provenance.md
// has a second, 4-column "old value | new value | source" correction
// ledger table elsewhere in the file whose rows also happen to open with
// `| \`id\` |` — the exact same opening shape as the real 3-column table.
// ROW_RE's two greedy `(.*)` groups matched it anyway, mis-partitioning
// claim/source at the wrong pipe, and because insertion order determined
// which row won, this ledger row's misparsed content silently overwrote
// the real row for `style-maitri:intent-accuracy` and
// `style-maitri:catalogue-size`.
test("rejects a 4-column row (extra pipe) instead of silently mis-partitioning claim/source", () => {
  const text =
    "| `style-maitri:intent-accuracy` | 94.4% (n=378) | 93.8% (n=211) | `reports/final_scorecard_2026-07-12.txt:109` (commit `57e7e60`) |";
  const { rows, rejected } = parseProvenanceText(text);
  assert.equal(rows.size, 0);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason, "ambiguous-pipe-split");
});

test("a well-formed row for an id is kept even when a malformed 4-column row shares the same id elsewhere", () => {
  const text = [
    "| `style-maitri:intent-accuracy` | 93.8% intent-parsing accuracy (n=211) | `reports/final_scorecard_2026-07-12.txt:109` |",
    "| `style-maitri:intent-accuracy` | 94.4% (n=378) | 93.8% (n=211) | `reports/final_scorecard_2026-07-12.txt:109` (commit `57e7e60`) |",
  ].join("\n");
  const { rows, rejected } = parseProvenanceText(text);
  assert.equal(rows.get("style-maitri:intent-accuracy")?.claim, "93.8% intent-parsing accuracy (n=211)");
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason, "ambiguous-pipe-split");
});

test("two different well-formed rows sharing an id are both rejected as a duplicate, not the last-wins", () => {
  const text = [
    "| `dup:id` | first claim | `a.md` |",
    "| `dup:id` | second, contradicting claim | `b.md` |",
  ].join("\n");
  const { rows, rejected } = parseProvenanceText(text);
  assert.equal(rows.has("dup:id"), false);
  assert.equal(rejected.length, 2);
  assert.ok(rejected.every((r) => r.reason === "duplicate-id"));
});
